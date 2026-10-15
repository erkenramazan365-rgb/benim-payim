import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.conftest import create_test_jwt


@pytest.mark.asyncio
async def test_check_lifecycle_and_attempt():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Oturum aç
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Liste sınır durumları ve index hataları"},
        )
        session_id = s_res.json()["id"]

        # 1. Kontrol sorusu üret
        check_res = await client.post(f"/api/sessions/{session_id}/check", headers=headers)
        assert check_res.status_code == 200
        check_data = check_res.json()
        assert check_data["status"] == "pending"
        assert check_data["question_type"] == "find_bug"
        assert check_data["session_id"] == session_id
        check_id = check_data["id"]

        # 2. Tekrar çağırdığında aynı kontrolü döndürmeli (oturum başına tek kontrol)
        second_call = await client.post(f"/api/sessions/{session_id}/check", headers=headers)
        assert second_call.status_code == 200
        assert second_call.json()["id"] == check_id

        # 3. Kontrolü yanıtla (attempt)
        attempt_res = await client.post(
            f"/api/sessions/{session_id}/check/attempt",
            headers=headers,
            json={
                "response": "Boş liste gönderilirse len 0 olacağı için IndexError hatası fırlatır.",
                "used_help": False,
            },
        )
        assert attempt_res.status_code == 200
        att_data = attempt_res.json()
        assert att_data["status"] == "completed"
        feedback = att_data["feedback"]
        assert len(feedback["consistent_points"]) > 0
        assert "çalıştırılmamıştır" in feedback["evaluation_limit"].lower()

        # 4. Kontrol durumunun 'completed' olduğunu GET ile doğrula

        get_check = await client.get(f"/api/sessions/{session_id}/check", headers=headers)
        assert get_check.status_code == 200
        assert get_check.json()["status"] == "completed"
        assert get_check.json()["attempt"] is not None


@pytest.mark.asyncio
async def test_check_skip():
    """
    Öğrenme kontrolü atlandığında durumu 'skipped' olmalıdır.
    """
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Hızlı deneme"},
        )
        session_id = s_res.json()["id"]

        # Kontrol oluştur ve atla
        skip_res = await client.post(f"/api/sessions/{session_id}/check/skip", headers=headers)
        assert skip_res.status_code == 200
        assert skip_res.json()["status"] == "skipped"

        # Kontrol durumunu doğrula
        get_check = await client.get(f"/api/sessions/{session_id}/check", headers=headers)
        assert get_check.status_code == 200
        assert get_check.json()["status"] == "skipped"
        assert get_check.json()["attempt"] is None


@pytest.mark.asyncio
async def test_cross_user_check_forbidden():
    """
    Kullanıcı B, Kullanıcı A'nın kontrol sorusuna erişememeli veya yanıtlayamamalıdır.
    """
    user_a_id = str(uuid4())
    user_b_id = str(uuid4())

    token_a = create_test_jwt(user_id=user_a_id)
    token_b = create_test_jwt(user_id=user_b_id)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A oturum ve kontrol açar
        s_res = await client.post("/api/sessions", headers=headers_a, json={"goal": "A hedefi"})
        session_id = s_res.json()["id"]
        await client.post(f"/api/sessions/{session_id}/check", headers=headers_a)

        # User B getirmeye çalışır -> 404
        get_b = await client.get(f"/api/sessions/{session_id}/check", headers=headers_b)
        assert get_b.status_code == 404

        # User B yanıtlamaya çalışır -> 404
        attempt_b = await client.post(
            f"/api/sessions/{session_id}/check/attempt",
            headers=headers_b,
            json={"response": "hacked attempt"},
        )
        assert attempt_b.status_code == 404
