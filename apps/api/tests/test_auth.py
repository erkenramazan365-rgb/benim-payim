import pytest
from uuid import uuid4
from fastapi import HTTPException
from app.auth.jwt_validator import verify_supabase_jwt
from tests.conftest import create_test_jwt


def test_valid_jwt_token_extraction():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id, email="ogrenci@benimpayim.dev")
    auth_user = verify_supabase_jwt(token)
    assert str(auth_user.user_id) == user_id
    assert auth_user.email == "ogrenci@benimpayim.dev"
    assert auth_user.role == "authenticated"


def test_expired_jwt_rejected():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id, expires_in_seconds=-60)
    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt(token)
    assert exc_info.value.status_code == 401
    assert "süresi doldu" in exc_info.value.detail


def test_invalid_signature_rejected():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id, secret="wrong-secret-key-1234567890123456")
    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt(token)
    assert exc_info.value.status_code == 401
    assert "Geçersiz yetkilendirme" in exc_info.value.detail


def test_wrong_audience_rejected():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id, audience="wrong_audience")
    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt(token)
    assert exc_info.value.status_code == 401
    assert "hedef kitle" in exc_info.value.detail


def test_empty_or_malformed_token_rejected():
    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt("")
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt("not.a.valid.jwt")
    assert exc_info.value.status_code == 401
