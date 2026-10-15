"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getOrCreateCard, updateCard, LearningCardData } from "@/lib/api";
import { exportCardToMarkdown } from "@/lib/export";

export default function CardPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [card, setCard] = useState<LearningCardData | null>(null);
  const [userNote, setUserNote] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCard();
  }, [sessionId]);

  const loadCard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrCreateCard(sessionId);
      setCard(data);
      setUserNote(data.user_note || "");
    } catch (err: any) {
      setError(err.message || "Öğrenme kartı oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    try {
      setSavingNote(true);
      const updated = await updateCard(sessionId, { user_note: userNote });
      setCard(updated);
      setIsEditingNote(false);
    } catch (err: any) {
      alert("Not kaydedilemedi: " + (err.message || "Hata"));
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-stone-500">
        Öğrenme kartı hazırlanıyor...
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
          {error || "Öğrenme kartı bulunamadı."}
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

  const { ai_draft } = card;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Üst Başlık ve Yönlendirme */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div className="space-y-1">
          <Link
            href="/sessions"
            className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
          >
            ← Tüm Çalışmalarım
          </Link>
          <h1 className="text-2xl font-bold text-stone-900">Öğrenme Kartı</h1>
          <p className="text-xs text-stone-500">
            Bu oturumda denediklerin, aldığın destekler ve gözlenen somut öğrenme kayıtların.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={() => exportCardToMarkdown(card)}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            title="Markdown (.md) olarak bilgisayarına kaydet"
          >
            <span>📥</span> Markdown İndir
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium rounded-lg transition-colors"
            title="Yazdır veya PDF olarak kaydet"
          >
            <span>🖨</span> Yazdır
          </button>
          <Link
            href={`/sessions/${sessionId}`}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-colors"
          >
            Çalışma Alanı
          </Link>
        </div>
      </div>


      {/* Ana Kart Konteyneri */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* 1. Bugünkü Hedef */}
        <div className="space-y-1.5 border-b border-stone-100 pb-4">
          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
            Bugünkü Hedef
          </span>
          <h2 className="text-lg font-bold text-stone-900 leading-snug">
            {ai_draft.goal}
          </h2>
        </div>

        {/* 2. Kaydettiğin Denemeler & Aldığın Destek (2 Kolon) */}
        <div className="grid sm:grid-cols-2 gap-4 border-b border-stone-100 pb-6">
          {/* Denemeler */}
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-2">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <span>💾</span> Kaydettiğin Denemeler
            </span>
            <ul className="text-xs text-stone-600 space-y-1.5">
              {ai_draft.saved_attempts_summary.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-stone-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Destekler */}
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-2">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <span>💡</span> Aldığın AI Desteği
            </span>
            <ul className="text-xs text-stone-600 space-y-1.5">
              {ai_draft.help_summary.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-indigo-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 3. Gözlenen Somut Noktalar (AI Taslağı vs Kaynak Ayrımı) */}
        <div className="space-y-3 border-b border-stone-100 pb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800">
              Gözlenen Somut Noktalar
            </span>
            <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded border border-stone-200">
              Kaynak: AI Taslağı &amp; Oturum Kayıtları
            </span>
          </div>

          <div className="space-y-2">
            {ai_draft.check_observations.map((obs, i) => (
              <div
                key={i}
                className="p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 flex items-start justify-between gap-3"
              >
                <div className="text-xs text-stone-800 leading-relaxed">
                  {obs.observation}
                </div>
                <span className="text-[10px] shrink-0 font-medium px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-600">
                  {obs.source_type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Tekrar Bakılabilecek Konu */}
        <div className="space-y-1.5 border-b border-stone-100 pb-6">
          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
            Tekrar Bakılabilecek Konu
          </span>
          <p className="text-xs text-stone-800 font-medium p-3 rounded-lg bg-stone-50 border border-stone-200">
            {ai_draft.review_topic}
          </p>
        </div>

        {/* 5. Senin Notun (Kullanıcı Düzenlemesi - Ayrı Saklanır) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <span>✍</span> Senin Notun (Kişisel Öğrenme Notun)
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-semibold">
              Kullanıcı Notu
            </span>
          </div>

          {isEditingNote ? (
            <div className="space-y-2">
              <textarea
                rows={4}
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Bu çalışmadan aklında kalan en önemli şey neydi? Kendi kelimelerinle not ekle..."
                className="w-full text-xs p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-stone-50 leading-relaxed font-sans"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={savingNote}
                  onClick={() => {
                    setUserNote(card.user_note || "");
                    setIsEditingNote(false);
                  }}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={savingNote}
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  {savingNote ? "Kaydediliyor..." : "Notu Kaydet"}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 space-y-2">
              {userNote ? (
                <p className="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {userNote}
                </p>
              ) : (
                <p className="text-xs text-stone-400 italic">
                  Henüz kişisel bir not eklemediniz. Bu oturumla ilgili aklınızda kalanları buraya yazabilirsiniz.
                </p>
              )}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingNote(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {userNote ? "Notu Düzenle" : "+ Kendi Notumu Ekle"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Yasal / İlke Sorumluluk Reddi */}
        <div className="pt-4 border-t border-stone-100 text-[10px] text-stone-400 leading-relaxed text-center">
          {ai_draft.disclaimer}
        </div>
      </div>
    </div>
  );
}
