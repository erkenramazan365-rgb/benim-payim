import { getStoredSession, isDemoSession } from "./auth";
import { handleFallbackRequest } from "./fallback";

const rawApiBase = process.env.NEXT_PUBLIC_API_URL || "";
const API_BASE_URL = rawApiBase.trim().split(/\s+/)[0].replace(/\/$/, "");

// Eğer yerel bir FastAPI sunucusu (localhost:8000) açıkça belirtilmemişse veya Render adresi uykudaysa,
// doğrudan canlı Supabase PostgreSQL + Next.js /api/ai (Groq Cloud) motorunu çalıştır.
const shouldUseDirectCloudEngine = (): boolean => {
  if (!API_BASE_URL) return true;
  if (API_BASE_URL.includes("onrender.com")) return true;
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    API_BASE_URL.includes("localhost")
  ) {
    return true;
  }
  return false;
};

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const session = getStoredSession();

  if (
    shouldUseDirectCloudEngine() ||
    (session && isDemoSession(session) && session.token.includes("mock-signature"))
  ) {
    return handleFallbackRequest(path, options);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      if (res.status >= 500 || (res.status === 401 && isDemoSession(session))) {
        return await handleFallbackRequest(path, options);
      }
      let errorDetail = "Bir işlem hatası oluştu.";
      try {
        const errJson = await res.json();
        errorDetail = errJson.detail || errJson.message || errorDetail;
      } catch {
        errorDetail = await res.text();
      }
      throw new Error(errorDetail);
    }

    if (res.status === 204) {
      return null;
    }

    return await res.json();
  } catch (err: any) {
    if (
      err.name === "AbortError" ||
      err.message?.includes("Failed to fetch") ||
      err.message?.includes("NetworkError") ||
      err.message?.includes("Load failed")
    ) {
      return await handleFallbackRequest(path, options);
    }
    throw err;
  }
}

// ----------------- OTURUMLAR (SESSIONS) -----------------
export interface SessionItem {
  id: string;
  user_id: string;
  title: string;
  topic?: string;
  goal: string;
  status: "in_progress" | "completed";
  current_notes: string;
  current_code: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export const getSessions = async (): Promise<SessionItem[]> => {
  return fetchWithAuth("/api/sessions");
};

export const getSession = async (id: string): Promise<SessionItem> => {
  return fetchWithAuth(`/api/sessions/${id}`);
};

export const createSession = async (data: {
  goal: string;
  topic?: string;
  prior_knowledge?: string;
  language?: string;
}): Promise<SessionItem> => {
  return fetchWithAuth("/api/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateSession = async (
  id: string,
  data: { title?: string; topic?: string; status?: string; language?: string }
): Promise<SessionItem> => {
  return fetchWithAuth(`/api/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const deleteSession = async (id: string): Promise<void> => {
  return fetchWithAuth(`/api/sessions/${id}`, {
    method: "DELETE",
  });
};

// ----------------- TASLAK VE DENEMELER (ENTRIES) -----------------
export interface SavedAttempt {
  id: string;
  session_id: string;
  entry_type: string;
  notes: string;
  code: string;
  language: string;
  created_at: string;
}

export const saveDraft = async (
  sessionId: string,
  data: { notes: string; code: string; language?: string }
): Promise<SessionItem> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/draft`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const saveAttempt = async (
  sessionId: string,
  data: { notes?: string; code?: string; language?: string } = {}
): Promise<SavedAttempt> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/attempts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getAttempts = async (sessionId: string): Promise<SavedAttempt[]> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/attempts`);
};

// ----------------- AI YARDIM (HELP) -----------------
export interface HelpResponse {
  mode: "hint" | "explain" | "example_solution";
  content: string;
  disclaimer: string;
  is_demo: boolean;
  source_entry_ids: string[];
}

export const requestHelp = async (
  sessionId: string,
  data: {
    mode: "hint" | "explain" | "example_solution";
    current_code?: string;
    current_notes?: string;
    language?: string;
    source_entry_ids?: string[];
  },
  idempotencyKey?: string
): Promise<HelpResponse> => {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return fetchWithAuth(`/api/sessions/${sessionId}/help`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
};

// ----------------- ÖĞRENME KONTROLÜ (CHECKS) -----------------
export interface CheckQuestion {
  id: string;
  session_id: string;
  question_type: string;
  question: string;
  hint?: string;
  status: "pending" | "completed" | "skipped" | "failed_ai";
  attempt?: {
    id: string;
    response: string;
    feedback: {
      consistent_points: string[];
      missing_points: string[];
      reasoning: string;
      next_step_tip: string;
      evaluation_limit: string;
      is_demo: boolean;
    };
  };
}

export const getOrCreateCheck = async (sessionId: string): Promise<CheckQuestion> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/check`, {
    method: "POST",
  });
};

export const getCheck = async (sessionId: string): Promise<CheckQuestion> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/check`);
};

export const submitCheckAttempt = async (
  sessionId: string,
  data: { response: string; used_help: boolean }
) => {
  return fetchWithAuth(`/api/sessions/${sessionId}/check/attempt`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const skipCheck = async (sessionId: string) => {
  return fetchWithAuth(`/api/sessions/${sessionId}/check/skip`, {
    method: "POST",
  });
};

// ----------------- ÖĞRENME KARTI (CARDS) -----------------
export interface ObservationItem {
  observation: string;
  source_entry_ids: string[];
  source_type: "kullanıcı denemesi" | "kontrol yanıtı" | "kullanıcı beyanı";
}

export interface LearningCardData {
  id: string;
  session_id: string;
  ai_draft: {
    goal: string;
    saved_attempts_summary: string[];
    help_summary: string[];
    check_observations: ObservationItem[];
    review_topic: string;
    disclaimer: string;
    is_demo: boolean;
  };
  source_references: ObservationItem[];
  user_edits: Record<string, any>;
  user_note: string;
  created_at: string;
  updated_at: string;
}

export const getOrCreateCard = async (sessionId: string): Promise<LearningCardData> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/card`, {
    method: "POST",
  });
};

export const getCard = async (sessionId: string): Promise<LearningCardData> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/card`);
};

export const updateCard = async (
  sessionId: string,
  data: { user_note?: string; user_edits?: Record<string, any> }
): Promise<LearningCardData> => {
  return fetchWithAuth(`/api/sessions/${sessionId}/card`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};
