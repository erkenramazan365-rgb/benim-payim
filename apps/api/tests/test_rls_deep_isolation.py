import pytest
from uuid import uuid4
from fastapi import HTTPException
from app.auth.jwt_validator import AuthenticatedUser
from app.db.supabase_client import SupabaseDataClient
from tests.conftest import create_test_jwt


@pytest.mark.asyncio
async def test_rls_cannot_insert_child_records_into_other_users_session():
    """
    Doğrudan veritabanı / Supabase Data API katmanında:
    Kullanıcı A'nın oluşturduğu bir oturuma Kullanıcı B'nin:
    - session_entries (deneme veya taslak)
    - help_requests
    - learning_checks
    - check_attempts
    - learning_cards
    eklemesi RLS tarafından KESİNLİKLE engellenmelidir (403 Forbidden).
    """
    user_a_id = uuid4()
    user_b_id = uuid4()

    token_a = create_test_jwt(user_id=str(user_a_id))
    token_b = create_test_jwt(user_id=str(user_b_id))

    user_a = AuthenticatedUser(user_id=user_a_id, raw_token=token_a)
    user_b = AuthenticatedUser(user_id=user_b_id, raw_token=token_b)

    client_a = SupabaseDataClient(user_a)
    client_b = SupabaseDataClient(user_b)

    # 1. User A bir oturum oluşturur
    session_a = await client_a.insert(
        "learning_sessions",
        {"title": "User A Oturumu", "goal": "User A Hedefi", "status": "in_progress"},
    )
    session_a_id = session_a["id"]

    # 2. User B, User A'nın oturumuna 'session_entries' eklemeye çalışır -> 403
    with pytest.raises(HTTPException) as exc:
        await client_b.insert(
            "session_entries",
            {
                "session_id": session_a_id,
                "entry_type": "saved_attempt",
                "notes": "Hacked",
                "code": "print('hacked')",
            },
        )
    assert exc.value.status_code == 403
    assert "RLS İhlali" in exc.value.detail

    # 3. User B, User A'nın oturumuna 'help_requests' eklemeye çalışır -> 403
    with pytest.raises(HTTPException) as exc:
        await client_b.insert(
            "help_requests",
            {
                "session_id": session_a_id,
                "mode": "hint",
                "source_entry_ids": [],
                "validated_response": {},
            },
        )
    assert exc.value.status_code == 403

    # 4. User B, User A'nın oturumuna 'learning_checks' eklemeye çalışır -> 403
    with pytest.raises(HTTPException) as exc:
        await client_b.insert(
            "learning_checks",
            {
                "session_id": session_a_id,
                "question_type": "find_bug",
                "question": "Hacked check",
                "evaluation_criteria": "None",
            },
        )
    assert exc.value.status_code == 403

    # 5. User B, User A'nın oturumuna 'learning_cards' eklemeye çalışır -> 403
    with pytest.raises(HTTPException) as exc:
        await client_b.insert(
            "learning_cards",
            {
                "session_id": session_a_id,
                "ai_draft": {"goal": "Hacked"},
                "source_references": [],
            },
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_rls_cascade_delete_cleans_all_child_records():
    """
    Oturum silindiğinde, veritabanı kaskadı sayesinde tüm alt kayıtlar
    (entries, help, checks, attempts, cards) da temizlenir.
    """
    user_id = uuid4()
    token = create_test_jwt(user_id=str(user_id))
    user = AuthenticatedUser(user_id=user_id, raw_token=token)
    client = SupabaseDataClient(user)

    # Oturum aç
    session = await client.insert("learning_sessions", {"title": "Silinecek", "goal": "Hedef"})
    s_id = session["id"]

    # Alt kayıtları ekle
    await client.insert(
        "session_entries",
        {"session_id": s_id, "entry_type": "saved_attempt", "code": "x = 1"},
    )
    await client.insert(
        "help_requests",
        {"session_id": s_id, "mode": "hint", "validated_response": {}},
    )
    check = await client.insert(
        "learning_checks",
        {
            "session_id": s_id,
            "question_type": "find_bug",
            "question": "Q?",
            "evaluation_criteria": "C",
        },
    )
    await client.insert(
        "check_attempts",
        {"check_id": check["id"], "session_id": s_id, "response": "R", "feedback": {}},
    )
    await client.insert(
        "learning_cards",
        {"session_id": s_id, "ai_draft": {}, "source_references": []},
    )

    # Oturumu sil
    await client.delete("learning_sessions", params={"id": f"eq.{s_id}"})

    # Alt tabloların tamamında bu oturuma ait satırların silindiğini doğrula
    assert len(await client.select("session_entries", params={"session_id": f"eq.{s_id}"})) == 0
    assert len(await client.select("help_requests", params={"session_id": f"eq.{s_id}"})) == 0
    assert len(await client.select("learning_checks", params={"session_id": f"eq.{s_id}"})) == 0
    assert len(await client.select("check_attempts", params={"session_id": f"eq.{s_id}"})) == 0
    assert len(await client.select("learning_cards", params={"session_id": f"eq.{s_id}"})) == 0
