from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from app.ai.schemas import (
    HelpResponseSchema,
    CheckQuestionSchema,
    CheckFeedbackSchema,
    LearningCardSchema,
)


class AIAdapterBase(ABC):
    @abstractmethod
    async def generate_help(
        self,
        mode: str,
        goal: str,
        current_code: str,
        current_notes: str,
        language: str,
        source_entry_ids: List[str],
    ) -> HelpResponseSchema:
        pass

    @abstractmethod
    async def generate_check(
        self,
        goal: str,
        topic: Optional[str],
        current_code: str,
        current_notes: str,
        language: str,
        attempts: List[Dict[str, Any]],
    ) -> CheckQuestionSchema:
        pass

    @abstractmethod
    async def evaluate_check(
        self,
        question: str,
        evaluation_criteria: str,
        user_response: str,
        used_help: bool,
    ) -> CheckFeedbackSchema:
        pass

    @abstractmethod
    async def generate_card(
        self,
        goal: str,
        topic: Optional[str],
        attempts: List[Dict[str, Any]],
        help_requests: List[Dict[str, Any]],
        check: Optional[Dict[str, Any]],
        check_attempt: Optional[Dict[str, Any]],
    ) -> LearningCardSchema:
        pass
