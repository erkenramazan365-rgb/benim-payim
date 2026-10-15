from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.jwt_validator import AuthenticatedUser, verify_supabase_jwt

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> AuthenticatedUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Giriş yapmanız gerekiyor. Yetkilendirme başlığı eksik.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_supabase_jwt(credentials.credentials)
