from typing import Optional
from datetime import datetime, timedelta, timezone
from uuid import uuid5, NAMESPACE_DNS
import jwt
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, status
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    user_id: str
    email: str
    token_type: str = "bearer"


@router.post("/demo-token", response_model=TokenResponse)
async def generate_demo_token(body: LoginRequest):
    """
    Yerel demo modunda e-posta adresine göre geçerli, imzalı bir Supabase JWT token'ı üretir.
    """
    clean_email = body.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lütfen geçerli bir e-posta adresi girin.",
        )

    # E-postaya özel deterministik UUID üret
    user_uuid = str(uuid5(NAMESPACE_DNS, clean_email))
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_uuid,
        "email": clean_email,
        "aud": settings.SUPABASE_JWT_AUDIENCE,
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=7)).timestamp()),
    }

    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.SUPABASE_JWT_ALGORITHM)

    return TokenResponse(
        access_token=token,
        user_id=user_uuid,
        email=clean_email,
        token_type="bearer",
    )
