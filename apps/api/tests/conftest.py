import os
import sys
import pytest
import jwt
from uuid import uuid4
from datetime import datetime, timedelta, timezone

# Add app to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.db.local_store import local_db

# Ensure test mode
settings.ENVIRONMENT = "test"


@pytest.fixture(autouse=True)
def reset_local_store():
    local_db.reset()
    yield
    local_db.reset()


def create_test_jwt(
    user_id: str,
    secret: str = settings.SUPABASE_JWT_SECRET,
    algorithm: str = "HS256",
    audience: str = "authenticated",
    expires_in_seconds: int = 3600,
    email: str = "test@example.com",
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "aud": audience,
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)
