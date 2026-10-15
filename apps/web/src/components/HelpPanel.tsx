"use client";

import { useState } from "react";
import { requestHelp, HelpResponse, SavedAttempt } from "@/lib/api";

interface HelpPanelProps {
  sessionId: string;
  currentCode: string;
  currentNotes: string;
  language: string;
  attempts: SavedAttempt[];
  onHelpReceived?: (res: HelpResponse) => void;
}

export default function HelpPanel({
  sessionId,
  currentCode,
  currentNotes,
  language,
  attempts,
  onHelpReceived,
}: HelpPanelProps) {
  const [activeMode, setActiveMode] = useState<"hint" | "explain" | "example_solution">("hint");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HelpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRequestHelp = async (mode: "hint" | "explain" | "example_solution") => {
    setActiveMode(mode);
    setLoading(true);
    setError(null);

    // Çift tıklamayı engellemek için benzersiz idempotency key
    const idempotencyKey = `${sessionId}-${mode}-${Date.now()}`;

    try {
      const sourceIds = selectedAttemptId ? [selectedAttemptId] : [];
      const res = await requestHelp(
        sessionId,
        {
          mode,
          current_code: currentCode,
          current_notes: currentNotes,
          language,
          source_entry_ids: sourceIds,
        },
        idempotencyKey
      );
      setResponse(res);
      if (onHelpReceived) {
        onHelpReceived(res);
      }
    } catch (err: any) {
      setError(err.message || "Yardım talebi alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-stone-900">Yapay Zekâ Desteği</h3>
          <p className="text-[11px] text-stone-500">
            Yardım almak öğrenmenin doğal bir parçasıdır. İhtiyacın kadar destek alabilirsin.
          </p>
        </div>
        {response?.is_demo && (
          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
            Demo Modu
          </span>
        )}
      </div>

      {/* Güvenlik Uyarısı */}
      <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-[11px] text-stone-600 flex items-start gap-2">
        <span className="text-amber-600 font-bold">ℹ</span>
        <p>
          <strong>Gizlilik Uyarısı:</strong> Koduna parola, API anahtarı veya kişisel veri ekleme. Yardım istediğinde ilgili içerik AI sağlayıcısına gönderilir.
        </p>
      </div>

      {/* Kaynak Deneme Seçimi (Opsiyonel) */}
      {attempts.length > 0 && (
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-stone-700">
            Hangi denemeyi temel alsın? (İsteğe bağlı)
          </label>
          <select
            value={selectedAttemptId}
            onChange={(e) => setSelectedAttemptId(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-stone-50 text-stone-700 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Güncel taslak kodunu ve notlarımı kullan</option>
            {attempts.map((att, i) => (
              <option key={att.id} value={att.id}>
                Deneme #{i + 1} ({att.language || "kod"})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3 Yardım Modu Butonları */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => handleRequestHelp("hint")}
          className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
            activeMode === "hint"
              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-xs"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          } disabled:opacity-50`}
        >
          💡 İpucu Ver
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleRequestHelp("explain")}
          className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
            activeMode === "explain"
              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-xs"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          } disabled:opacity-50`}
        >
          🔍 Mantığını Açıkla
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleRequestHelp("example_solution")}
          className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
            activeMode === "example_solution"
              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-xs"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          } disabled:opacity-50`}
        >
          📋 Örnek Çözüm Göster
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg space-y-2">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => handleRequestHelp(activeMode)}
            className="text-[11px] font-semibold text-red-800 underline hover:no-underline"
          >
            Yeniden Dene ↻
          </button>
        </div>
      )}

      {loading && (
        <div className="py-6 text-center text-xs text-stone-500 animate-pulse">
          Yapay zekâ yanıt hazırlıyor...
        </div>
      )}

      {/* AI Yanıt Alanı */}
      {response && !loading && (
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <span className="text-xs font-bold text-stone-800">
              {response.mode === "hint"
                ? "İpucu"
                : response.mode === "explain"
                ? "Mantık Açıklaması"
                : "Örnek Çözüm Yaklaşımı"}
            </span>
            <span className="text-[10px] text-stone-400">Statik Kod İncelemesi</span>
          </div>

          <div className="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap font-sans space-y-2">
            {response.content}
          </div>

          <div className="pt-2 border-t border-stone-200 text-[10px] text-stone-500 italic">
            {response.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}
