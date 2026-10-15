import time
from typing import Dict, Tuple, Any, Optional
from fastapi import HTTPException, status, Request
from app.config import settings


class IdempotencyAndRateLimiter:
    """
    - Idempotency-Key kontrolü: Çift tıklamayla aynı isteğin iki kez işlenmesini engeller ve önbellekteki yanıtı döner.
    - Token Bucket / Slided Window Rate Limiter: Kullanıcı başına dakikalık AI istek sınırını denetler.
    """

    def __init__(self):
        # key: (user_id, idempotency_key) -> (timestamp, response_data)
        self.idempotency_cache: Dict[Tuple[str, str], Tuple[float, Any]] = {}
        # key: user_id -> list of timestamps
        self.user_requests: Dict[str, list[float]] = {}

    def check_rate_limit(self, user_id: str) -> None:
        now = time.time()
        window = 60.0  # 1 dakika
        limit = settings.RATE_LIMIT_PER_MINUTE

        timestamps = self.user_requests.get(user_id, [])
        # Son 1 dakikadaki istekleri filtrele
        valid_timestamps = [t for t in timestamps if now - t < window]
        
        if len(valid_timestamps) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"İstek sınırı aşıldı. Dakikada en fazla {limit} AI isteği yapabilirsiniz. Lütfen biraz bekleyin.",
            )

        valid_timestamps.append(now)
        self.user_requests[user_id] = valid_timestamps

    def get_idempotent_response(
        self, user_id: str, idempotency_key: Optional[str]
    ) -> Optional[Any]:
        if not idempotency_key:
            return None
        now = time.time()
        cache_key = (user_id, idempotency_key)
        if cache_key in self.idempotency_cache:
            ts, response = self.idempotency_cache[cache_key]
            # 5 dakika geçerlilik
            if now - ts < 300.0:
                return response
            else:
                del self.idempotency_cache[cache_key]
        return None

    def store_idempotent_response(
        self, user_id: str, idempotency_key: Optional[str], response: Any
    ) -> None:
        if not idempotency_key:
            return
        self.idempotency_cache[(user_id, idempotency_key)] = (time.time(), response)


limiter = IdempotencyAndRateLimiter()
