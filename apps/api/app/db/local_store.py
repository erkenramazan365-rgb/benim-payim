from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from app.config import settings


def is_local_mode() -> bool:
    """
    Üretim (production) ortamında yerel simülatör ASLA kullanılmaz;
    yalnızca test ortamında veya yerel URL belirtildiğinde devreye girer.
    """
    if settings.ENVIRONMENT == "production":
        return False
    return settings.ENVIRONMENT == "test" or "localhost" in settings.SUPABASE_URL or "127.0.0.1" in settings.SUPABASE_URL



class LocalRLSStore:
    """
    PostgreSQL RLS politikalarını ve PostgREST davranışını birebir taklit eden
    çevrimdışı ve test RLS motoru.
    """

    def __init__(self):
        self.reset()

    def reset(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.entries: Dict[str, Dict[str, Any]] = {}
        self.help_requests: Dict[str, Dict[str, Any]] = {}
        self.learning_checks: Dict[str, Dict[str, Any]] = {}
        self.check_attempts: Dict[str, Dict[str, Any]] = {}
        self.learning_cards: Dict[str, Dict[str, Any]] = {}

    def _get_table_dict(self, table: str) -> Dict[str, Dict[str, Any]]:
        table_name = table.split("?")[0].strip("/")
        mapping = {
            "learning_sessions": self.sessions,
            "session_entries": self.entries,
            "help_requests": self.help_requests,
            "learning_checks": self.learning_checks,
            "check_attempts": self.check_attempts,
            "learning_cards": self.learning_cards,
        }
        if table_name not in mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bilinmeyen tablo: {table_name}",
            )
        return mapping[table_name]

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    async def handle_request(
        self,
        user_id: UUID,
        method: str,
        table: str,
        params: Dict[str, str],
        json_data: Optional[Any] = None,
    ) -> Any:
        table_name = table.split("?")[0].strip("/")
        t_dict = self._get_table_dict(table_name)
        u_str = str(user_id)

        # ----------------- POST (INSERT) -----------------
        if method == "POST":
            row = dict(json_data or {})
            row_id = str(row.get("id") or uuid4())
            row["id"] = row_id
            row["user_id"] = u_str  # Güvenlik: sub'dan gelen user_id atanır
            row["created_at"] = row.get("created_at") or self._now_iso()

            # RLS Kuralı: Çocuk kayıt eklerken üst oturumun sahibi bu kullanıcı mı?
            if table_name in ("session_entries", "help_requests", "learning_checks", "check_attempts", "learning_cards"):
                session_id = str(row.get("session_id", ""))
                session = self.sessions.get(session_id)
                if not session or str(session.get("user_id")) != u_str:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="RLS İhlali: Başka bir kullanıcının oturumuna alt kayıt ekleyemezsiniz veya oturum bulunamadı.",
                    )

            # RLS Kuralı: check_attempts eklenirken kontrolün sahibi bu kullanıcı mı?
            if table_name == "check_attempts":
                check_id = str(row.get("check_id", ""))
                check = self.learning_checks.get(check_id)
                if not check or str(check.get("user_id")) != u_str:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="RLS İhlali: Bu kontrol sorusuna erişim yetkiniz yok.",
                    )

            # Unique Kuralı: learning_checks oturum başına tek
            if table_name == "learning_checks":
                s_id = str(row.get("session_id"))
                for existing in self.learning_checks.values():
                    if str(existing.get("session_id")) == s_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="Bu oturum için zaten bir öğrenme kontrolü mevcut.",
                        )

            # Unique Kuralı: learning_cards oturum başına tek
            if table_name == "learning_cards":
                s_id = str(row.get("session_id"))
                for existing in self.learning_cards.values():
                    if str(existing.get("session_id")) == s_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="Bu oturum için zaten bir öğrenme kartı mevcut.",
                        )
                row["updated_at"] = self._now_iso()

            if table_name == "learning_sessions":
                row["updated_at"] = self._now_iso()

            t_dict[row_id] = row
            return [row]

        # ----------------- GET (SELECT) -----------------
        if method == "GET":
            # RLS Kuralı: Sadece auth.uid() = user_id olanlar görünür
            results = [r for r in t_dict.values() if str(r.get("user_id")) == u_str]

            # Parametre filtreleri (id=eq.xyz, session_id=eq.xyz, entry_type=eq.xyz vb.)
            for k, v in params.items():
                if k == "order":
                    continue
                if v.startswith("eq."):
                    val = v[3:]
                    results = [r for r in results if str(r.get(k)) == val]

            # Sıralama
            order = params.get("order", "")
            if "created_at.desc" in order:
                results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            elif "created_at.asc" in order:
                results.sort(key=lambda x: x.get("created_at", ""))

            return results

        # ----------------- PATCH (UPDATE) -----------------
        if method == "PATCH":
            updated_rows = []
            target_id = None
            if "id" in params and params["id"].startswith("eq."):
                target_id = params["id"][3:]

            for r_id, row in list(t_dict.items()):
                # RLS Kuralı: Yalnızca kendi satırını güncelleyebilir
                if str(row.get("user_id")) != u_str:
                    continue
                if target_id and r_id != target_id:
                    continue

                # Oturum alt tablosuysa üst oturum da doğrulanır
                if table_name in ("session_entries", "learning_checks", "learning_cards"):
                    s_id = str(row.get("session_id", ""))
                    session = self.sessions.get(s_id)
                    if not session or str(session.get("user_id")) != u_str:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="RLS İhlali: Oturum sahipliği doğrulanamadı.",
                        )

                for k, v in (json_data or {}).items():
                    if k not in ("id", "user_id", "session_id", "created_at"):
                        row[k] = v

                if table_name in ("learning_sessions", "learning_cards"):
                    row["updated_at"] = self._now_iso()

                updated_rows.append(row)

            return updated_rows

        # ----------------- DELETE -----------------
        if method == "DELETE":
            deleted_rows = []
            target_id = None
            if "id" in params and params["id"].startswith("eq."):
                target_id = params["id"][3:]

            for r_id, row in list(t_dict.items()):
                # RLS Kuralı: Yalnızca kendi satırını silebilir
                if str(row.get("user_id")) != u_str:
                    continue
                if target_id and r_id != target_id:
                    continue

                # Cascade Silme (Oturum silinince alt kayıtlar da silinir)
                if table_name == "learning_sessions":
                    s_id = r_id
                    self.entries = {k: v for k, v in self.entries.items() if str(v.get("session_id")) != s_id}
                    self.help_requests = {k: v for k, v in self.help_requests.items() if str(v.get("session_id")) != s_id}
                    self.learning_checks = {k: v for k, v in self.learning_checks.items() if str(v.get("session_id")) != s_id}
                    self.check_attempts = {k: v for k, v in self.check_attempts.items() if str(v.get("session_id")) != s_id}
                    self.learning_cards = {k: v for k, v in self.learning_cards.items() if str(v.get("session_id")) != s_id}

                del t_dict[r_id]
                deleted_rows.append(row)

            return deleted_rows

        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Desteklenmeyen metod.")


local_db = LocalRLSStore()
