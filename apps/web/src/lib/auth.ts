import { createClient, SupabaseClient } from "@supabase/supabase-js";

function sanitizeEnvValue(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const firstToken = raw.trim().split(/\s+/)[0];
  return firstToken || fallback;
}

const DEFAULT_SUPABASE_URL = "https://sfoppatbaiaycxijcrzq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmb3BwYXRiYWlheWN4aWpjcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODE1ODEsImV4cCI6MjEwNzY1NzU4MX0.MhW1Ossu9bp-P4p66Kq17ygQiWou729Frzm7yAcl5aQ";

export const SUPABASE_URL = sanitizeEnvValue(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  DEFAULT_SUPABASE_URL
);
export const SUPABASE_ANON_KEY = sanitizeEnvValue(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_ANON_KEY
);

// Gerçek Supabase projesi tanımlı mı?
export const isLiveSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
      !SUPABASE_URL.includes("localhost") &&
      !SUPABASE_URL.includes("your-project-id") &&
      SUPABASE_ANON_KEY &&
      SUPABASE_ANON_KEY !== "demo-anon-key"
  );
};

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface UserSession {
  user_id: string;
  email: string;
  token: string;
}

const STORAGE_KEY = "benim_payim_session";

export const getStoredSession = (): UserSession | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setStoredSession = (session: UserSession | null) => {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  window.dispatchEvent(new Event("benim-payim-auth-change"));
};

export const syncSupabaseSession = async (): Promise<UserSession | null> => {
  if (typeof window === "undefined" || !isLiveSupabaseConfigured()) {
    return getStoredSession();
  }
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      const synced: UserSession = {
        user_id: data.session.user.id,
        email: data.session.user.email || "",
        token: data.session.access_token,
      };
      setStoredSession(synced);
      return synced;
    }
  } catch {}
  return getStoredSession();
};

export const isDemoSession = (session: UserSession | null): boolean => {
  if (!session) return false;
  return (
    session.email === "ogrenci@benimpayim.dev" ||
    session.token.includes("mock-signature") ||
    session.user_id === "11111111-2222-3333-4444-555555555555"
  );
};
