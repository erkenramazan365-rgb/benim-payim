"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredSession } from "@/lib/auth";

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      setIsLoggedIn(true);
    }
  }, []);

  return (
    <div className="py-8 sm:py-16 max-w-4xl mx-auto space-y-16 px-2 sm:px-4">
      {/* Hero Bölümü */}
      <section className="space-y-6 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
          Öğrenme Takip ve Görünürlük Aracı
        </div>
        
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-stone-900 leading-[1.15]">
          Yapay zekâyla çalış. <br />
          <span className="text-indigo-600">Öğrendiklerini görünür kıl.</span>
        </h1>
        
        <p className="text-base sm:text-lg text-stone-600 max-w-2xl leading-relaxed">
          İlk denemeni, aldığın desteği ve çalışma sonunda gösterebildiklerini tek yerde kaydet.
        </p>

        {/* Ana Eylemler */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link
            href={isLoggedIn ? "/sessions/new" : "/login?redirect=/sessions/new"}
            className="inline-flex justify-center items-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Yeni Çalışma Başlat
          </Link>
          <a
            href="#ornek-kart"
            className="inline-flex justify-center items-center px-6 py-3 rounded-lg bg-white border border-stone-300 text-stone-700 font-medium hover:bg-stone-50 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            Örnek Öğrenme Kartını Gör ↓
          </a>
        </div>
      </section>

      {/* 3 Adımlı Anlatım */}
      <section className="space-y-4">
        <div className="text-xs uppercase font-bold tracking-wider text-stone-400">
          Nasıl Çalışır?
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {/* Adım 1 */}
          <div className="p-5 rounded-xl bg-white border border-stone-200 shadow-xs space-y-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
              1
            </div>
            <h2 className="text-sm font-bold text-stone-900">İlk Denemeni Kaydet</h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Notlarını ve ilk kod taslaklarını kaydet; daha sonra gelişiminle karşılaştır. Kendi çözüm arayışın her zaman kayıt altında kalsın.
            </p>
          </div>

          {/* Adım 2 */}
          <div className="p-5 rounded-xl bg-white border border-stone-200 shadow-xs space-y-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
              2
            </div>
            <h2 className="text-sm font-bold text-stone-900">Yapay Zekâdan Destek Al</h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              İhtiyacın kadar destek al: <strong>İpucu</strong>, <strong>Kavram Açıklaması</strong> veya <strong>Örnek Çözüm</strong> modlarından birini seçerek öğrenmeyi sürdür.
            </p>
          </div>

          {/* Adım 3 */}
          <div className="p-5 rounded-xl bg-white border border-stone-200 shadow-xs space-y-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
              3
            </div>
            <h2 className="text-sm font-bold text-stone-900">Öğrendiklerini Gözden Geçir</h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Kısa bir uygulama kontrolüyle somut kanıtlara dayanan, düzenlenebilir öğrenme kartını al ve bir sonraki adımını netleştir.
            </p>
          </div>
        </div>
      </section>

      {/* Örnek Öğrenme Kartı Bölümü */}
      <section id="ornek-kart" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-indigo-600">
              Ürün Çıktısı
            </div>
            <h2 className="text-xl font-bold text-stone-900">Örnek Öğrenme Kartı</h2>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold self-start sm:self-auto">
            <span>ℹ</span> Tanıtım amaçlı örnek veri
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Öğrenme Hedefi */}
          <div className="space-y-1 pb-4 border-b border-stone-100">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              Öğrenme Hedefi
            </span>
            <h3 className="text-lg font-bold text-stone-900">
              Python&rsquo;da liste filtrelemeyi anlamak
            </h3>
          </div>

          {/* İlk Denemem & Aldığım Destek (2 Sütun) */}
          <div className="grid sm:grid-cols-2 gap-4 pb-4 border-b border-stone-100">
            <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <span>📝</span> İlk Denemem
              </span>
              <p className="text-xs text-stone-600 leading-relaxed">
                Listeyi klasik döngüyle gezdim, fakat filtreleme koşulunu oluştururken zorlandım.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-indigo-50/60 border border-indigo-100 space-y-1.5">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <span>💡</span> Aldığım Destek
              </span>
              <p className="text-xs text-indigo-800 leading-relaxed">
                Koşulun nasıl kurulacağına ilişkin bir ipucu: modulo operatörüyle çift sayıları ayırma mantığı.
              </p>
            </div>
          </div>

          {/* Sonraki Denemem */}
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <span>🔄</span> Sonraki Denemem
            </span>
            <p className="text-xs text-stone-600 leading-relaxed">
              İpucundan sonra farklı bir sayı listesine uygun filtreleme koşulunu bağımsız olarak yazdım ve çalıştığını doğruladım.
            </p>
          </div>

          {/* Bu Örnekte Gözlenen Somut Beceri */}
          <div className="space-y-2 pb-4 border-b border-stone-100">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              Bu Çalışmada Gözlenen
            </span>
            <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5">
              <span className="text-emerald-700 font-bold text-sm">✓</span>
              <div className="text-xs text-emerald-900 leading-relaxed">
                <strong>Verilen koşulu yeni bir örneğe uygulama:</strong> Kullanıcı aldığı ipucunu doğrudan kopyalamak yerine yeni değişkenler ve liste yapısı üzerinde uygulayabildi.
              </div>
            </div>
          </div>

          {/* Sonraki Adım */}
          <div className="space-y-1 pb-2">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              Sonraki Adım / Tekrar Bakılabilecek Konu
            </span>
            <p className="text-xs text-stone-700 bg-stone-50 p-3 rounded-lg border border-stone-200 leading-relaxed">
              Aynı işlemi daha sade bir sözdizimiyle list comprehension kullanarak denemek.
            </p>
          </div>

          <div className="text-[11px] text-stone-400 border-t border-stone-100 pt-3 text-center">
            Statik kod ve beyan incelemesine dayalı örnek kart çıktısıdır. Yapay zekâ veya puanlama garantisi içermez.
          </div>
        </div>
      </section>

      {/* İlkeler Alanı */}
      <section className="p-5 rounded-xl bg-stone-100/90 border border-stone-200 text-xs text-stone-600 space-y-2">
        <h2 className="font-semibold text-stone-800 text-sm">Benim Payım İlkeleri</h2>
        <ul className="space-y-1.5 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">•</span>
            <span><strong>Yardım almak öğrenmenin doğal bir parçasıdır:</strong> AI kullanımı başarısızlık veya eksiklik göstergesi değildir.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">•</span>
            <span><strong>Çıkarımlar somut örneklere dayanır:</strong> Kanıtsız puan, yüzdelik başarı veya uydurma beceri skoru üretilmez.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">•</span>
            <span><strong>Statik inceleme ile sınırlıdır:</strong> Kodunuz arka planda çalıştırılmaz; değerlendirme kullanıcının sağladığı kod ve açıklamalara dayanır.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
