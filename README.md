# Benim Payım

> **“Yapay zekâyla çalış. Öğrendiklerini görünür kıl.”**

Benim Payım, yapay zekâ ile kod öğrenen kişilerin neyi kendilerinin denediğini, nerede destek aldığını ve öğrendiklerini nasıl uyguladığını görmelerine yardımcı olan Türkçe bir web uygulamasıdır.

Hedef kullanıcının problemi:  
*“AI ile projeyi tamamladım ama gerçekten ne öğrendim, emin değilim.”*

---

## 1. Temel Ürün İlkeleri

- **Terapi uygulaması değildir.**
- **Yetkinlik sertifikası veya sınav motoru değildir.**
- **AI kullanımını suçluluk kaynağı hâline getirmez:** Yardım almak normal ve geçerli bir öğrenme davranışıdır.
- **Kanıtsız iddia üretmez:** Kullanıcıya yüzde, başarı puanı, katkı oranı veya “artık kesin biliyorsun” gibi temelsiz iddialar üretilmez.
- **Kod çalıştırma altyapısı içermez:** Kodlar sunucuda çalıştırılmaz; statik pedagojik incelemeye ve gözlemlere dayanır.

---

## 2. Kesin MVP Kapsamı (5 Temel İşlev)

1. **Çalışma oturumu oluşturma ve listeleme** (`learning_sessions`)
2. **Not, kod ve kaydedilmiş değişmez deneme kaydı** (`session_entries`: 1000 ms debounced taslak vs. değişmez `saved_attempt`)
3. **Üç AI yardım modu** (`hint`, `explain`, `example_solution`)
4. **Oturum başına tek kısa öğrenme kontrolü** (görev üretme, yanıtlama, ipucu alma veya dürüst atlama)
5. **Oturum başına tek düzenlenebilir öğrenme kartı** (orijinal AI taslağı, doğrulanmış kaynak referansları ve kullanıcı kişisel notunun ayrı saklanması)

---

## 3. Mimari ve Dizin Yapısı

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, `@supabase/supabase-js` (yalnızca Auth)
- **Backend:** FastAPI, Pydantic v2, Python 3.13, PyJWT
- **Veritabanı & RLS:** Supabase PostgreSQL (`auth.uid() = user_id`), SQL migration dosyaları repository'de
- **Veri Erişimi:** İkinci bir ORM (SQLAlchemy vb.) yoktur. Kullanıcının doğrulanmış JWT bearer token'ı Supabase PostgREST Data API'sine iletilir.
- **AI Erişimi:** Backend üzerinden tek sağlayıcı adapter'ı (Gemini) + anahtarsız çevrimdışı çalışma için açıkça etiketlenmiş deterministik Demo Adapter.

```
benim-payim/
├── apps/
│   ├── api/                            # FastAPI Backend
│   │   ├── app/
│   │   │   ├── auth/                   # Supabase JWT doğrulayıcısı & get_current_user
│   │   │   ├── db/                     # PostgREST Data API client & Local RLS Store
│   │   │   ├── ai/                     # Şemalar, Demo Adapter, Gemini Adapter, Doğrulayıcı
│   │   │   ├── middleware/             # Idempotency-Key önbelleği & Rate Limiter
│   │   │   └── routers/                # sessions, help, checks, cards
│   │   ├── tests/                      # 26 adet pytest birim ve entegrasyon testi
│   │   └── requirements.txt
│   │
│   └── web/                            # Next.js Frontend
│       ├── src/
│       │   ├── app/                    # App Router (login, sessions, [id], check, card)
│       │   ├── components/             # Navbar, SaveIndicator, HelpPanel, AttemptHistory
│       │   └── lib/                    # Supabase Auth client singleton & API istemcisi
│       └── package.json
│
├── supabase/
│   └── migrations/                     # 6 tablo, kısıtlar, tetikleyiciler ve RLS politikaları
├── docs/                               # Detaylı mimari ve dokümanlar
├── .env.example
└── README.md
```

---

## 4. Hızlı Başlangıç (Yerel Demo Modu)

Uygulama, harici bir Supabase veya Gemini hesabı olmadan da **tek tıkla test edilebilecek şekilde** yapılandırılmıştır.

### 1. Backend'i Başlatma

```bash
cd apps/api
# Sanal ortamı aktive edin (Windows PowerShell):
.\.venv\Scripts\Activate.ps1
# Bağımlılıklar kurulu değilse:
pip install -r requirements.txt
# Sunucuyu başlatın (Port 8000):
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Sağlık kontrolü: `http://127.0.0.1:8000/api/health`

### 2. Frontend'i Başlatma

```bash
cd apps/web
# Bağımlılıklar kurulu değilse:
npm install
# Geliştirme veya prodüksiyon sunucusunu başlatın (Port 3000):
npm run start -- -p 3000   # veya npm run dev
```
Arayüze erişim: `http://localhost:3000`

### 3. Hızlı Test Adımları
1. `http://localhost:3000/login` adresine gidin.
2. **"Hızlı Demo Hesabıyla Giriş Yap"** butonuna tıklayın (otomatik test token'ı üretilir).
3. "Yeni Çalışma" butonuna basarak bir hedef yazın (örn: *Python'da liste filtreleme*).
4. Kod alanına kod yazın; üstteki durum göstergesinin 1 saniye sonra `Taslak kaydedildi` olduğunu görün.
5. **"Denememi Kaydet"** butonuna basarak 1. denemeyi dondurun.
6. Sağdaki AI panelinden **"💡 İpucu Ver"**, **"🔍 Mantığını Açıkla"** veya **"📋 Örnek Çözüm Göster"** butonlarına basın.
7. **"Öğrenme Kontrolüne Geç"** butonuna basıp tek soruluk görevi yanıtlayın (veya atlayın).
8. **"Öğrenme Kartı"** ekranında AI taslağı ile kendi notunuzu karşılaştırıp kaydedin.

---

## 5. Gerçek Supabase ve Gerçek AI Sağlayıcısını Etkinleştirme

### Supabase Kurulumu:
1. [supabase.com](https://supabase.com) üzerinde yeni bir proje oluşturun.
2. Supabase SQL Editor'ü açın ve [`supabase/migrations/20261015000000_benim_payim_schema.sql`](file:///C:/Users/DELL/.gemini/antigravity/scratch/benim-payim/supabase/migrations/20261015000000_benim_payim_schema.sql) dosyasındaki SQL sorgularını çalıştırın.
3. Supabase Dashboard -> **Project Settings -> API & Auth** bölümünden URL, Anon Key ve JWT Secret değerlerini kopyalayın.
4. `apps/api/.env` dosyasını oluşturup ekleyin:
   ```env
   SUPABASE_URL=https://projeniz.supabase.co
   SUPABASE_ANON_KEY=proje-anon-key
   SUPABASE_JWT_SECRET=proje-jwt-secret
   ```
5. `apps/web/.env.local` dosyasını oluşturup ekleyin:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://projeniz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=proje-anon-key
   ```

### Google Gemini AI Kurulumu:
1. [Google AI Studio](https://aistudio.google.com/) üzerinden API anahtarı alın.
2. `apps/api/.env` dosyasına ekleyin:
   ```env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-2.5-flash
   ```

---

## 6. Testlerin Çalıştırılması

Tüm testler FastAPI, JWT doğrulama, RLS çapraz kullanıcı izolasyonu ve AI şemalarını kapsar:

```bash
cd apps/api
.\.venv\Scripts\pytest -v
```

### Test Çıktısı (26/26 Başarılı):
- `tests/test_auth.py`: JWT imza, exp, aud, sub ve sahte token reddi (5 test)
- `tests/test_sessions.py`: Oturum oluşturma, listeleme, güncelleme, silme ve RLS izolasyonu (2 test)
- `tests/test_entries.py`: Debounced taslak kaydı, deneme değişmezliği (immutability), çapraz kullanıcı engeli (3 test)
- `tests/test_help.py`: 3 yardım modu, sahte kaynak ID reddi, idempotency çift tıklama önleme, hız sınırı (4 test)
- `tests/test_checks.py`: Tek kontrol üretimi, yanıtlama, gerekçeli geri bildirim, dürüst atlama, RLS izolasyonu (3 test)
- `tests/test_cards.py`: Kart üretimi, AI taslağı vs kullanıcı notu ayrımı, atlanan kontrol gözlemi, RLS (3 test)
- `tests/test_rls_deep_isolation.py`: Çocuk tablolara yetkisiz satır ekleme engeli ve kaskad silme (2 test)
- `tests/test_ai_adapter.py`: Demo adapter etiketleri ve kaynak referansı doğrulayıcı (3 test)
- `tests/test_e2e_flow.py`: Tam uçtan uca kullanıcı yaşam döngüsü testi (1 test)

---

## 7. Demo ve Canlı Parçalar Ayrımı Raporu

| Parça | Demo Durumunda | Canlı Yapılandırmada |
| :--- | :--- | :--- |
| **Kimlik Doğrulama** | Hızlı demo token'ı (`ogrenci@benimpayim.dev`) ile RLS ve yetkilendirme doğrulanır. | Resmî Supabase Auth e-posta/şifre doğrulaması çalışır. |
| **Veri Tabanı & RLS** | PostgREST Data API ve PostgreSQL RLS kurallarını birebir yürüten yerel RLS motoru devrededir. | Supabase PostgreSQL veritabanı doğrudan PostgREST üzerinden kullanıcı JWT'si ile çalışır. |
| **AI Değerlendirmesi** | Açıkça `[Demo yanıtı — gerçek AI değerlendirmesi değildir.]` etiketi taşıyan deterministik Türkçe model devrededir. | Google Gemini REST API'si Pydantic şema zorlaması ve prompt injection filtresiyle çalışır. |

---

## 8. Bilinen Sınırlamalar

1. **Kod Çalıştırma Yok:** Sistem güvenlik ve ürün ilkeleri gereği kodları bir sandbox'ta fiilen çalıştırmaz; statik inceleme yapar.
2. **Tek Kontrol & Tek Kart:** Oturum başına bilerek tek bir kontrol ve tek bir öğrenme kartı kısıtı uygulanmıştır (MVP pedagojik sadeliği).
3. **Maksimum Girdi Limiti:** DoS ve token şişmesini önlemek amacıyla not ve kod alanları istek başına 15.000 karakterle sınırlandırılmıştır.
