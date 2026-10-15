from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.auth.jwt_validator import AuthenticatedUser
from app.db.supabase_client import SupabaseDataClient
from app.ai.schemas import CheckQuestionSchema, CheckFeedbackSchema
from app.ai.validator import get_ai_adapter

router = APIRouter(prefix="/api/sessions/{session_id}/check", tags=["checks"])


class CheckAttemptRequest(BaseModel):
    response: str = Field(..., min_length=1, max_length=10000, description="Kullanıcının kontrol sorusuna yanıtı")
    used_help: bool = Field(default=False, description="Kullanıcı bu kontrol sorusunda ipucu kullandı mı?")


class CheckResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    question_type: str
    question: str
    hint: Optional[str] = None
    status: str  # pending, completed, skipped, failed_ai
    attempt: Optional[Dict[str, Any]] = None
    created_at: str


@router.post("", response_model=CheckResponse, status_code=status.HTTP_200_OK)
async def get_or_create_check(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturum için tek bir kısa öğrenme kontrolü üretir veya mevcut olanı getirir.
    Oturum başına kesinlikle tek bir kontrol oluşturulur (UNIQUE kuralı).
    """
    client = SupabaseDataClient(current_user)
    session = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı.",
        )

    # 1. Mevcut kontrol var mı?
    existing_check = await client.select_one("learning_checks", params={"session_id": f"eq.{session_id}"})
    if existing_check:
        # Varsa mevcut attempt kaydını da ekleyerek dön
        attempt = await client.select_one("check_attempts", params={"check_id": f"eq.{existing_check['id']}"})
        existing_check["attempt"] = attempt
        return existing_check

    # 2. Oturumun geçmiş denemelerini topla (aynı soruyu sormamak için)
    attempts = await client.select(
        "session_entries",
        params={"session_id": f"eq.{session_id}", "entry_type": "eq.saved_attempt"},
    )

    adapter = get_ai_adapter()
    try:
        check_data = await adapter.generate_check(
            goal=session.get("goal", ""),
            topic=session.get("topic"),
            current_code=session.get("current_code", ""),
            current_notes=session.get("current_notes", ""),
            language=session.get("language", "python"),
            attempts=attempts,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Öğrenme kontrolü oluşturulamadı (AI Hatası): {str(e)}",
        )

    row = {
        "session_id": session_id,
        "question_type": check_data.question_type,
        "question": check_data.question,
        "evaluation_criteria": check_data.evaluation_criteria,
        "status": "pending",
    }
    created = await client.insert("learning_checks", row)
    created["hint"] = check_data.hint
    created["attempt"] = None
    return created


@router.get("", response_model=CheckResponse)
async def get_check(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturuma ait öğrenme kontrolünü ve varsa yanıtını getirir.
    """
    client = SupabaseDataClient(current_user)
    check = await client.select_one("learning_checks", params={"session_id": f"eq.{session_id}"})
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bu oturum için henüz bir öğrenme kontrolü oluşturulmamış.",
        )

    attempt = await client.select_one("check_attempts", params={"check_id": f"eq.{check['id']}"})
    check["attempt"] = attempt
    return check


@router.post("/attempt", response_model=Dict[str, Any])
async def submit_check_attempt(
    session_id: str,
    body: CheckAttemptRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Kullanıcının kontrol sorusuna yanıtını alır, gerekçeli geri bildirim üretir ve kaydeder.
    AI servisi başarısız olursa kontrol 'atlandı' yapılmaz; 'failed_ai' durumu tutulur.
    """
    client = SupabaseDataClient(current_user)
    check = await client.select_one("learning_checks", params={"session_id": f"eq.{session_id}"})
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Öğrenme kontrolü bulunamadı.",
        )

    adapter = get_ai_adapter()
    feedback: Optional[CheckFeedbackSchema] = None
    last_err = None

    # En fazla 1 düzeltme denemesi
    for _ in range(2):
        try:
            feedback = await adapter.evaluate_check(
                question=check.get("question", ""),
                evaluation_criteria=check.get("evaluation_criteria", ""),
                user_response=body.response,
                used_help=body.used_help,
            )
            CheckFeedbackSchema.model_validate(feedback.model_dump())
            break
        except Exception as e:
            last_err = e
            feedback = None

    if not feedback:
        # AI hatasında kontrol 'atlandı' yapılmaz, 'failed_ai' kaydedilir
        await client.update("learning_checks", {"status": "failed_ai"}, params={"id": f"eq.{check['id']}"})
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Değerlendirme yapılamadı (AI Hatası): {str(last_err)}. Kontrol durumu 'failed_ai' olarak işaretlendi.",
        )

    # Başarılı değerlendirme: check_attempts tablosuna ekle
    attempt_data = {
        "check_id": check["id"],
        "session_id": session_id,
        "response": body.response,
        "used_help": body.used_help,
        "feedback": feedback.model_dump(),
        "status": "completed",
    }
    saved_attempt = await client.insert("check_attempts", attempt_data)

    # Kontrol durumunu completed yap
    await client.update("learning_checks", {"status": "completed"}, params={"id": f"eq.{check['id']}"})

    return {
        "check_id": check["id"],
        "status": "completed",
        "feedback": feedback.model_dump(),
        "attempt_id": saved_attempt.get("id"),
    }


@router.post("/skip", response_model=Dict[str, Any])
async def skip_check(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Öğrenme kontrolünü atlar.
    Durum 'skipped' olarak kaydedilir; kart oluşturulurken uydurma başarı üretilmez.
    """
    client = SupabaseDataClient(current_user)
    check = await client.select_one("learning_checks", params={"session_id": f"eq.{session_id}"})
    if not check:
        # Kontrol henüz yoksa önce pending olarak oluşturup sonra skip yapabiliriz
        created_check = await get_or_create_check(session_id, current_user)
        check_id = created_check["id"] if isinstance(created_check, dict) else created_check.id
    else:
        check_id = check["id"]


    await client.update("learning_checks", {"status": "skipped"}, params={"id": f"eq.{check_id}"})
    return {
        "check_id": check_id,
        "status": "skipped",
        "message": "Bu oturumda uygulama kontrolü atlandı.",
    }
