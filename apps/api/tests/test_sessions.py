import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.conftest import create_test_jwt


@pytest.mark.asyncio
async def test_create_and_list_sessions():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Oturum oluştur
        res = await client.post(
            "/api/sessions",
            headers=headers,
            json={
                "goal": "Python'da liste filtrelemeyi anlamak",
                "topic": "Veri Yapıları",
                "prior_knowledge": "Temel for döngülerini biliyorum.",
                "language": "python",
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["goal"] == "Python'da liste filtrelemeyi anlamak"
        assert data["user_id"] == user_id
        assert data["status"] == "in_progress"
        assert "Temel for döngülerini" in data["current_notes"]
        session_id = data["id"]

        # 2. Oturumları listele
        list_res = await client.get("/api/sessions", headers=headers)
        assert list_res.status_code == 200
        sessions = list_res.json()
        assert len(sessions) == 1
        assert sessions[0]["id"] == session_id

        # 3. Oturum detayını getir
        detail_res = await client.get(f"/api/sessions/{session_id}", headers=headers)
        assert detail_res.status_code == 200
        assert detail_res.json()["id"] == session_id

        # 4. Oturumu güncelle
        patch_res = await client.patch(
            f"/api/sessions/{session_id}",
            headers=headers,
            json={"status": "completed", "topic": "İleri Seviye Filtreleme"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["status"] == "completed"
        assert patch_res.json()["topic"] == "İleri Seviye Filtreleme"

        # 5. Oturumu sil
        del_res = await client.delete(f"/api/sessions/{session_id}", headers=headers)
        assert del_res.status_code == 200

        # 6. Silindiğini doğrula
        get_after_del = await client.get(f"/api/sessions/{session_id}", headers=headers)
        assert get_after_del.status_code == 404


@pytest.mark.asyncio
async def test_rls_cross_user_isolation_for_sessions():
    """
    Kullanıcı A'nın oturumuna Kullanıcı B KESİNLİKLE erişememeli,
    güncelleyememeli veya silememelidir.
    """
    user_a_id = str(uuid4())
    user_b_id = str(uuid4())

    token_a = create_test_jwt(user_id=user_a_id, email="user_a@test.com")
    token_b = create_test_jwt(user_id=user_b_id, email="user_b@test.com")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A bir oturum oluşturur
        res_a = await client.post(
            "/api/sessions",
            headers=headers_a,
            json={"goal": "User A Özel Hedefi"},
        )
        session_a_id = res_a.json()["id"]

        # 1. User B listelediğinde User A'nın oturumunu GÖREMEMELİ
        list_b = await client.get("/api/sessions", headers=headers_b)
        assert len(list_b.json()) == 0

        # 2. User B direkt ID ile User A'nın oturumunu ÇEKEMEMELİ (404)
        get_b = await client.get(f"/api/sessions/{session_a_id}", headers=headers_b)
        assert get_b.status_code == 404

        # 3. User B, User A'nın oturumunu GÜNCELLEYEMEMELİ (404)
        patch_b = await client.patch(
            f"/api/sessions/{session_a_id}",
            headers=headers_b,
            json={"title": "Hacked Title"},
        )
        assert patch_b.status_code == 404

        # 4. User B, User A'nın oturumunu SİLEMEMELİ (404)
        del_b = await client.delete(f"/api/sessions/{session_a_id}", headers=headers_b)
        assert del_b.status_code == 404

        # User A için oturumun bozulmadığını doğrula
        check_a = await client.get(f"/api/sessions/{session_a_id}", headers=headers_a)
        assert check_a.status_code == 200
        assert check_a.json()["goal"] == "User A Özel Hedefi"
