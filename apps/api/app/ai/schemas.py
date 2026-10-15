from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class HelpRequestInput(BaseModel):
    mode: Literal["hint", "explain", "example_solution"]
    current_code: str = Field(default="", max_length=15000)
    current_notes: str = Field(default="", max_length=15000)
    language: str = Field(default="python", max_length=50)
    source_entry_ids: List[str] = Field(default_factory=list)


class HelpResponseSchema(BaseModel):
    mode: Literal["hint", "explain", "example_solution"]
    content: str = Field(..., max_length=4000)
    disclaimer: str = Field(default="Kod incelemesine göre hazırlanmıştır. Kod çalıştırılmamıştır.")
    is_demo: bool = False
    source_entry_ids: List[str] = Field(default_factory=list)


class CheckQuestionSchema(BaseModel):
    question_type: Literal["find_bug", "explain_output", "complete_code", "alternative_solution"]
    question: str = Field(..., max_length=3000)
    evaluation_criteria: str = Field(..., max_length=1000)
    hint: Optional[str] = Field(default=None, max_length=1000)
    is_demo: bool = False


class CheckFeedbackSchema(BaseModel):
    consistent_points: List[str] = Field(default_factory=list)
    missing_points: List[str] = Field(default_factory=list)
    reasoning: str = Field(..., max_length=2000)
    next_step_tip: str = Field(..., max_length=1000)
    evaluation_limit: str = Field(
        default="Değerlendirme statik kod ve metin incelemesine dayanmaktadır; gerçek çalışma zamanı testi içermez."
    )
    is_demo: bool = False


class ObservationItem(BaseModel):
    observation: str = Field(..., max_length=1000)
    source_entry_ids: List[str] = Field(default_factory=list)
    source_type: Literal["kullanıcı denemesi", "kontrol yanıtı", "kullanıcı beyanı"]


class LearningCardSchema(BaseModel):
    goal: str = Field(..., max_length=500)
    saved_attempts_summary: List[str] = Field(default_factory=list)
    help_summary: List[str] = Field(default_factory=list)
    check_observations: List[ObservationItem] = Field(default_factory=list)
    review_topic: str = Field(..., max_length=500)
    disclaimer: str = Field(
        default="Bu kart yetkinlik sertifikası veya başarı puanı değildir. Bu oturumda kaydedilen somut gözlemleri listeler."
    )
    is_demo: bool = False
