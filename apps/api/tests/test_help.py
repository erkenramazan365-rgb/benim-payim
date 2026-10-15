import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.conftest import create_test_jwt
from app.config import settings
from app.ai.demo_adapter import DEMO_LABEL


@pytest.mark.asyncio
async def test_all_three_help_modes_and_persistence():
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Oturum oluştur
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Python sözlük filtreleme"},
        )
        session_id = s_res.json()["id"]

        # Bir deneme kaydet
        att_res = await client.post(
            f"/api/sessions/{session_id}/attempts",
            headers=headers,
            json={"code": "d = {'a': 1, 'b': 2}"},
        )
        entry_id = att_res.json()["id"]

        # 1. 'hint' (İpucu) modu
        hint_res = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={
                "mode": "hint",
                "current_code": "d = {'a': 1}",
                "source_entry_ids": [entry_id],
            },
        )
        assert hint_res.status_code == 200
        hint_data = hint_res.json()
        assert hint_data["mode"] == "hint"
        assert DEMO_LABEL in hint_data["content"]
        assert hint_data["is_demo"] is True
        assert entry_id in hint_data["source_entry_ids"]

        # 2. 'explain' (Mantık Açıklaması) modu
        explain_res = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "explain"},
        )
        assert explain_res.status_code == 200
        assert explain_res.json()["mode"] == "explain"

        # 3. 'example_solution' (Örnek Çözüm) modu
        solution_res = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "example_solution"},
        )
        assert solution_res.status_code == 200
        assert solution_res.json()["mode"] == "example_solution"

        # 4. Geçmiş yardım taleplerini listele
        history_res = await client.get(f"/api/sessions/{session_id}/help", headers=headers)
        assert history_res.status_code == 200
        history = history_res.json()
        assert len(history) == 3
        modes = [h["mode"] for h in history]
        assert "hint" in modes
        assert "explain" in modes
        assert "example_solution" in modes


@pytest.mark.asyncio
async def test_invalid_source_entry_id_rejected():
    """
    Oturuma ait olmayan veya sahte bir deneme ID'si kaynak gösterildiğinde 400 ile reddedilmeli.
    """
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        s_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={"goal": "Hata yakalama"},
        )
        session_id = s_res.json()["id"]

        fake_id = str(uuid4())
        res = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "hint", "source_entry_ids": [fake_id]},
        )
        assert res.status_code == 400
        assert "Geçersiz kaynak referansı" in res.json()["detail"]


@pytest.mark.asyncio
async def test_idempotency_key_deduplication():
    """
    Aynı Idempotency-Key ile gelen çift tıklama isteklerinde aynı önbellek sonucu döner.
    """
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Idempotency-Key": "unique-client-key-12345",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        s_res = await client.post(
            "/api/sessions",
            headers={"Authorization": f"Bearer {token}"},
            json={"goal": "Idempotency Testi"},
        )
        session_id = s_res.json()["id"]

        # İlk istek
        res1 = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "hint"},
        )
        assert res1.status_code == 200

        # Çift tıklama (Aynı Idempotency-Key)
        res2 = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "hint"},
        )
        assert res2.status_code == 200
        assert res1.json() == res2.json()

        # Veritabanında yalnızca 1 yardım kaydı oluşmuş olmalı
        history = await client.get(
            f"/api/sessions/{session_id}/help",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert len(history.json()) == 1


@pytest.mark.asyncio
async def test_rate_limiting():
    """
    Kullanıcı belirlenen sınırı (örn: RATE_LIMIT_PER_MINUTE) aştığında 429 Too Many Requests almalıdır.
    """
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Test için geçici olarak sınırı düşürelim
    original_limit = settings.RATE_LIMIT_PER_MINUTE
    settings.RATE_LIMIT_PER_MINUTE = 3

    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            s_res = await client.post(
                "/api/sessions",
                headers=headers,
                json={"goal": "Rate limit testi"},
            )
            session_id = s_res.json()["id"]

            for i in range(3):
                r = await client.post(
                    f"/api/sessions/{session_id}/help",
                    headers=headers,
                    json={"mode": "hint"},
                )
                assert r.status_code == 200

            # 4. istek sınırı aşmalı
            rate_limited_res = await client.post(
                f"/api/sessions/{session_id}/help",
                headers=headers,
                json={"mode": "hint"},
            )
            assert rate_limited_res.status_code == 429
            assert "İstek sınırı aşıldı" in rate_limited_res.json()["detail"]
    finally:
        settings.RATE_LIMIT_PER_MINUTE = original_limit
