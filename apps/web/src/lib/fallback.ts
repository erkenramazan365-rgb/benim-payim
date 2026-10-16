import {
  getStoredSession,
  isDemoSession,
  isLiveSupabaseConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  UserSession,
} from "./auth";
import type {
  SessionItem,
  SavedAttempt,
  HelpResponse,
  CheckQuestion,
  LearningCardData,
  ObservationItem,
} from "./api";

const DEMO_STORE_KEY = "benim_payim_demo_store_v1";

interface DemoStore {
  sessions: SessionItem[];
  attempts: SavedAttempt[];
  checks: Record<string, CheckQuestion>;
  cards: Record<string, LearningCardData>;
}

function loadDemoStore(): DemoStore {
  if (typeof window === "undefined") {
    return { sessions: [], attempts: [], checks: {}, cards: {} };
  }
  try {
    const raw = localStorage.getItem(DEMO_STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sessions: [], attempts: [], checks: {}, cards: {} };
}

function saveDemoStore(store: DemoStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
  } catch {}
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function supabaseRest(
  session: UserSession,
  table: string,
  method: string = "GET",
  query: string = "",
  body?: any
) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Veritabanı işlemi başarısız (${res.status}): ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function buildPedagogicalHelp(
  mode: "hint" | "explain" | "example_solution",
  goal: string,
  code: string,
  notes: string,
  language: string,
  sourceIds: string[],
  isDemo: boolean
): HelpResponse {
  const cleanGoal = goal || "bu çalışma hedefi";
  const hasCode = Boolean(code && code.trim().length > 5);

  let content = "";
  if (mode === "hint") {
    content =
      `Hedefin (${cleanGoal}) için bir sonraki düşünme adımı:\n\n` +
      (hasCode
        ? `• Mevcut ${language} kodunda veri akışını ve koşul ifadelerini adım adım kontrol et.\n• Döngü veya fonksiyon içindeki değişkenlerin başlangıç ve dönüş değerlerini küçük bir girdiyle test etmeyi dene.\n• Karmaşık kısmı tek bir satırda çözmek yerine önce ara bir değişkene atayarak ilerle.`
        : `• Problemi tek seferde yazmak yerine önce girdi ve beklenen çıktıyı yorum satırı olarak tanımla.\n• En basit örnek veri üzerinde hangi koşulun veya dönüşümün çalışması gerektiğini adım adım listele.`);
  } else if (mode === "explain") {
    content =
      `"${cleanGoal}" konusunun temel mantığı:\n\n` +
      `1. **Problem Parçalama:** Veri üzerinde işlem yaparken önce hangi elemanların seçileceğini (koşul), ardından bu elemanlara ne uygulanacağını ayırmak kodu okunabilir kılar.\n` +
      `2. **Durum Takibi:** ${language.toUpperCase()} dilinde yapıların giriş değerini değiştirip değiştirmediğine (mutability) dikkat etmek beklenmeyen yan etkileri önler.\n` +
      `3. **Doğrulama:** Yazdığın mantığı uç durumlarla (boş liste, tek eleman, beklenen dışı değer) zihinsel olarak veya küçük örneklerle kontrol etmek kavramı sağlamlaştırır.`;
  } else {
    content =
      `"${cleanGoal}" için açıklamalı yaklaşım örneği (${language}):\n\n` +
      (language === "python"
        ? `# 1. Adım: Örnek veri kümesini tanımla\nveriler = [1, 2, 3, 4, 5, 6]\n\n# 2. Adım: Açık koşul ile filtreleme / dönüştürme uygula\nsonuc = []\nfor eleman in veriler:\n    if eleman % 2 == 0:  # Koşul kontrolü\n        sonuc.append(eleman)\n\n# Alternatif kısa yazım (List Comprehension):\n# sonuc = [x for x in veriler if x % 2 == 0]`
        : `// 1. Adım: Veri veya işlemi tanımla\nconst veriler = [1, 2, 3, 4, 5, 6];\n\n// 2. Adım: Koşul ile filtrele veya dönüştür\nconst sonuc = veriler.filter((eleman) => eleman % 2 === 0);`) +
      `\n\nNot: Bu örnek yapıyı kendi değişken adlarına ve problem koşuluna uyarlayarak kendi çözümünü oluşturabilirsin.`;
  }

  return {
    mode,
    content,
    disclaimer: isDemo
      ? "[Demo yanıtı — Kod incelemesine dayalı örnek rehberliktir. Kod çalıştırılmamıştır.]"
      : "Kod ve not incelemesine göre hazırlanmıştır. Kod çalıştırılmamıştır.",
    is_demo: isDemo,
    source_entry_ids: sourceIds,
  };
}

export async function handleFallbackRequest(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const session = getStoredSession();
  if (!session) {
    throw new Error("Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
  }

  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body as string) : {};
  const useLiveDb = !isDemoSession(session) && isLiveSupabaseConfigured();
  const now = new Date().toISOString();

  // 1. GET /api/sessions
  if (path === "/api/sessions" && method === "GET") {
    if (useLiveDb) {
      return await supabaseRest(
        session,
        "learning_sessions",
        "GET",
        `user_id=eq.${session.user_id}&order=created_at.desc`
      );
    }
    const store = loadDemoStore();
    return store.sessions;
  }

  // 2. POST /api/sessions
  if (path === "/api/sessions" && method === "POST") {
    const newSession: SessionItem = {
      id: uuid(),
      user_id: session.user_id,
      title: body.goal.slice(0, 80),
      topic: body.topic || undefined,
      goal: body.goal,
      status: "in_progress",
      current_notes: body.prior_knowledge
        ? `Ön bilgi: ${body.prior_knowledge}\n`
        : "",
      current_code: "",
      language: body.language || "python",
      created_at: now,
      updated_at: now,
    };

    if (useLiveDb) {
      const created = await supabaseRest(session, "learning_sessions", "POST", "", {
        user_id: session.user_id,
        title: newSession.title,
        topic: newSession.topic || null,
        goal: newSession.goal,
        status: "in_progress",
        current_notes: newSession.current_notes,
        current_code: "",
        language: newSession.language,
      });
      return Array.isArray(created) ? created[0] : created;
    }

    const store = loadDemoStore();
    store.sessions.unshift(newSession);
    saveDemoStore(store);
    return newSession;
  }

  // Match /api/sessions/:id...
  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)(?:\/(.*))?$/);
  if (!sessionMatch) {
    throw new Error(`İstenen uç nokta bulunamadı: ${path}`);
  }

  const sessionId = sessionMatch[1];
  const subPath = sessionMatch[2] || "";

  // Helper to get session
  const fetchSessionItem = async (): Promise<SessionItem> => {
    if (useLiveDb) {
      const rows = await supabaseRest(
        session,
        "learning_sessions",
        "GET",
        `id=eq.${sessionId}&user_id=eq.${session.user_id}`
      );
      if (!rows || rows.length === 0) throw new Error("Çalışma oturumu bulunamadı.");
      return rows[0];
    }
    const store = loadDemoStore();
    const found = store.sessions.find((s) => s.id === sessionId);
    if (!found) throw new Error("Çalışma oturumu bulunamadı.");
    return found;
  };

  // 3. GET /api/sessions/:id
  if (!subPath && method === "GET") {
    return await fetchSessionItem();
  }

  // 4. PATCH /api/sessions/:id
  if (!subPath && method === "PATCH") {
    if (useLiveDb) {
      const rows = await supabaseRest(
        session,
        "learning_sessions",
        "PATCH",
        `id=eq.${sessionId}&user_id=eq.${session.user_id}`,
        { ...body, updated_at: now }
      );
      return Array.isArray(rows) ? rows[0] : rows;
    }
    const store = loadDemoStore();
    const idx = store.sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) throw new Error("Oturum bulunamadı.");
    store.sessions[idx] = { ...store.sessions[idx], ...body, updated_at: now };
    saveDemoStore(store);
    return store.sessions[idx];
  }

  // 5. DELETE /api/sessions/:id
  if (!subPath && method === "DELETE") {
    if (useLiveDb) {
      await supabaseRest(
        session,
        "learning_sessions",
        "DELETE",
        `id=eq.${sessionId}&user_id=eq.${session.user_id}`
      );
      return null;
    }
    const store = loadDemoStore();
    store.sessions = store.sessions.filter((s) => s.id !== sessionId);
    store.attempts = store.attempts.filter((a) => a.session_id !== sessionId);
    delete store.checks[sessionId];
    delete store.cards[sessionId];
    saveDemoStore(store);
    return null;
  }

  // 6. POST /api/sessions/:id/draft
  if (subPath === "draft" && method === "POST") {
    const updatePayload = {
      current_notes: body.notes ?? "",
      current_code: body.code ?? "",
      language: body.language || "python",
      updated_at: now,
    };
    if (useLiveDb) {
      const rows = await supabaseRest(
        session,
        "learning_sessions",
        "PATCH",
        `id=eq.${sessionId}&user_id=eq.${session.user_id}`,
        updatePayload
      );
      return Array.isArray(rows) ? rows[0] : rows;
    }
    const store = loadDemoStore();
    const idx = store.sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) throw new Error("Oturum bulunamadı.");
    store.sessions[idx] = { ...store.sessions[idx], ...updatePayload };
    saveDemoStore(store);
    return store.sessions[idx];
  }

  // 7. GET /api/sessions/:id/attempts
  if (subPath === "attempts" && method === "GET") {
    if (useLiveDb) {
      return await supabaseRest(
        session,
        "session_entries",
        "GET",
        `session_id=eq.${sessionId}&user_id=eq.${session.user_id}&entry_type=eq.saved_attempt&order=created_at.asc`
      );
    }
    const store = loadDemoStore();
    return store.attempts.filter((a) => a.session_id === sessionId);
  }

  // 8. POST /api/sessions/:id/attempts
  if (subPath === "attempts" && method === "POST") {
    const currentSession = await fetchSessionItem();
    const newAttempt: SavedAttempt = {
      id: uuid(),
      session_id: sessionId,
      entry_type: "saved_attempt",
      notes: body.notes ?? currentSession.current_notes ?? "",
      code: body.code ?? currentSession.current_code ?? "",
      language: body.language ?? currentSession.language ?? "python",
      created_at: now,
    };
    if (useLiveDb) {
      const rows = await supabaseRest(session, "session_entries", "POST", "", {
        session_id: sessionId,
        user_id: session.user_id,
        entry_type: "saved_attempt",
        notes: newAttempt.notes,
        code: newAttempt.code,
        language: newAttempt.language,
      });
      return Array.isArray(rows) ? rows[0] : rows;
    }
    const store = loadDemoStore();
    store.attempts.push(newAttempt);
    saveDemoStore(store);
    return newAttempt;
  }

  // 9. POST /api/sessions/:id/help
  if (subPath === "help" && method === "POST") {
    const currentSession = await fetchSessionItem();
    const helpRes = buildPedagogicalHelp(
      body.mode || "hint",
      currentSession.goal,
      body.current_code ?? currentSession.current_code,
      body.current_notes ?? currentSession.current_notes,
      body.language ?? currentSession.language,
      body.source_entry_ids || [],
      isDemoSession(session)
    );
    if (useLiveDb) {
      try {
        await supabaseRest(session, "help_requests", "POST", "", {
          session_id: sessionId,
          user_id: session.user_id,
          mode: helpRes.mode,
          source_entry_ids: helpRes.source_entry_ids,
          request_status: "completed",
          validated_response: helpRes,
        });
      } catch {}
    }
    return helpRes;
  }

  // 10. GET or POST /api/sessions/:id/check
  if (subPath === "check" && (method === "GET" || method === "POST")) {
    const currentSession = await fetchSessionItem();
    const store = loadDemoStore();
    if (store.checks[sessionId]) {
      return store.checks[sessionId];
    }
    const checkObj: CheckQuestion = {
      id: uuid(),
      session_id: sessionId,
      question_type: "explain_output",
      question: `"${currentSession.goal}" hedefi doğrultusunda yaptığın çalışmayı düşündüğünde:\n\nKendi yazdığın çözümdeki temel koşulu veya veri akışını farklı bir girdi örneği üzerinde kendi cümlelerinle nasıl açıklarsın?`,
      hint: "Kodundaki en kritik satırın hangi durumda çalıştığını ve ne ürettiğini 1-2 cümleyle belirtebilirsin.",
      status: "pending",
    };
    store.checks[sessionId] = checkObj;
    saveDemoStore(store);
    return checkObj;
  }

  // 11. POST /api/sessions/:id/check/attempt
  if (subPath === "check/attempt" && method === "POST") {
    const store = loadDemoStore();
    const currentSession = await fetchSessionItem();
    const existingCheck = store.checks[sessionId] || {
      id: uuid(),
      session_id: sessionId,
      question_type: "explain_output",
      question: `"${currentSession.goal}" için uygulama kontrolü`,
      status: "pending",
    };
    existingCheck.status = "completed";
    existingCheck.attempt = {
      id: uuid(),
      response: body.response,
      feedback: {
        consistent_points: [
          "Kendi cümlelerinle çözüm yaklaşımını ve mantığını ifade ettin.",
          "Hedeflenen kavramla ilgili temel çalışma adımlarını somutlaştırdın.",
        ],
        missing_points: [
          "Farklı uç durumlar (boş girdi veya beklenmeyen değerler) için ek bir kontrol örneği eklenebilir.",
        ],
        reasoning:
          "Verdiğin açıklama, oturum hedefindeki temel mantıkla uyumlu bir kavrayış ortaya koyuyor.",
        next_step_tip:
          "Aynı yapıyı farklı bir veri kümesi üzerinde yardım almadan tekrar yazmayı dene.",
        evaluation_limit:
          "Statik metin ve kod incelemesine dayalıdır; kod çalıştırılmamıştır.",
        is_demo: isDemoSession(session),
      },
    };
    store.checks[sessionId] = existingCheck;
    saveDemoStore(store);
    return existingCheck;
  }

  // 12. POST /api/sessions/:id/check/skip
  if (subPath === "check/skip" && method === "POST") {
    const store = loadDemoStore();
    const currentSession = await fetchSessionItem();
    store.checks[sessionId] = {
      id: uuid(),
      session_id: sessionId,
      question_type: "explain_output",
      question: `"${currentSession.goal}" kontrol sorusu`,
      status: "skipped",
    };
    saveDemoStore(store);
    return store.checks[sessionId];
  }

  // 13. GET or POST /api/sessions/:id/card
  if (subPath === "card" && (method === "GET" || method === "POST")) {
    const currentSession = await fetchSessionItem();
    const store = loadDemoStore();
    if (store.cards[sessionId]) {
      return store.cards[sessionId];
    }

    let attempts: SavedAttempt[] = [];
    if (useLiveDb) {
      try {
        attempts = await supabaseRest(
          session,
          "session_entries",
          "GET",
          `session_id=eq.${sessionId}&user_id=eq.${session.user_id}&entry_type=eq.saved_attempt`
        );
      } catch {}
    } else {
      attempts = store.attempts.filter((a) => a.session_id === sessionId);
    }

    const checkItem = store.checks[sessionId];
    const observations: ObservationItem[] = [];

    if (attempts.length > 0) {
      observations.push({
        observation: `Bu oturumda ${attempts.length} adet kod/not denemesi kaydedildi.`,
        source_entry_ids: attempts.map((a) => a.id),
        source_type: "kullanıcı denemesi",
      });
    } else if (currentSession.current_code || currentSession.current_notes) {
      observations.push({
        observation: "Çalışma alanında taslak not ve kod çalışması gerçekleştirildi.",
        source_entry_ids: [],
        source_type: "kullanıcı denemesi",
      });
    } else {
      observations.push({
        observation: "Bağımsız uygulama örneği henüz kaydedilmedi.",
        source_entry_ids: [],
        source_type: "kullanıcı beyanı",
      });
    }

    if (checkItem?.status === "completed" && checkItem.attempt) {
      observations.push({
        observation: "Öğrenme kontrolü sorusuna kendi açıklamasıyla yanıt verdi.",
        source_entry_ids: [checkItem.attempt.id],
        source_type: "kontrol yanıtı",
      });
    } else if (checkItem?.status === "skipped") {
      observations.push({
        observation: "Öğrenme kontrolü bu oturumda kullanıcı tarafından atlandı.",
        source_entry_ids: [],
        source_type: "kullanıcı beyanı",
      });
    }

    const cardData: LearningCardData = {
      id: uuid(),
      session_id: sessionId,
      ai_draft: {
        goal: currentSession.goal,
        saved_attempts_summary:
          attempts.length > 0
            ? attempts.map(
                (a, i) =>
                  `Deneme #${i + 1} (${a.language}): ${(a.notes || a.code || "Kayıtlı deneme").slice(0, 90)}`
              )
            : ["Henüz dondurulmuş deneme kaydı eklenmedi (taslak üzerinde çalışıldı)."],
        help_summary: [
          "Çalışma sürecinde pedagojik destek ve açıklama adımları kullanıldı.",
        ],
        check_observations: observations,
        review_topic: `"${currentSession.goal}" konusunu farklı bir örnek veri kümesiyle bağımsız olarak tekrar denemek.`,
        disclaimer:
          "Bu öğrenme kartı statik kod ve oturum kayıtlarının incelenmesine dayanır; kesin beceri veya puan garantisi içermez.",
        is_demo: isDemoSession(session),
      },
      source_references: observations,
      user_edits: {},
      user_note: "",
      created_at: now,
      updated_at: now,
    };

    if (useLiveDb) {
      try {
        await supabaseRest(
          session,
          "learning_sessions",
          "PATCH",
          `id=eq.${sessionId}&user_id=eq.${session.user_id}`,
          { status: "completed", updated_at: now }
        );
      } catch {}
    } else {
      const sIdx = store.sessions.findIndex((s) => s.id === sessionId);
      if (sIdx !== -1) store.sessions[sIdx].status = "completed";
    }

    store.cards[sessionId] = cardData;
    saveDemoStore(store);
    return cardData;
  }

  // 14. PATCH /api/sessions/:id/card
  if (subPath === "card" && method === "PATCH") {
    const store = loadDemoStore();
    const existing = store.cards[sessionId];
    if (!existing) throw new Error("Öğrenme kartı bulunamadı.");
    const updated: LearningCardData = {
      ...existing,
      user_note: body.user_note ?? existing.user_note,
      user_edits: body.user_edits ?? existing.user_edits,
      updated_at: now,
    };
    store.cards[sessionId] = updated;
    saveDemoStore(store);
    return updated;
  }

  throw new Error(`Desteklenmeyen işlem: ${method} ${path}`);
}
