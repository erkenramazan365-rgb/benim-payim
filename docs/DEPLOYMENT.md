# Benim Payım — Canlı Yayınlama ve Dağıtım Rehberi (Supabase + Render + Vercel)

Bu rehber, **“Benim Payım”** web uygulamasını modern ve ücretsiz katmanları bulunan bulut sağlayıcılarında (**Supabase Cloud**, **Render** ve **Vercel**) uçtan uca canlıya almak için adım adım talimatları ve kontrol listesini içerir.

---

## Genel Bakış & Mimari

| Katman | Sağlayıcı | Teknoloji | Görevi |
| :--- | :--- | :--- | :--- |
| **Veritabanı & Auth** | Supabase Cloud | PostgreSQL 15 + RLS + GoTrue Auth | Kullanıcı kayıt/girişi, oturum ve deneme verilerinin güvenli saklanması |
| **Backend API** | Render | FastAPI (Python 3.13) + Uvicorn | Pedagojik AI istekleri (Groq), veri doğrulama ve API köprüsü |
| **Frontend** | Vercel | Next.js 15 App Router + Tailwind CSS | Web arayüzü, SSR/Statik derleme ve kullanıcı deneyimi |
| **Yapay Zekâ** | Groq Cloud | Qwen 2.5 32B / Llama 3.3 70B | ~35ms ultra hızlı pedagojik ipucu ve kart analizi |

---

## 1. Adım: Supabase Cloud Kurulumu (Veritabanı & Kimlik Doğrulama)

1. [supabase.com](https://supabase.com) adresine gidip ücretsiz hesap açın ve **New Project** oluşturun:
   - **Name:** `benim-payim`
   - **Database Password:** Güçlü bir şifre belirleyin ve not edin.
   - **Region:** `Frankfurt (eu-central-1)` (Türkiye'ye en düşük gecikme).
2. Veritabanı Şemasını ve RLS Kurallarını Yükleyin:
   - Sol menüden **SQL Editor** (`>_` simgesi) sekmesini açın.
   - Projedeki [`supabase/migrations/20261015000000_benim_payim_schema.sql`](file:///C:/Users/DELL/.gemini/antigravity/scratch/benim-payim/supabase/migrations/20261015000000_benim_payim_schema.sql) dosyasının tüm içeriğini yapıştırın.
   - **Run** butonuna basın. (6 tablo, indeksler ve RLS politikaları oluşturulacaktır).
3. API ve JWT Bilgilerini Alın:
   - Sol alttan **Project Settings -> API** sayfasına gidin.
   - Şu 3 değeri kopyalayıp bir yere not edin:
     - **Project URL:** `https://xxxxxxxx.supabase.co`
     - **anon public key:** `eyJhbGciOi...`
     - **JWT Secret:** (API sayfasında aşağı kaydırın, *Show JWT Secret* butonuna basıp kopyalayın).

---

## 2. Adım: Render Üzerinde FastAPI Backend Dağıtımı

1. Projeyi kendi GitHub hesabınıza bir repo olarak yükleyin:
   ```bash
   git remote add origin https://github.com/KULLANICI_ADINIZ/benim-payim.git
   git push -u origin master
   ```
2. [render.com](https://render.com) adresinde ücretsiz hesap açın.
3. **New + -> Web Service** seçeneğine tıklayın ve GitHub reponuzu bağlayın.
4. Servis Ayarlarını Yapılandırın:
   - **Name:** `benim-payim-api`
   - **Region:** `Frankfurt (EU Central)`
   - **Root Directory:** `apps/api`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2`
5. **Environment Variables** (Ortam Değişkenleri) sekmesine şu değerleri ekleyin:
   ```env
   ENVIRONMENT=production
   DEBUG=false
   AI_PROVIDER=groq
   GROQ_API_KEY=gsk_your_groq_api_key_here
   GROQ_MODEL=qwen/qwen3.8-27b
   SUPABASE_URL=https://xxxxxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_JWT_SECRET=super-secret-jwt-degeriniz
   ```
6. **Create Web Service** butonuna basın. Render birkaç dakika içinde servisinizi derleyip yayınlayacaktır.
   - Canlı URL'nizi not edin (örn: `https://benim-payim-api.onrender.com`).
   - Sağlık kontrolü için tarayıcıda açın: `https://benim-payim-api.onrender.com/api/health`

---

## 3. Adım: Vercel Üzerinde Next.js Frontend Dağıtımı

1. [vercel.com](https://vercel.com) adresine gidin ve GitHub hesabınızla giriş yapın.
2. **Add New... -> Project** butonuna tıklayın ve aynı GitHub reponuzu seçin.
3. Proje Ayarları:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `Edit` butonuna basıp `apps/web` klasörünü seçin.
4. **Environment Variables** sekmesini açın ve şu değişkenleri ekleyin:
   ```env
   NEXT_PUBLIC_API_URL=https://benim-payim-api.onrender.com
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
5. **Deploy** butonuna basın.
   - Vercel Next.js uygulamanızı optimize ederek yayınlayacaktır (örn: `https://benim-payim.vercel.app`).

---

## 4. Canlı Yayınlama Kontrol Listesi (Smoke Test)

Dağıtım tamamlandıktan sonra şu test akışını takip ederek sistemin çalıştığını doğrulayın:

- [ ] **Ana Sayfa:** `https://benim-payim.vercel.app` açılıyor, başlık ve örnek öğrenme kartı görünüyor mu?
- [ ] **Demo ile Dene:** Giriş sayfasında *"Demo ile Dene"* butonuna tıklandığında hemen test oturumu açılıyor mu?
- [ ] **Gerçek Kayıt:** Yeni bir e-posta ile kayıt olunduğunda Supabase Auth paneline kullanıcı düşüyor mu?
- [ ] **Yeni Çalışma:** *"Python'da liste filtreleme"* hedefiyle yeni oturum başlatılabiliyor mu?
- [ ] **Yapay Zekâ Desteği:** Çalışma alanında *"İpucu Ver"* butonuna basıldığında Groq'tan pedagojik ipucu ~1 saniye içinde geliyor mu?
- [ ] **Öğrenme Kartı:** Oturum tamamlanıp kart sayfasına geçildiğinde AI taslağı ve kullanıcı notu düzgün ayrışıyor mu?

---

## 5. Sorun Giderme (Troubleshooting)

- **CORS Hatası:** FastAPI backend'de `CORS_ORIGIN_REGEX=^https:\/\/.*\.vercel\.app$` tanımı yapılmıştır. Eğer özel bir domain (örn: `benimpayim.com`) kullanıyorsanız, `apps/api/app/config.py` içerisindeki `CORS_ORIGINS` listesine domaininizi ekleyin.
- **Render Soğuk Başlangıç (Cold Start):** Render ücretsiz katmanında 15 dakika istek almayan servisler uyku moduna geçer. İlk istek 20-30 saniye sürebilir; sonraki tüm istekler anında yanıtlanır.
- **Supabase E-posta Onayı:** Supabase Dashboard -> Authentication -> Providers -> Email sekmesinden *"Confirm email"* seçeneğini kapatırsanız kullanıcılar e-posta doğrulaması beklemeden anında oturum açabilir.
