from typing import List, Optional, Set
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.auth.dependencies import get_current_user
from app.auth.jwt_validator import AuthenticatedUser
from app.db.supabase_client import SupabaseDataClient
from app.ai.schemas import HelpRequestInput, HelpResponseSchema
from app.ai.validator import get_ai_adapter, validate_source_entries
from app.middleware.rate_limit import limiter

router = APIRouter(prefix="/api/sessions/{session_id}/help", tags=["help"])


class HelpRecordResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    mode: str
    source_entry_ids: List[str]
    request_status: str
    validated_response: dict
    created_at: str


@router.post("", response_model=HelpResponseSchema, status_code=status.HTTP_200_OK)
async def request_help(
    session_id: str,
    body: HelpRequestInput,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    3 AI Yardım Modu: 'hint' (İpucu), 'explain' (Mantık), 'example_solution' (Örnek Çözüm).
    - Idempotency-Key kontrolü ile çift tıklama engellenir.
    - Kullanıcı hız sınırı (rate limit) uygulanır.
    - İlgili oturumun sahipliği ve kaynak kayıt kimlikleri doğrulanır.
    - AI yanıtı Pydantic şemasıyla doğrulanır ve 'help_requests' tablosuna kaydedilir.
    """
    u_id_str = str(current_user.user_id)

    # 1. Idempotency Kontrolü
    cached_response = limiter.get_idempotent_response(u_id_str, idempotency_key)
    if cached_response:
        return cached_response

    # 2. Hız Sınırı (Rate Limit) Kontrolü
    limiter.check_rate_limit(u_id_str)

    # 3. Oturum Doğrulama
    client = SupabaseDataClient(current_user)
    session = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı.",
        )

    # 4. Kaynak Kayıt Kimlikleri Doğrulaması (Kaynak deneme IDs)
    if body.source_entry_ids:
        entries = await client.select(
            "session_entries",
            params={"session_id": f"eq.{session_id}", "entry_type": "eq.saved_attempt"},
        )
        valid_ids: Set[str] = {str(e["id"]) for e in entries}
        # Sahte veya başka oturuma ait kimlik varsa hata fırlatır
        validate_source_entries(body.source_entry_ids, valid_ids)

    # Kod ve Not önceliği: İstek gövdesinde verilmişse o, yoksa oturum taslağı
    code_to_use = body.current_code if body.current_code.strip() else session.get("current_code", "")
    notes_to_use = body.current_notes if body.current_notes.strip() else session.get("current_notes", "")
    language = body.language or session.get("language", "python")

    # 5. AI Çağrısı ve En Fazla 1 Düzeltme Denemesi
    adapter = get_ai_adapter()
    help_result: Optional[HelpResponseSchema] = None
    last_err = None

    for attempt in range(2):
        try:
            help_result = await adapter.generate_help(
                mode=body.mode,
                goal=session.get("goal", ""),
                current_code=code_to_use,
                current_notes=notes_to_use,
                language=language,
                source_entry_ids=body.source_entry_ids,
            )
            # Pydantic şema doğrulaması
            HelpResponseSchema.model_validate(help_result.model_dump())
            break
        except Exception as e:
            last_err = e
            help_result = None

    if not help_result:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI yardım servisi geçerli bir yanıt üretemedi: {str(last_err)}",
        )

    # 6. Sonucu help_requests tablosuna kaydet
    help_record = {
        "session_id": session_id,
        "mode": body.mode,
        "source_entry_ids": body.source_entry_ids,
        "request_status": "completed",
        "validated_response": help_result.model_dump(),
    }
    await client.insert("help_requests", help_record)

    # 7. Idempotency önbelleğine yaz
    limiter.store_idempotent_response(u_id_str, idempotency_key, help_result.model_dump())

    return help_result


@router.get("", response_model=List[HelpRecordResponse])
async def list_help_history(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturumda alınmış AI yardım taleplerinin geçmişini listeler.
    """
    client = SupabaseDataClient(current_user)
    session = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı.",
        )

    records = await client.select(
        "help_requests",
        params={"session_id": f"eq.{session_id}", "order": "created_at.asc"},
    )
    return records
