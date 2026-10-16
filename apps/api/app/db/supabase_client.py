import json
from uuid import UUID
from typing import Dict, Any, List, Optional
import httpx
from fastapi import HTTPException, status
from app.config import settings
from app.auth.jwt_validator import AuthenticatedUser


class SupabaseDataClient:
    """
    Supabase Data API (PostgREST) İstemcisi:
    - Tüm kullanıcı verisi istekleri kullanıcının doğrulanmış JWT bearer token'ı ile iletilir.
    - Böylece PostgreSQL RLS politikaları veri tabanında otomatik yürütülür.
    - Service-role anahtarı normal kullanıcı rotalarında KESİNLİKLE kullanılmaz.
    """

    def __init__(self, user: AuthenticatedUser):
        self.user = user
        clean_url = settings.SUPABASE_URL.strip().split()[0].rstrip("/")
        clean_key = settings.SUPABASE_ANON_KEY.strip().split()[0]
        self.base_url = f"{clean_url}/rest/v1"
        self.headers = {
            "apikey": clean_key,
            "Authorization": f"Bearer {user.raw_token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, str]] = None,
        json_data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        req_headers = {**self.headers, **(headers or {})}
        url = f"{self.base_url}/{path.lstrip('/')}"

        # Test, çevrimdışı mod veya izole demo hesabı için yerel store'a yönlendirme
        from app.db.local_store import is_local_mode, local_db
        is_demo_account = self.user.email in ("ogrenci@benimpayim.dev", "demo@benimpayim.local")
        if is_local_mode() or is_demo_account:
            return await local_db.handle_request(
                user_id=self.user.user_id,
                method=method,
                table=path.split("?")[0].lstrip("/"),
                params=params or {},
                json_data=json_data,
            )

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=req_headers,
                    params=params,
                    json=json_data,
                )
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Veritabanı bağlantı hatası: {str(exc)}",
                )

            if response.status_code >= 400:
                detail = "Veritabanı işlem hatası."
                try:
                    err_json = response.json()
                    detail = err_json.get("message") or err_json.get("error") or detail
                except Exception:
                    detail = response.text or detail

                # RLS ihlali veya yetkisiz erişim kontrolü
                if response.status_code in (401, 403):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Bu veriye erişim veya değişiklik yetkiniz yok (RLS Koruması): {detail}",
                    )
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Veritabanı hatası: {detail}",
                )

            if response.status_code == 204:
                return None
            try:
                return response.json()
            except Exception:
                return None

    # POST /table
    async def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        result = await self._request("POST", table, json_data=data)
        if isinstance(result, list) and len(result) > 0:
            return result[0]
        return result or {}

    # GET /table?query
    async def select(
        self,
        table: str,
        params: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        result = await self._request("GET", table, params=params)
        if isinstance(result, list):
            return result
        return []

    # GET /table?id=eq.xyz
    async def select_one(
        self,
        table: str,
        params: Optional[Dict[str, str]] = None,
    ) -> Optional[Dict[str, Any]]:
        headers = {"Accept": "application/vnd.pgrst.object+json"}
        res = await self.select(table, params=params)
        if res and len(res) > 0:
            return res[0]
        return None

    # PATCH /table?id=eq.xyz
    async def update(
        self,
        table: str,
        data: Dict[str, Any],
        params: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        result = await self._request("PATCH", table, params=params, json_data=data)
        if isinstance(result, list):
            return result
        return [result] if result else []

    # DELETE /table?id=eq.xyz
    async def delete(
        self,
        table: str,
        params: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        result = await self._request("DELETE", table, params=params)
        if isinstance(result, list):
            return result
        return [result] if result else []
