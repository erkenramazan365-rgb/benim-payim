"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getStoredSession,
  setStoredSession,
  syncSupabaseSession,
  supabase,
  isLiveSupabaseConfigured,
  UserSession,
} from "@/lib/auth";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSession(getStoredSession());
    setMounted(true);

    // Eğer kullanıcı e-posta onay bağlantısından döndüyse Supabase oturumunu senkronize et
    syncSupabaseSession().then((synced) => {
      if (synced) setSession(synced);
    });

    const handleAuthChange = () => {
      setSession(getStoredSession());
    };
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("benim-payim-auth-change", handleAuthChange);

    let subscription: { unsubscribe: () => void } | null = null;
    if (isLiveSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange((_event, supaSession) => {
        if (supaSession?.user) {
          const updated: UserSession = {
            user_id: supaSession.user.id,
            email: supaSession.user.email || "",
            token: supaSession.access_token,
          };
          setStoredSession(updated);
          setSession(updated);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("benim-payim-auth-change", handleAuthChange);
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (isLiveSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    setStoredSession(null);
    setSession(null);
    router.push("/login");
  };

  const isSessionsActive = pathname?.startsWith("/sessions");

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo ve Ürün Adı */}
        <Link href="/" className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs group-hover:bg-indigo-700 transition-colors">
            P
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-stone-900 tracking-tight text-lg">Benim Payım</span>
            <span className="hidden sm:inline-block text-xs text-stone-500 font-medium">Öğrenme Takibi</span>
          </div>
        </Link>

        {/* Sağ Gezinme Alanı */}
        <nav className="flex items-center gap-3 sm:gap-4" aria-label="Ana Gezinme">
          {!mounted ? (
            // Yükleme sırasında görsel titremeyi önlemek için nötr yer tutucu
            <div className="h-8 w-20 bg-stone-100 rounded-md animate-pulse" />
          ) : session ? (
            <>
              <Link
                href="/sessions"
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isSessionsActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
                aria-current={isSessionsActive ? "page" : undefined}
              >
                Çalışmalarım
              </Link>
              
              <span className="text-xs text-stone-300 hidden sm:inline" aria-hidden="true">|</span>
              
              <span
                className="text-xs text-stone-500 hidden sm:inline-block max-w-[140px] md:max-w-[200px] truncate"
                title={session.email}
              >
                {session.email}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-medium text-stone-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-red-200 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Oturumu Kapat"
              >
                Çıkış Yap
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Giriş Yap
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
