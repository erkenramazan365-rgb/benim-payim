import pytest
from app.ai.demo_adapter import DemoAIAdapter, DEMO_LABEL
from app.ai.validator import get_ai_adapter, validate_source_entries
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_demo_ai_help_generation():
    adapter = DemoAIAdapter()
    
    # 1. Hint mode
    hint_res = await adapter.generate_help(
        mode="hint",
        goal="Python'da liste filtreleme",
        current_code="def filtre(l): return l",
        current_notes="Sadece pozitifleri almak istiyorum",
        language="python",
        source_entry_ids=["id-1"],
    )
    assert hint_res.mode == "hint"
    assert DEMO_LABEL in hint_res.content
    assert hint_res.is_demo is True
    assert "Kod incelemesine göre" in hint_res.disclaimer
    assert "id-1" in hint_res.source_entry_ids

    # 2. Explain mode
    exp_res = await adapter.generate_help(
        mode="explain",
        goal="Python'da liste filtreleme",
        current_code="",
        current_notes="",
        language="python",
        source_entry_ids=[],
    )
    assert exp_res.mode == "explain"
    assert DEMO_LABEL in exp_res.content

    # 3. Example solution mode
    sol_res = await adapter.generate_help(
        mode="example_solution",
        goal="Python'da liste filtreleme",
        current_code="",
        current_notes="",
        language="python",
        source_entry_ids=[],
    )
    assert sol_res.mode == "example_solution"
    assert "def ornek_cozum" in sol_res.content


@pytest.mark.asyncio
async def test_demo_ai_check_and_feedback():
    adapter = DemoAIAdapter()
    
    check = await adapter.generate_check(
        goal="Liste sınır durumları",
        topic="Sınır durum kontrolü",
        current_code="",
        current_notes="",
        language="python",
        attempts=[],
    )
    assert check.question_type == "find_bug"
    assert DEMO_LABEL in check.question

    # Yanıt değerlendirmesi
    feedback = await adapter.evaluate_check(
        question=check.question,
        evaluation_criteria=check.evaluation_criteria,
        user_response="Boş liste gelirse index hatası verir",
        used_help=False,
    )
    assert feedback.is_demo is True
    assert any("Boş" in p for p in feedback.consistent_points)


def test_validate_source_entries_rejection():
    valid_ids = {"uuid-1", "uuid-2"}
    
    # Geçerli durum
    assert validate_source_entries(["uuid-1"], valid_ids) == ["uuid-1"]

    # Sahte veya başka oturumdan kimlik referansı reddedilmeli
    with pytest.raises(HTTPException) as exc_info:
        validate_source_entries(["uuid-sahte-3"], valid_ids)
    assert exc_info.value.status_code == 400
    assert "Geçersiz kaynak referansı" in exc_info.value.detail
