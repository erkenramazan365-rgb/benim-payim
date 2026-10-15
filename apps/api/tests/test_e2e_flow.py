import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.conftest import create_test_jwt


@pytest.mark.asyncio
async def test_complete_end_to_end_user_flow():
    """
    Şartnamedeki tam uçtan uca döngü:
    1. Oturum oluştur
    2. Taslak otomatik kaydı yap
    3. Değişmez deneme kaydı oluştur
    4. 3 yardım modundan (ipucu, mantık, örnek çözüm) destek al
    5. Kısa kontrol sorusunu yanıtla ve gerekçeli geri bildirimi al
    6. Öğrenme kartını üret, incele ve kendi notunu ekle
    7. Sayfa yenilendiğinde ve listelendiğinde tüm verilerin korunduğunu teyit et
    8. Oturumu sil
    """
    user_id = str(uuid4())
    token = create_test_jwt(user_id=user_id, email="ogrenci@benimpayim.dev")
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Adım 1: Oturum Oluşturma
        create_res = await client.post(
            "/api/sessions",
            headers=headers,
            json={
                "goal": "Python'da sözlük filtreleme ve anahtar arama",
                "topic": "Sözlükler",
                "prior_knowledge": "Temel key-value yapısını biliyorum.",
                "language": "python",
            },
        )
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]

        # Adım 2: Taslak Kaydetme (800-1500 ms debounced simülasyonu)
        draft_res = await client.post(
            f"/api/sessions/{session_id}/draft",
            headers=headers,
            json={
                "notes": "keys() ve values() metodlarını deneyeceğim.",
                "code": "d = {'a': 1, 'b': 2}\nprint(d.keys())",
            },
        )
        assert draft_res.status_code == 200
        assert "keys()" in draft_res.json()["current_notes"]

        # Adım 3: Değişmez Deneme Kaydı
        attempt_res = await client.post(
            f"/api/sessions/{session_id}/attempts",
            headers=headers,
            json={
                "notes": "1. Deneme: for anahtar döngüsü",
                "code": "filtered = {k: v for k, v in d.items() if v > 1}",
            },
        )
        assert attempt_res.status_code == 201
        attempt_id = attempt_res.json()["id"]

        # Adım 4: 3 AI Yardım Modu
        # 4a. İpucu ver
        hint_res = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "hint", "source_entry_ids": [attempt_id]},
        )
        assert hint_res.status_code == 200
        assert hint_res.json()["mode"] == "hint"

        # 4b. Mantığını açıkla
        explain_res = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "explain"},
        )
        assert explain_res.status_code == 200

        # 4c. Örnek çözüm göster
        solution_res = await client.post(
            f"/api/sessions/{session_id}/help",
            headers=headers,
            json={"mode": "example_solution"},
        )
        assert solution_res.status_code == 200

        # Adım 5: Kısa Öğrenme Kontrolü
        check_res = await client.post(f"/api/sessions/{session_id}/check", headers=headers)
        assert check_res.status_code == 200
        assert check_res.json()["status"] == "pending"

        # Kontrolü Yanıtla
        answer_res = await client.post(
            f"/api/sessions/{session_id}/check/attempt",
            headers=headers,
            json={
                "response": "Sözlükte olmayan anahtara doğrudan d[key] ile erişilirse KeyError oluşur, d.get(key) güvenlidir.",
                "used_help": False,
            },
        )
        assert answer_res.status_code == 200
        assert answer_res.json()["status"] == "completed"

        # Adım 6: Öğrenme Kartı
        card_res = await client.post(f"/api/sessions/{session_id}/card", headers=headers)
        assert card_res.status_code == 200
        card_data = card_res.json()
        assert len(card_data["ai_draft"]["saved_attempts_summary"]) > 0
        assert len(card_data["ai_draft"]["help_summary"]) == 3

        # Kullanıcı Kendi Notunu Eklesin
        note_res = await client.patch(
            f"/api/sessions/{session_id}/card",
            headers=headers,
            json={"user_note": "KeyError riskine karşı her zaman dict.get() veya in kontrolü kullanmayı öğrendim."},
        )
        assert note_res.status_code == 200
        assert "dict.get()" in note_res.json()["user_note"]

        # Adım 7: Sayfa Yenilendiğinde (GET) Verilerin Korunduğunu Teyit Et
        s_verify = await client.get(f"/api/sessions/{session_id}", headers=headers)
        assert s_verify.status_code == 200
        assert "keys()" in s_verify.json()["current_notes"]

        c_verify = await client.get(f"/api/sessions/{session_id}/card", headers=headers)
        assert c_verify.status_code == 200
        assert "dict.get()" in c_verify.json()["user_note"]

        # Adım 8: Oturumu Sil
        del_res = await client.delete(f"/api/sessions/{session_id}", headers=headers)
        assert del_res.status_code == 200

        # Silindiğini ve artık erişilemediğini teyit et
        assert (await client.get(f"/api/sessions/{session_id}", headers=headers)).status_code == 404
