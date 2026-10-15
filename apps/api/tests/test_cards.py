import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.conftest import create_test_jwt


@pytest.mark.asyncio
async def test_card_generation_and_user_edit_separation():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Oturum aç
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Python'da liste filtreleme"},
        )
        session_id = s_res.json()["id"]

        # Deneme kaydet
        await client.post(
            f"/api/sessions/{session_id}/attempts",
            headers=headers,
            json={"code": "[x for x in [1, 2, 3] if x > 1]"},
        )

        # Yardım talep et
        await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "hint"},
        )

        # 1. Kartı üret
        card_res = await client.post(f"/api/sessions/{session_id}/card", headers=headers)
        assert card_res.status_code == 200
        card_data = card_res.json()
        assert card_data["session_id"] == session_id
        assert card_data["user_id"] == user_id
        assert card_data["user_edits"] == {}
        assert card_data["user_note"] == ""

        ai_draft = card_data["ai_draft"]
        assert ai_draft["goal"] == "Python'da liste filtreleme"
        assert len(ai_draft["saved_attempts_summary"]) > 0
        assert len(ai_draft["help_summary"]) > 0
        original_goal = ai_draft["goal"]
        card_id = card_data["id"]

        # 2. İkinci çağrıda mevcut kart dönmeli (tek kart kuralı)
        second_card_res = await client.post(f"/api/sessions/{session_id}/card", headers=headers)
        assert second_card_res.status_code == 200
        assert second_card_res.json()["id"] == card_id

        # 3. Kullanıcı düzenleme yapsın (user_edits ve user_note)
        patch_res = await client.patch(
            f"/api/sessions/{session_id}/card",
            headers=headers,
            json={
                "user_note": "Kendi notum: Boş liste durumuna dikkat etmem gerekiyor.",
                "user_edits": {"custom_review": "List comprehension ve performans"},
            },
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["user_note"] == "Kendi notum: Boş liste durumuna dikkat etmem gerekiyor."
        assert updated["user_edits"]["custom_review"] == "List comprehension ve performans"

        # 4. Orijinal AI taslağının değişmediğini doğrula
        assert updated["ai_draft"]["goal"] == original_goal

        # 5. GET ile getirip doğrula
        get_res = await client.get(f"/api/sessions/{session_id}/card", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["user_note"] == "Kendi notum: Boş liste durumuna dikkat etmem gerekiyor."


@pytest.mark.asyncio
async def test_card_with_skipped_check_produces_honest_observation():
    """
    Kontrol atlandığında sahte başarı üretilmemeli;
    'Bu oturumda uygulama kontrolü yapılmadı.' gözlemi yer almalıdır.
    """
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Atlanan kontrol testi"},
        )
        session_id = s_res.json()["id"]

        # Kontrolü atla
        await client.post(f"/api/sessions/{session_id}/check/skip", headers=headers)

        # Kartı üret
        card_res = await client.post(f"/api/sessions/{session_id}/card", headers=headers)
        assert card_res.status_code == 200
        card_data = card_res.json()
        observations = card_data["ai_draft"]["check_observations"]
        assert any("Bu oturumda uygulama kontrolü yapılmadı." in obs["observation"] for obs in observations)


@pytest.mark.asyncio
async def test_cross_user_card_isolation():
    """
    Kullanıcı B, Kullanıcı A'nın kartına erişememeli veya düzenleyememelidir.
    """
    user_a_id = str(uuid4())
    user_b_id = str(uuid4())

    token_a = create_test_jwt(user_id=user_a_id)
    token_b = create_test_jwt(user_id=user_b_id)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A oturum ve kart açar
        s_res = await client.post("/api/sessions", headers=headers_a, json={"goal": "A hedefi"})
        session_id = s_res.json()["id"]
        await client.post(f"/api/sessions/{session_id}/card", headers=headers_a)

        # User B okumaya çalışır -> 404
        get_b = await client.get(f"/api/sessions/{session_id}/card", headers=headers_b)
        assert get_b.status_code == 404

        # User B güncellemeye çalışır -> 404
        patch_b = await client.patch(
            f"/api/sessions/{session_id}/card",
            headers=headers_b,
            json={"user_note": "Hacked note"},
        )
        assert patch_b.status_code == 404
