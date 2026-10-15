"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession } from "@/lib/api";

const SUGGESTED_GOALS = [
  "Python'da liste filtrelemeyi anlamak",
  "JavaScript'te async/await hata yönetimini çözmek",
  "API yanıtındaki verileri güvenle işlemek",
];

export default function NewSessionPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [topic, setTopic] = useState("");
  const [priorKnowledge, setPriorKnowledge] = useState("");
  const [language, setLanguage] = useState("python");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setError("Lütfen neyi anlamak istediğinizi belirtin (yalnızca boşluk bırakılamaz).");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const created = await createSession({
        goal: trimmedGoal,
        topic: topic.trim() || undefined,
        prior_knowledge: priorKnowledge.trim() || undefined,
        language,
      });
      // Başarılı olunca doğrudan çalışma alanına yönlendir
      router.push(`/sessions/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Çalışma oturumu başlatılamadı. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  const handleChipClick = (suggested: string) => {
    setGoal(suggested);
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6 px-2 sm:px-0">
      <div className="space-y-1">
        <Link
          href="/sessions"
          className="text-xs text-stone-500 hover:text-stone-800 transition-colors inline-flex items-center gap-1 focus:outline-none focus:underline"
        >
          ← Çalışmalarıma Dön
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">Yeni Bir Çalışma Başlat</h1>
        <p className="text-xs text-stone-500">
          Oturum hedefini belirle, denemelerini kaydet ve yapay zekâyla öğrenmeni somutlaştır.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-7 rounded-xl border border-stone-200 shadow-sm space-y-5">
        {/* Hedef */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="goal" className="block text-xs font-semibold text-stone-800">
              Bugün neyi anlamak istiyorsun? <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-stone-400">
              {goal.length}/200
            </span>
          </div>
          <input
            id="goal"
            type="text"
            required
            maxLength={200}
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Örn: Python'da liste filtrelemeyi anlamak"
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-50"
          />
          
          {/* Öneri Çipleri */}
          <div className="space-y-1 pt-1">
            <span className="text-[11px] text-stone-400 block">Örnek hedefler (tıklayarak seçebilirsiniz):</span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_GOALS.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(suggestion)}
                  className="text-[11px] px-2.5 py-1 bg-stone-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-stone-600 rounded-full border border-stone-200 transition-colors text-left"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
          
          <p className="text-[11px] text-stone-500">
            İpucu: Geniş hedefler yerine odaklı hedefler belirleyin (örn: &ldquo;Python öğrenmek&rdquo; yerine &ldquo;Python&rsquo;da liste filtrelemeyi anlamak&rdquo;).
          </p>
        </div>

        {/* Konu (Opsiyonel) */}
        <div className="space-y-1.5">
          <label htmlFor="topic" className="block text-xs font-semibold text-stone-800">
            Konu / Alan (İsteğe bağlı)
          </label>
          <input
            id="topic"
            type="text"
            maxLength={100}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Örn: Veri Yapıları, API İstekleri, Döngüler"
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-50"
          />
        </div>

        {/* Ön Bilgi (Opsiyonel) */}
        <div className="space-y-1.5">
          <label htmlFor="priorKnowledge" className="block text-xs font-semibold text-stone-800">
            Şu anda ne biliyorsun? (İsteğe bağlı)
          </label>
          <textarea
            id="priorKnowledge"
            rows={3}
            maxLength={600}
            value={priorKnowledge}
            onChange={(e) => setPriorKnowledge(e.target.value)}
            placeholder="Örn: Klasik for döngüsüyle elemanları tek tek gezebiliyorum ama filtreleme koşulunu kısa yazmakta zorlanıyorum."
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-50 leading-relaxed"
          />
        </div>

        {/* Programlama Dili */}
        <div className="space-y-1.5">
          <label htmlFor="language" className="block text-xs font-semibold text-stone-800">
            Programlama Dili
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-50"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="html-css">HTML & CSS</option>
            <option value="sql">SQL</option>
            <option value="other">Diğer</option>
          </select>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <Link
            href="/sessions"
            className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            İptal
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {loading ? "Oturum Başlatılıyor..." : "Çalışmayı Başlat →"}
          </button>
        </div>
      </form>
    </div>
  );
}
