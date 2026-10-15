"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getOrCreateCheck,
  submitCheckAttempt,
  skipCheck,
  CheckQuestion,
  getSession,
  SessionItem,
} from "@/lib/api";

export default function CheckPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionItem | null>(null);
  const [check, setCheck] = useState<CheckQuestion | null>(null);
  const [response, setResponse] = useState("");
  const [usedHelp, setUsedHelp] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCheckData();
  }, [sessionId]);

  const loadCheckData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sData, cData] = await Promise.all([
        getSession(sessionId),
        getOrCreateCheck(sessionId),
      ]);
      setSession(sData);
      setCheck(cData);
      if (cData.attempt) {
        setResponse(cData.attempt.response);
      }
    } catch (err: any) {
      setError(err.message || "Öğrenme kontrolü yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!response.trim()) {
      alert("Lütfen yanıtınızı yazın.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await submitCheckAttempt(sessionId, {
        response: response.trim(),
        used_help: usedHelp,
      });
      // Veriyi yeniden çekerek tamamlanan feedback'i göster
      await loadCheckData();
    } catch (err: any) {
      setError(err.message || "Yanıt kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!confirm("Bu oturumda öğrenme kontrolünü atlamak istediğinize emin misiniz? Kartınız kontrolsüz olarak oluşturulacaktır.")) {
      return;
    }

    try {
      setSkipping(true);
      setError(null);
      await skipCheck(sessionId);
      router.push(`/sessions/${sessionId}/card`);
    } catch (err: any) {
      setError(err.message || "Kontrol atlanamadı.");
    } finally {
      setSkipping(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-stone-500">
        Öğrenme kontrolü hazırlanıyor...
      </div>
    );
  }

  if (error && !check) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
          {error}
        </div>
        <Link
          href={`/sessions/${sessionId}`}
          className="inline-block text-xs font-semibold text-indigo-600 hover:underline"
        >
          ← Çalışma Alanına Dön
        </Link>
      </div>
    );
  }

  const isCompleted = check?.status === "completed" && check.attempt;
  const isSkipped = check?.status === "skipped";

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {/* Üst Yönlendirme */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-4">
        <div className="space-y-1">
          <Link
            href={`/sessions/${sessionId}`}
            className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
          >
            ← Çalışma Alanına Dön
          </Link>
          <h1 className="text-xl font-bold text-stone-900">Kısa Öğrenme Kontrolü</h1>
          <p className="text-xs text-stone-500">
            {session?.goal}
          </p>
        </div>

        <Link
          href={`/sessions/${sessionId}/card`}
          className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
        >
          Öğrenme Kartını Gör →
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Soru Kartı */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
            {check?.question_type === "find_bug"
              ? "Hata Bulma Görevi"
              : check?.question_type === "explain_output"
              ? "Sonuç Açıklama"
              : check?.question_type === "complete_code"
              ? "Kodu Tamamlama"
              : "Alternatif Çözüm Görevi"}
          </span>
          <span className="text-[11px] text-stone-400">Tek Kontrol</span>
        </div>

        <div className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed font-sans">
          {check?.question}
        </div>

        {/* İpucu Gösterme */}
        {check?.hint && (
          <div className="pt-2">
            {!showHint ? (
              <button
                type="button"
                onClick={() => {
                  setShowHint(true);
                  setUsedHelp(true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                💡 Bir ipucuna ihtiyacım var
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-bold">İpucu:</span>
                <p>{check.hint}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tamamlanmış Geri Bildirim veya Yanıtlama Formu */}
      {isCompleted ? (
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Kontrol Değerlendirildi
            </span>
            <span className="text-[11px] text-stone-400">
              {check.attempt?.feedback.is_demo ? "Demo Değerlendirmesi" : "AI Değerlendirmesi"}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase text-stone-400">Verdiğin Yanıt:</span>
            <p className="text-xs text-stone-800 p-3 rounded bg-stone-50 border border-stone-200 whitespace-pre-wrap">
              {check.attempt?.response}
            </p>
          </div>

          {/* Geri Bildirim Detayları */}
          <div className="space-y-3 pt-2">
            <div>
              <span className="text-xs font-bold text-emerald-800 block mb-1">
                ✓ Tutarlı Görünen Noktalar:
              </span>
              <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                {check.attempt?.feedback.consistent_points.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>

            {check.attempt?.feedback.missing_points && check.attempt.feedback.missing_points.length > 0 && (
              <div>
                <span className="text-xs font-bold text-amber-800 block mb-1">
                  ! Dikkat Edilebilecek Noktalar:
                </span>
                <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                  {check.attempt.feedback.missing_points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <span className="text-xs font-bold text-stone-800 block mb-1">Kısa Gerekçe:</span>
              <p className="text-xs text-stone-600 leading-relaxed">
                {check.attempt?.feedback.reasoning}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-indigo-700 block mb-1">
                Bir Sonraki Küçük Öneri:
              </span>
              <p className="text-xs text-stone-600 leading-relaxed">
                {check.attempt?.feedback.next_step_tip}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-100 text-[10px] text-stone-400 italic">
              {check.attempt?.feedback.evaluation_limit}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Link
              href={`/sessions/${sessionId}/card`}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Öğrenme Kartını Görüntüle →
            </Link>
          </div>
        </div>
      ) : isSkipped ? (
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm text-center space-y-3">
          <p className="text-xs text-stone-600 font-medium">
            Bu oturumda uygulama kontrolü atlandı.
          </p>
          <Link
            href={`/sessions/${sessionId}/card`}
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Öğrenme Kartına Geç →
          </Link>
        </div>
      ) : (
        /* Yanıtlama Formu */
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="response" className="block text-xs font-bold text-stone-800">
              Senin Yanıtın
            </label>
            <textarea
              id="response"
              rows={5}
              required
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Sorudaki durumu nasıl ele alırsın? Kod veya açıklama şeklinde yazabilirsin..."
              className="w-full text-xs p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-50 leading-relaxed font-sans"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={skipping || submitting}
              onClick={handleSkip}
              className="text-xs text-stone-500 hover:text-stone-800 transition-colors underline"
            >
              {skipping ? "Atlanıyor..." : "Bu kontrolü atla"}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? "Değerlendiriliyor..." : "Yanıtımı Gönder →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
