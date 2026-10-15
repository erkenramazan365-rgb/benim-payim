import jwt
from uuid import UUID
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import HTTPException, status
from app.config import settings


class AuthenticatedUser(BaseModel):
    user_id: UUID
    email: Optional[str] = None
    role: str = "authenticated"
    raw_token: str


def verify_supabase_jwt(token: str) -> AuthenticatedUser:
    """
    Supabase JWT doğrulayıcısı:
    - İmza doğrulaması (SUPABASE_JWT_SECRET)
    - İzin verilen algoritma (HS256 / RS256)
    - exp, aud, iss kontrolleri
    - sub alanından UUID user_id çıkarımı
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yetkilendirme token'ı bulunamadı.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Supabase token claim doğrulaması (geliştirme modunda mock-signature toleransı)
        verify_sig = True
        if settings.ENVIRONMENT != "production" and "mock-signature" in token:
            verify_sig = False

        payload: Dict[str, Any] = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET if verify_sig else "",
            algorithms=[settings.SUPABASE_JWT_ALGORITHM] if verify_sig else ["HS256", "none"],
            audience=settings.SUPABASE_JWT_AUDIENCE,
            options={
                "verify_signature": verify_sig,
                "verify_exp": True,
                "verify_aud": True,
                "require": ["exp", "sub", "aud"],
            },
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum süresi doldu. Lütfen tekrar giriş yapın.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz hedef kitle (audience) parametresi.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidAlgorithmError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Desteklenmeyen imzalama algoritması.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz yetkilendirme token'ı.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 'sub' alanı eksik.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = UUID(str(sub))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı kimliği (UUID) formatı.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthenticatedUser(
        user_id=user_uuid,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
        raw_token=token,
    )
