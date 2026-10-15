"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  saveDraft,
  saveAttempt,
  getAttempts,
  SessionItem,
  SavedAttempt,
} from "@/lib/api";
import SaveIndicator, { SaveStatus } from "@/components/SaveIndicator";
import HelpPanel from "@/components/HelpPanel";
import AttemptHistory from "@/components/AttemptHistory";

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionItem | null>(null);
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [attempts, setAttempts] = useState<SavedAttempt[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [savingAttempt, setSavingAttempt] = useState(false);

  // Debounce ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  // Oturum ve denemeleri yükle
  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionData, attemptsData] = await Promise.all([
        getSession(sessionId),
        getAttempts(sessionId),
      ]);
      setSession(sessionData);
      setNotes(sessionData.current_notes || "");
      setCode(sessionData.current_code || "");
      setLanguage(sessionData.language || "python");
      setAttempts(attemptsData);
      setSaveStatus("saved");
    } catch (err: any) {
      setError(err.message || "Çalışma alanı yüklenemedi.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
    }
  }, [sessionId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Debounced otomatik taslak kaydı (1000 ms)
  const triggerDebouncedSave = (newNotes: string, newCode: string, newLang: string) => {
    if (isInitialLoad.current) return;
    setSaveStatus("unsaved");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveDraft(sessionId, {
          notes: newNotes,
          code: newCode,
          language: newLang,
        });
        setSaveStatus("saved");
      } catch (err) {
        console.error("Taslak kayıt hatası:", err);
        setSaveStatus("error");
      }
    }, 1000);
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    triggerDebouncedSave(val, code, language);
  };

  const handleCodeChange = (val: string) => {
    setCode(val);
    triggerDebouncedSave(notes, val, language);
  };

  const handleLanguageChange = (val: string) => {
    setLanguage(val);
    triggerDebouncedSave(notes, code, val);
  };

  // Değişmez deneme kaydı oluşturma
  const handleSaveAttempt = async () => {
    try {
      setSavingAttempt(true);
      const newAttempt = await saveAttempt(sessionId, {
        notes,
        code,
        language,
      });
      setAttempts((prev) => [...prev, newAttempt]);
    } catch (err: any) {
      alert("Deneme kaydedilemedi: " + (err.message || "Hata"));
    } finally {
      setSavingAttempt(false);
    }
  };

  // Geçmiş denemeyi çalışma alanına aktarma
  const handleRestoreAttempt = (att: SavedAttempt) => {
    if (confirm("Bu denemedeki not ve kodu çalışma alanına aktarmak istiyor musunuz?")) {
      setNotes(att.notes);
      setCode(att.code);
      setLanguage(att.language);
      triggerDebouncedSave(att.notes, att.code, att.language);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-stone-500">
        Çalışma alanı yükleniyor...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
          {error || "Oturum bulunamadı."}
        </div>
        <Link
          href="/sessions"
          className="inline-block text-xs font-semibold text-indigo-600 hover:underline"
        >
          ← Çalışmalarıma Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Hedef */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/sessions"
              className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
            >
              ← Çalışmalarım
            </Link>
            {session.topic && (
              <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                {session.topic}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight">
            {session.goal}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <SaveIndicator status={saveStatus} />
          <Link
            href={`/sessions/${sessionId}/check`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5"
          >
            Öğrenme Kontrolüne Geç →
          </Link>
        </div>
      </div>

      {/* Ana Çalışma Alanı ve AI Paneli (2 Sütunlu Düzen) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Sol Kolon: Notlar ve Kod Editörü (7 sütun) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Not Alanı */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="notes" className="text-xs font-bold text-stone-800">
                Notların &amp; Düşüncelerin
              </label>
              <span className="text-[11px] text-stone-400">Otomatik taslak kaydı</span>
            </div>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Neyi denemek istiyorsun? Aklındaki mantığı veya karşılaştığın soruyu buraya not et..."
              className="w-full text-xs p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-50 leading-relaxed"
            />
          </div>

          {/* Kod Alanı */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="code" className="text-xs font-bold text-stone-800">
                  Kod Alanı
                </label>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="text-[11px] px-2 py-0.5 border border-stone-300 rounded bg-stone-50 text-stone-700"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="html-css">HTML & CSS</option>
                  <option value="sql">SQL</option>
                  <option value="other">Diğer</option>
                </select>
              </div>

              {/* Denememi Kaydet Butonu */}
              <button
                type="button"
                disabled={savingAttempt}
                onClick={handleSaveAttempt}
                className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>💾</span> {savingAttempt ? "Kaydediliyor..." : "Denememi Kaydet"}
              </button>
            </div>

            {/* Kod Alanı Güvenlik Uyarısı */}
            <div className="p-2 rounded bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900">
              Koduna parola, API anahtarı veya kişisel veri ekleme. Yardım istediğinde ilgili içerik AI sağlayıcısına gönderilir.
            </div>

            <textarea
              id="code"
              rows={12}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="# Kendi çözüm denemeni veya kod taslağını buraya yaz..."
              className="w-full text-xs p-3 font-mono border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-900 text-stone-100 leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Kaydedilmiş Değişmez Denemelerin Geçmişi */}
          <AttemptHistory attempts={attempts} onSelectAttempt={handleRestoreAttempt} />
        </div>

        {/* Sağ Kolon: AI Yardım Paneli (5 sütun) */}
        <div className="lg:col-span-5 space-y-4">
          <HelpPanel
            sessionId={sessionId}
            currentCode={code}
            currentNotes={notes}
            language={language}
            attempts={attempts}
          />
        </div>
      </div>
    </div>
  );
}
