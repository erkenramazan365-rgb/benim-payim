from typing import List, Set
from fastapi import HTTPException, status
from app.config import settings
from app.ai.adapter_interface import AIAdapterBase
from app.ai.demo_adapter import DemoAIAdapter
from app.ai.provider_adapter import GeminiAIAdapter
from app.ai.groq_adapter import GroqAIAdapter


def get_ai_adapter() -> AIAdapterBase:
    """
    Seçilen AI sağlayıcısına göre adapter döner:
    - Test ortamında: deterministik DemoAIAdapter (ağ bağımsız)
    - groq (GROQ_API_KEY varsa): GroqAIAdapter
    - gemini (GEMINI_API_KEY varsa): GeminiAIAdapter
    - varsayılan: DemoAIAdapter
    """
    if settings.ENVIRONMENT == "test":
        return DemoAIAdapter()
    if settings.AI_PROVIDER == "groq" and settings.GROQ_API_KEY:
        return GroqAIAdapter()
    if settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        return GeminiAIAdapter()
    return DemoAIAdapter()




def validate_source_entries(
    requested_ids: List[str],
    valid_session_entry_ids: Set[str],
) -> List[str]:
    """
    Gösterilen kaynak ID'lerinin gerçekten var olduğunu ve
    aynı kullanıcı ile oturuma ait olduğunu doğrular.
    Sahte veya başka oturuma ait kaynak kimliği bulunursa reddeder.
    """
    for eid in requested_ids:
        if eid not in valid_session_entry_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Geçersiz kaynak referansı: '{eid}' kimliği bu oturuma ait kayıtlar arasında bulunamadı.",
            )
    return requested_ids
