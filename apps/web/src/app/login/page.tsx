"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setStoredSession, isLiveSupabaseConfigured, supabase } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/sessions";

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Demo modu için pratik token üretici (Yerel geliştirme ve test için)
  const createDemoToken = (userEmail: string) => {
    const userId = "11111111-2222-3333-4444-555555555555";
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(
      JSON.stringify({
        sub: userId,
        email: userEmail,
        aud: "authenticated",
        role: "authenticated",
        iat: now,
        exp: now + 86400 * 7,
      })
    );
    return `${header}.${payload}.mock-signature-or-token`;
  };

  const handleSuccessfulAuth = (user_id: string, userEmail: string, token: string) => {
    setStoredSession({
      user_id,
      email: userEmail,
      token,
    });
    router.push(redirectTarget);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (!email.trim() || !email.includes("@")) {
        throw new Error("Lütfen geçerli bir e-posta adresi girin.");
      }
      if (password.length < 6) {
        throw new Error("Şifre en az 6 karakter olmalıdır.");
      }

      if (isLiveSupabaseConfigured()) {
        if (isRegister) {
          const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
          });
          if (signUpError) throw signUpError;
          if (data.session) {
            handleSuccessfulAuth(data.user!.id, data.user!.email!, data.session.access_token);
            return;
          } else {
            setSuccessMessage("Kayıt başarılı! E-posta adresinize bir onay bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edip bağlantıya tıklayarak hesabınızı etkinleştirin.");
            setIsRegister(false);
            setLoading(false);
            return;
          }
        } else {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError) throw signInError;
          handleSuccessfulAuth(data.user.id, data.user.email!, data.session.access_token);
          return;
        }
      } else {
        // Yerel Demo Modu: Backend'den imzalı token al
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/demo-token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email.trim() }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            handleSuccessfulAuth(data.user_id, data.email, data.access_token);
            return;
          }
        } catch (fetchErr) {
          console.warn("Backend demo token alınamadı, yerel üretiliyor:", fetchErr);
        }

        const token = createDemoToken(email.trim());
        handleSuccessfulAuth("11111111-2222-3333-4444-555555555555", email.trim(), token);
      }
    } catch (err: any) {
      setError(err.message || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    const demoEmail = "ogrenci@benimpayim.dev";
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/demo-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: demoEmail }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        handleSuccessfulAuth(data.user_id, data.email, data.access_token);
        return;
      }
    } catch {}

    const token = createDemoToken(demoEmail);
    handleSuccessfulAuth("11111111-2222-3333-4444-555555555555", demoEmail, token);
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          {isRegister ? "Hesap Oluştur" : "Giriş Yap"}
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          {isRegister
            ? "Öğrenme oturumlarınızı takip etmek ve kartlarınızı saklamak için kayıt olun."
            : "Kaldığınız yerden devam etmek için giriş yapın."}
        </p>
      </div>

      {successMessage && (
        <div role="status" className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-emerald-900">
            <span>✓</span> {successMessage}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="email-input">
            E-posta Adresi <span className="text-red-500">*</span>
          </label>
          <input
            id="email-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@alanadi.com"
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-stone-50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="password-input">
            Şifre <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="password-input"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              className="w-full px-3 py-2 pr-10 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-stone-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none focus:text-stone-700"
            >
              {showPassword ? (
                // Göz kapalı / gizle ikonu
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                // Göz açık / göster ikonu
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          {loading ? "Lütfen bekleyin..." : isRegister ? "Kayıt Ol" : "Giriş Yap"}
        </button>
      </form>

      <div className="pt-1 text-center text-xs text-stone-600">
        {isRegister ? (
          <p>
            Zaten bir hesabınız var mı?{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Giriş Yap
            </button>
          </p>
        ) : (
          <p>
            Hesabınız yok mu?{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Kayıt Ol
            </button>
          </p>
        )}
      </div>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-stone-400">veya</span>
        </div>
      </div>

      {/* Demo ile Dene Butonu */}
      <div className="space-y-1.5">
        <button
          type="button"
          disabled={loading}
          onClick={handleQuickDemoLogin}
          className="w-full py-2.5 px-3 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-50"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Demo ile Dene
        </button>
        <p className="text-[11px] text-stone-400 text-center">
          Kayıt olmadan uygulamayı hemen incelemek için hazır demo oturumu açar.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <Suspense fallback={<div className="py-20 text-center text-xs text-stone-400">Yükleniyor...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
