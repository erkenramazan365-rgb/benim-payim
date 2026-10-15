from uuid import UUID
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.auth.jwt_validator import AuthenticatedUser
from app.db.supabase_client import SupabaseDataClient

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# Pydantic Şemaları
class CreateSessionRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=500, description="Bugün neyi anlamak istiyorsun?")
    topic: Optional[str] = Field(default=None, max_length=200, description="İsteğe bağlı konu başlığı")
    prior_knowledge: Optional[str] = Field(default=None, max_length=2000, description="Şu anda ne biliyorsun?")
    language: str = Field(default="python", max_length=50)


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    topic: Optional[str] = Field(default=None, max_length=200)
    status: Optional[str] = Field(default=None, pattern="^(in_progress|completed)$")
    language: Optional[str] = Field(default=None, max_length=50)


class SessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    topic: Optional[str] = None
    goal: str
    status: str
    current_notes: str = ""
    current_code: str = ""
    language: str = "python"
    created_at: str
    updated_at: str


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Yeni bir çalışma oturumu başlatır.
    Kullanıcı ID'si yalnızca doğrulanmış JWT'den alınır.
    """
    title = body.goal.strip()
    if len(title) > 60:
        title = title[:57] + "..."

    initial_notes = ""
    if body.prior_knowledge and body.prior_knowledge.strip():
        initial_notes = f"**Şu anki bilgim:** {body.prior_knowledge.strip()}"

    data = {
        "title": title,
        "topic": body.topic.strip() if body.topic else None,
        "goal": body.goal.strip(),
        "status": "in_progress",
        "current_notes": initial_notes,
        "current_code": "",
        "language": body.language,
    }

    client = SupabaseDataClient(current_user)
    created = await client.insert("learning_sessions", data)
    return created


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Kullanıcının mevcut oturumlarını listeler.
    RLS sayesinde kullanıcı yalnızca kendi oturumlarını görür.
    """
    client = SupabaseDataClient(current_user)
    sessions = await client.select("learning_sessions", params={"order": "created_at.desc"})
    return sessions


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Belirli bir oturumun detayını getirir.
    Kullanıcıya ait değilse 404 döner.
    """
    client = SupabaseDataClient(current_user)
    session = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı veya erişim yetkiniz yok.",
        )
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    body: UpdateSessionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturum üst bilgilerini günceller.
    """
    client = SupabaseDataClient(current_user)
    # Önce varlığını kontrol et
    existing = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Güncellenecek çalışma oturumu bulunamadı.",
        )

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        return existing

    updated_rows = await client.update("learning_sessions", updates, params={"id": f"eq.{session_id}"})
    if not updated_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Oturum güncellenemedi.",
        )
    return updated_rows[0]


class DraftSaveRequest(BaseModel):
    notes: str = Field(default="", max_length=20000)
    code: str = Field(default="", max_length=20000)
    language: Optional[str] = Field(default=None, max_length=50)


class AttemptCreateRequest(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=20000)
    code: Optional[str] = Field(default=None, max_length=20000)
    language: Optional[str] = Field(default=None, max_length=50)


class SessionEntryResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    entry_type: str
    notes: str
    code: str
    language: str
    created_at: str


@router.delete("/{session_id}", status_code=status.HTTP_200_OK)
async def delete_session(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturumu ve veritabanı kaskadı ile ilişkili tüm alt kayıtları siler.
    """
    client = SupabaseDataClient(current_user)
    existing = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Silinecek çalışma oturumu bulunamadı.",
        )

    await client.delete("learning_sessions", params={"id": f"eq.{session_id}"})
    return {"message": "Çalışma oturumu ve ilişkili kayıtlar başarıyla silindi.", "id": session_id}


@router.post("/{session_id}/draft", response_model=SessionResponse)
async def save_draft(
    session_id: str,
    body: DraftSaveRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Kullanıcının güncel not ve kodunu taslak olarak kaydeder (800-1500 ms debounced).
    Oturumun current_notes ve current_code alanlarını günceller.
    """
    client = SupabaseDataClient(current_user)
    existing = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı.",
        )

    updates: dict = {
        "current_notes": body.notes,
        "current_code": body.code,
    }
    if body.language:
        updates["language"] = body.language

    updated_rows = await client.update("learning_sessions", updates, params={"id": f"eq.{session_id}"})
    if not updated_rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Taslak kaydedilemedi, lütfen tekrar deneyin.",
        )
    return updated_rows[0]


@router.post("/{session_id}/attempts", response_model=SessionEntryResponse, status_code=status.HTTP_201_CREATED)
async def save_attempt(
    session_id: str,
    body: AttemptCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Kullanıcının o anki not ve kodunun değişmez (immutable) bir kopyasını 'saved_attempt' olarak kaydeder.
    Her deneme kaydının kendi benzersiz kimliği (UUID) olur.
    """
    client = SupabaseDataClient(current_user)
    existing = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı.",
        )

    # Gönderilmediyse oturumun son güncel not ve kodunu al
    notes = body.notes if body.notes is not None else existing.get("current_notes", "")
    code = body.code if body.code is not None else existing.get("current_code", "")
    language = body.language or existing.get("language", "python")

    entry_data = {
        "session_id": session_id,
        "entry_type": "saved_attempt",
        "notes": notes,
        "code": code,
        "language": language,
    }

    created = await client.insert("session_entries", entry_data)
    return created


@router.get("/{session_id}/attempts", response_model=List[SessionEntryResponse])
async def list_attempts(
    session_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Oturuma ait kaydedilmiş tüm değişmez denemeleri listeler.
    """
    client = SupabaseDataClient(current_user)
    existing = await client.select_one("learning_sessions", params={"id": f"eq.{session_id}"})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çalışma oturumu bulunamadı.",
        )

    entries = await client.select(
        "session_entries",
        params={"session_id": f"eq.{session_id}", "entry_type": "eq.saved_attempt", "order": "created_at.asc"},
    )
    return entries

