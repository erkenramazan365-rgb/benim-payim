"use client";

import { useState } from "react";
import { SavedAttempt } from "@/lib/api";

interface AttemptHistoryProps {
  attempts: SavedAttempt[];
  onSelectAttempt?: (attempt: SavedAttempt) => void;
}

export default function AttemptHistory({ attempts, onSelectAttempt }: AttemptHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (attempts.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-stone-50 border border-dashed border-stone-300 text-center">
        <p className="text-xs text-stone-500">
          Henüz kaydedilmiş değişmez bir denemeniz yok. Kendi çözümünüzü dondurmak için &ldquo;Denememi Kaydet&rdquo; butonunu kullanın.
        </p>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
        Kaydedilmiş Denemeler ({attempts.length})
      </h3>
      <div className="space-y-2">
        {attempts.map((att, index) => {
          const isExpanded = expandedId === att.id;
          return (
            <div
              key={att.id}
              className="border border-stone-200 rounded-lg bg-white overflow-hidden text-xs transition-colors"
            >
              <div
                onClick={() => setExpandedId(isExpanded ? null : att.id)}
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-stone-50"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-[10px] border border-indigo-100">
                    {index + 1}
                  </span>
                  <span className="font-medium text-stone-800">
                    Deneme #{index + 1}
                  </span>
                  <span className="text-stone-400 text-[10px]">
                    ({att.language || "kod"})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-400 text-[11px]">{formatDate(att.created_at)}</span>
                  <span className="text-stone-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 border-t border-stone-100 bg-stone-50/70 space-y-2">
                  {att.notes && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400">Deneme Notu:</span>
                      <p className="text-xs text-stone-700 whitespace-pre-wrap mt-0.5">{att.notes}</p>
                    </div>
                  )}
                  {att.code && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400">Kod Kopyası:</span>
                      <pre className="p-2.5 rounded bg-stone-900 text-stone-100 font-mono text-[11px] overflow-x-auto mt-0.5">
                        <code>{att.code}</code>
                      </pre>
                    </div>
                  )}
                  {onSelectAttempt && (
                    <button
                      type="button"
                      onClick={() => onSelectAttempt(att)}
                      className="mt-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Bu denemeyi çalışma alanına geri yükle
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
