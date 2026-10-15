import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.conftest import create_test_jwt


@pytest.mark.asyncio
async def test_draft_autosave_and_persistence():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Oturum oluştur
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Python döngüleri"},
        )
        session_id = s_res.json()["id"]

        # Taslak kaydet (otomatik debounce simülasyonu)
        draft_res = await client.post(
            f"/api/sessions/{session_id}/draft",
            headers=headers,
            json={
                "notes": "for i in range(10) denemesi",
                "code": "for i in range(10):\n    print(i)",
                "language": "python",
            },
        )
        assert draft_res.status_code == 200
        data = draft_res.json()
        assert data["current_notes"] == "for i in range(10) denemesi"
        assert "print(i)" in data["current_code"]

        # Sayfa yenilendiğinde (GET session) taslağın korunduğunu doğrula
        get_res = await client.get(f"/api/sessions/{session_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["current_notes"] == "for i in range(10) denemesi"
        assert "print(i)" in get_res.json()["current_code"]


@pytest.mark.asyncio
async def test_saved_attempt_immutability():
    """
    Kaydedilen denemenin değişmez (immutable) olduğunu,
    kullanıcı taslağı sonradan değiştirse bile eski denemenin korunduğunu doğrular.
    """
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Oturum oluştur
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Liste elemanlarını filtreleme"},
        )
        session_id = s_res.json()["id"]

        # 1. Denemeyi kaydet
        att1_res = await client.post(
            f"/api/sessions/{session_id}/attempts",
            headers=headers,
            json={
                "notes": "İlk yaklaşım: for döngüsü",
                "code": "result = []\nfor x in lst: result.append(x)",
            },
        )
        assert att1_res.status_code == 201
        att1_data = att1_res.json()
        att1_id = att1_data["id"]
        assert att1_data["entry_type"] == "saved_attempt"

        # 2. Taslağı değiştir (yeni kod yaz)
        await client.post(
            f"/api/sessions/{session_id}/draft",
            headers=headers,
            json={
                "notes": "İkinci yaklaşım: list comprehension",
                "code": "result = [x for x in lst if x > 0]",
            },
        )

        # 3. İkinci denemeyi kaydet (gövde boş verilirse güncel taslağı dondurmalı)
        att2_res = await client.post(
            f"/api/sessions/{session_id}/attempts",
            headers=headers,
            json={},
        )
        assert att2_res.status_code == 201
        att2_data = att2_res.json()
        att2_id = att2_data["id"]
        assert att2_id != att1_id
        assert "list comprehension" in att2_data["notes"]

        # 4. Denemeleri listele ve 1. denemenin kodunun DEĞİŞMEDİĞİNİ doğrula
        list_res = await client.get(f"/api/sessions/{session_id}/attempts", headers=headers)
        assert list_res.status_code == 200
        attempts = list_res.json()
        assert len(attempts) == 2

        first_att = next(a for a in attempts if a["id"] == att1_id)
        assert first_att["code"] == "result = []\nfor x in lst: result.append(x)"
        assert first_att["notes"] == "İlk yaklaşım: for döngüsü"


@pytest.mark.asyncio
async def test_cross_user_entry_protection():
    """
    Kullanıcı B, Kullanıcı A'nın oturumuna taslak kaydedemez veya deneme ekleyemez (RLS).
    """
    user_a_id = str(uuid4())
    user_b_id = str(uuid4())

    token_a = create_test_jwt(user_id=user_a_id)
    token_b = create_test_jwt(user_id=user_b_id)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A oturum açar
        s_res = await client.post(
            "/api/sessions",
            headers=headers_a,
            json={"goal": "User A Oturumu"},
        )
        session_id = s_res.json()["id"]

        # User B taslak kaydetmeye çalışır -> 404 (oturum bulunamadı/yetkisiz)
        draft_b = await client.post(
            f"/api/sessions/{session_id}/draft",
            headers=headers_b,
            json={"notes": "Hacked Notes", "code": "hacked()"},
        )
        assert draft_b.status_code == 404

        # User B deneme eklemeye çalışır -> 404 (oturum bulunamadı/yetkisiz)
        att_b = await client.post(
            f"/api/sessions/{session_id}/attempts",
            headers=headers_b,
            json={"code": "hacked()"},
        )
        assert att_b.status_code == 404

        # User B denemeleri listelemeye çalışır -> 404
        list_b = await client.get(
            f"/api/sessions/{session_id}/attempts",
            headers=headers_b,
        )
        assert list_b.status_code == 404
