from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.auth.jwt_validator import AuthenticatedUser
from app.db.supabase_client import SupabaseDataClient
from app.ai.schemas import LearningCardSchema
from app.ai.validator import get_ai_adapter

router = APIRouter(prefix="/api/sessions/{session_id}/card", tags=["cards"])


class UpdateCardRequest(BaseModel):
    user_note: Optional[str] = Field(default=None, max_length=5000, description="Kullanıcının kendi eklediği not")
    user_edits: Optional[Dict[str, Any]] = Field(default=None, description="Kullanıcının kart alanlarında yaptığı düzenlemeler")


class LearningCardResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    ai_draft: Dict[str, Any]
    source_references: List[Dict[str, Any]]
    user_edits: Dict[str, Any]
    user_note: str
    created_at: str
    updated_at: str


@router.post("", response_model=LearningCardResponse, status_code=status.HTTP_200_OK)
async def generate_or_get_card(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturumun öğrenme kartını üretir veya mevcut olanı getirir.
    Oturum başına kesinlikle tek bir kart üretilir (UNIQUE kuralı).
    Kontrol çözülmemiş veya atlanmış olsa dahi kart üretilebilir.
    """
    client = SupabaseDataClient(current_user)
    session = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı.",
        )

    # 1. Mevcut kart var mı?
    existing_card = await client.select_one("learning_cards", params={"session_id": f"eq.{session_id}"})
    if existing_card:
        return existing_card

    # 2. Oturum verilerini topla: denemeler, yardım talepleri, kontrol ve yanıt
    attempts = await client.select(
        "session_entries",
        params={"session_id": f"eq.{session_id}", "entry_type": "eq.saved_attempt", "order": "created_at.asc"},
    )
    help_requests = await client.select(
        "help_requests",
        params={"session_id": f"eq.{session_id}", "order": "created_at.asc"},
    )
    check = await client.select_one("learning_checks", params={"session_id": f"eq.{session_id}"})
    check_attempt = None
    if check:
        check_attempt = await client.select_one("check_attempts", params={"check_id": f"eq.{check['id']}"})

    # 3. AI ile öğrenme kartı taslağı oluştur
    adapter = get_ai_adapter()
    try:
        card_data = await adapter.generate_card(
            goal=session.get("goal", ""),
            topic=session.get("topic"),
            attempts=attempts,
            help_requests=help_requests,
            check=check,
            check_attempt=check_attempt,
        )
        # Pydantic şema doğrulaması
        LearningCardSchema.model_validate(card_data.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Öğrenme kartı oluşturulamadı (AI Hatası): {str(e)}",
        )

    # Kaynak referansları
    source_refs = []
    for obs in card_data.check_observations:
        source_refs.append(obs.model_dump())

    card_record = {
        "session_id": session_id,
        "ai_draft": card_data.model_dump(),
        "source_references": source_refs,
        "user_edits": {},
        "user_note": "",
    }

    created = await client.insert("learning_cards", card_record)
    return created


@router.get("", response_model=LearningCardResponse)
async def get_card(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturuma ait öğrenme kartını getirir.
    Orijinal AI taslağı, kullanıcı düzenlemeleri ve kullanıcı notu ayrı olarak sunulur.
    """
    client = SupabaseDataClient(current_user)
    card = await client.select_one("learning_cards", params={"session_id": f"eq.{session_id}"})
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bu oturum için henüz bir öğrenme kartı oluşturulmamış.",
        )
    return card


@router.patch("", response_model=LearningCardResponse)
async def update_card(
    session_id: str,
    body: UpdateCardRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Kullanıcının kart üzerindeki düzenlemelerini ve kişisel notunu kaydeder.
    Orijinal AI taslağı (ai_draft) ASLA değiştirilmez; kullanıcının düzenlemesi
    (user_edits) ve notu (user_note) ayrı olarak saklanır.
    """
    client = SupabaseDataClient(current_user)
    card = await client.select_one("learning_cards", params={"session_id": f"eq.{session_id}"})
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Düzenlenecek öğrenme kartı bulunamadı.",
        )

    updates: Dict[str, Any] = {}
    if body.user_note is not None:
        updates["user_note"] = body.user_note
    if body.user_edits is not None:
        updates["user_edits"] = body.user_edits

    if not updates:
        return card

    updated = await client.update("learning_cards", updates, params={"id": f"eq.{card['id']}"})
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Öğrenme kartı güncellenemedi.",
        )
    return updated[0]
