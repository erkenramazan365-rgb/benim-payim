"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessions, deleteSession, SessionItem } from "@/lib/api";
import { getStoredSession } from "@/lib/auth";

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      router.push("/login");
      return;
    }
    loadSessions();
  }, [router]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSessions();
      setSessions(data);
    } catch (err: any) {
      setError(err.message || "Oturumlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesStatus =
      statusFilter === "all" ? true : s.status === statusFilter;
    const matchesQuery =
      searchQuery.trim() === ""
        ? true
        : s.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.topic && s.topic.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesQuery;
  });


  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert("Silme başarısız: " + (err.message || "Hata"));
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Çalışmalarım</h1>
          <p className="text-xs text-stone-500 mt-1">
            Yapay zekâyla çalıştığın konular, kaydettiğin denemeler ve öğrenme kartların.
          </p>
        </div>
        <Link
          href="/sessions/new"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors self-start sm:self-auto"
        >
          <span>+</span> Yeni Çalışma
        </Link>
      </div>

      {/* Arama ve Filtreleme Çubuğu */}
      {sessions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Oturum veya konu ara..."
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 placeholder-stone-400"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === "all"
                  ? "bg-stone-900 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              Tümü ({sessions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("in_progress")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === "in_progress"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              Devam Edenler ({sessions.filter((s) => s.status === "in_progress").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === "completed"
                  ? "bg-emerald-700 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              Tamamlananlar ({sessions.filter((s) => s.status === "completed").length})
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">
          Çalışmalar yükleniyor...
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-stone-200 p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto text-xl font-bold">
            0
          </div>
          <h3 className="text-base font-semibold text-stone-800">Henüz bir çalışma oturumu oluşturmadınız</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
            Bugün anlamak istediğin bir konuyu belirleyerek başla. Denemelerini kaydet ve öğrendiklerini görünür kıl.
          </p>
          <div className="pt-2">
            <Link
              href="/sessions/new"
              className="inline-flex px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              İlk Çalışmanı Başlat
            </Link>
          </div>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-stone-200 p-6 space-y-2">
          <p className="text-xs text-stone-600">Aramanıza veya seçilen filtreye uygun çalışma oturumu bulunamadı.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            Filtreleri Temizle
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSessions.map((item) => (

            <div
              key={item.id}
              className="p-5 bg-white rounded-xl border border-stone-200 shadow-sm hover:border-stone-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                      item.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    }`}
                  >
                    {item.status === "completed" ? "Tamamlandı" : "Devam Ediyor"}
                  </span>
                  {item.topic && (
                    <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                      {item.topic}
                    </span>
                  )}
                  <span className="text-[11px] text-stone-400">
                    {formatDate(item.updated_at || item.created_at)}
                  </span>
                </div>
                <h3 className="font-semibold text-stone-900 text-base leading-snug truncate">
                  {item.goal}
                </h3>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Link
                  href={`/sessions/${item.id}`}
                  className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition-colors"
                >
                  Devam Et
                </Link>
                <Link
                  href={`/sessions/${item.id}/card`}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors border border-indigo-100"
                >
                  Kartı Görüntüle
                </Link>
                <button
                  onClick={() => setDeleteConfirmId(item.id)}
                  className="px-2.5 py-1.5 text-xs font-medium text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Sil"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Silme Onay Modalı */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-lg border border-stone-200 space-y-4">
            <h4 className="font-bold text-stone-900 text-base">Çalışmayı Sil</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Bu çalışma oturumunu ve kaydedilen tüm denemeleri, AI yardım geçmişini ve öğrenme kartını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
