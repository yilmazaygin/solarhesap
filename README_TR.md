# Solarhesap v0.2

**Solarhesap**, yüksek hassasiyetli bir güneş ışınımı simülasyon motoru ve fotovoltaik (FV) modelleme platformudur. Altı ayrı açık-gökyüzü ışınım modelini, çok yıllı meteorolojik veri hatlarını, eksiksiz bir pvlib ModelChain'i, tarihsel üretim analizini ve on beş bağımsız güneş hesaplama aracını tek bir iki dilli (TR/EN) web uygulamasında bir araya getirir.

> **Sunucuya kurmak için** → [DEPLOY_TR.md](DEPLOY_TR.md) · [DEPLOY.md](DEPLOY.md) (İngilizce)

---

## İçindekiler

1. [Özellikler](#özellikler)
2. [Uygulama Sayfaları](#uygulama-sayfaları)
3. [API Endpoint'leri](#api-endpointleri)
4. [Teknoloji Yığını](#teknoloji-yığını)
5. [Hızlı Başlangıç (Docker)](#hızlı-başlangıç-docker)
6. [Geliştirme Ortamı](#geliştirme-ortamı)
7. [Yapılandırma Referansı](#yapılandırma-referansı)
8. [Proje Yapısı](#proje-yapısı)
9. [Bilimsel Atıflar](#bilimsel-atıflar)

---

## Özellikler

### Işınım Modelleri

| Model | Algoritma | Veri Kaynağı |
|---|---|---|
| **INSTESRE Bird** | Bird & Hulstrom (1981) — geniş bant aerosol, Rayleigh saçılması, ozon, su buharı | Open-Meteo tarihsel |
| **Ineichen / Perez** | Linke bulanıklık faktörü tabanlı geniş bant model; pvlib iklim veritabanından otomatik yükleme | Open-Meteo tarihsel |
| **Simplified Solis** | AOD sınır koşulları üzerinden atmosferik geçirgenlik | Open-Meteo tarihsel |
| **pvlib Bird** | pvlib'in Bird açık-gökyüzü model uygulaması | Open-Meteo tarihsel |
| **PVGIS TMY** | AB JRC Tipik Meteorolojik Yıl verisi (SARAH-2 / COSMO-REA6) | PVGIS API |
| **PVGIS POA** | Çok yıllı saatlik düzlem ışınımı — SARAH-2, 2005–2023 | PVGIS API |

### Ortalama Yıl Stratejileri

Çok yıllı saatlik veri setleri (ör. 2005–2023) tek bir sentetik referans yılına dönüştürülebilir:

| Strateji | Açıklama |
|---|---|
| **Simple Mean** | Tüm yılların matematiksel ortalaması |
| **Trimmed Mean** | Yüzdelik kırpma (varsayılan %10–90) ile aykırı yıllar elenir |
| **Exponential Weighted** | İklim kaymasını yakalamak için yakın yıllara üstel ağırlık (varsayılan katsayı 0,9) |
| **Combined Average Year** | Simple Mean + Trimmed Mean + Üstel Ağırlıklı ortalaması |
| **Super Average Year** | Tüm temel stratejilerin konsensüsü |
| **All Strategies** | Tek istekte tüm stratejiler çalıştırılır |

### FV Sistem Simülasyonu (ModelChain)

**pvlib ModelChain** üzerine kurulu uçtan uca FV verim simülasyonu:

| Bileşen | Seçenekler |
|---|---|
| **DC Modeli** | SAPM · CEC · De Soto · PVsyst · PVWatts |
| **AC Modeli** | Sandia · ADR · PVWatts |
| **AOI Kayıp Modeli** | Physical · ASHRAE · SAPM · Martin-Ruiz · Interpolation · No Loss |
| **Spektral Model** | SAPM · First Solar · No Loss |
| **Sıcaklık Modeli** | SAPM · PVsyst · Faiman · Fuentes · NOCT SAM |
| **Modül Veritabanı** | SAM CECMod (21 500+) · SAM SandiaMod (523) · Manuel JSON |
| **Evirici Veritabanı** | SAM CECInverter · SandiaInverter · ADRInverter (toplam 11 000+) · Manuel JSON |

### Tarihsel Üretim Analizi

2005–2022 arasındaki gerçek PVGIS SARAH uydu ışınım verileriyle belirli bir yıl simüle edilir. İki mod:

- **Temel mod** — çatı alanı + verimlilik katmanı (%14–%22) → yıllık/aylık/saatlik kWh tahmini
- **Gelişmiş mod** — SAM veritabanı modül ve eviricilerle tam bileşen düzeyinde simülasyon; gerçek ölçüm verisi (CSV/JSON) yüklenirse simüle–gerçek karşılaştırması yapılır

### Güneş Hesaplama Araçları (15 adet)

| Kategori | Araçlar |
|---|---|
| Tarih & Zaman | Julian Günü · Güneş Deklinasyonu |
| Güneş Pozisyonu | Güneş Pozisyonu (Meeus) · Gün Doğumu/Batımı · Hava Kütlesi (Kasten-Young) |
| Atmosfer | Dünya Dışı Radyasyon · Linke Bulanıklığı · Çiy Noktası → Yoğunlaşabilir Su · İstasyon Basıncı · ISA Basıncı |
| Işınım | Erbs Ayrıştırması (GHI → DNI + DHI) · Anlık Bird · POA Işınımı |
| Geometri | Geliş Açısı · Optimal Eğim |

### Ham Işınım Verisi Dışa Aktarımı

**Işınım Üretici** sayfası, istenen konum ve tarih aralığı için tam saatlik zaman serisi üretir. GHI, DNI, DHI, POA (düzlem ışınımı), sıcaklık ve rüzgar hızı dahil çıktılar CSV veya JSON olarak indirilebilir. PVGIS TMY verisi tam zaman damgalı ve sadeleştirilmiş (gün-saat) formatlarda sunulur.

---

## Uygulama Sayfaları

| Rota | Açıklama |
|---|---|
| `/` | Ana sayfa — özellikler, metodoloji, ekip |
| `/simulation` | Üç sekmeli arayüz: Bireysel Model · Derin Karşılaştırma · Gelişmiş Tahmin (ModelChain) |
| `/modelchain` | Çok dizi desteğiyle bağımsız gelişmiş ModelChain |
| `/irradiance` | Ham ışınım zaman serisi üretici — tarih aralığı seçimi, 6 model, CSV/JSON indirme |
| `/historical` | Tarihsel üretim analizi — Temel ve Gelişmiş mod, gerçek veri yükleme |
| `/calculation` | On beş bağımsız güneş hesaplama aracı |
| `/about` | Proje arka planı, metodoloji, ekip, akademik atıflar |

### Simülasyon Sayfası — Sekme Detayları

**Bireysel Model sekmesi**
- 6 açık-gökyüzü modelinden birini seç
- Etkileşimli harita + manuel enlem/boylam/yükseklik/saat dilimi girişi
- Gün hassasiyetinde tarih aralığı seçimi (maksimum 20 yıl); modele özgü atmosferik parametreler (ozon, AOD500/380/700, albedo, asimetri)
- Ortalama yıl stratejisi seçimi
- Sonuçlar: özet istatistikler, DrillDown ışınım grafiği (yıllık → aylık → günlük → saatlik), veri indirme

**Derin Karşılaştırma sekmesi**
- Birden fazla model ve strateji eş zamanlı çalıştırılır
- Tüm kombinasyonları karşılaştıran özet matris (toplam/ortalama/tepe değer)
- Katmanlı zaman serisi grafiği (Çubuk / Çizgi / Alan) — her seri ayrı ayrı açılıp kapatılabilir

**Gelişmiş Tahmin sekmesi (ModelChain)**
- SAPM / CEC / De Soto / PVWatts DC modelleri ile tam pvlib ModelChain
- Çok dizi desteği (her diziye bağımsız eğim, azimut, montaj şekli atanabilir)
- Modül arama (SAM CECMod/SandiaMod'dan 21 500+ bileşen) veya manuel JSON
- Evirici arama (11 000+ bileşen) veya manuel JSON
- Sıcaklık modeli (SAPM / PVsyst / Faiman / Fuentes / NOCT SAM)
- Hava kaynağı: 6 ışınım modelinden herhangi biri
- Enerji çıkışı drill-down grafiği — Çubuk/Çizgi geçişi ve dönem etiketi
- Ayrıntılı sistem özeti (DC/AC kapasite, DC/AC oranı, string düzeni)

---

## API Endpoint'leri

Tüm rotalar `/api/v1` önekini taşır. `APP_ENV=development` iken `/docs` ve `/redoc` üzerinden API dokümantasyonuna erişilebilir.

### Simülasyon

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/solar-simulation/instesre-bird` | INSTESRE Bird açık-gökyüzü zaman serisi |
| POST | `/solar-simulation/pvlib-ineichen` | Ineichen/Perez açık-gökyüzü zaman serisi |
| POST | `/solar-simulation/pvlib-solis` | Simplified Solis açık-gökyüzü zaman serisi |
| POST | `/solar-simulation/pvlib-bird` | pvlib Bird açık-gökyüzü zaman serisi |
| POST | `/solar-simulation/pvgis-tmy` | PVGIS Tipik Meteorolojik Yıl |
| POST | `/solar-simulation/pvgis-poa` | PVGIS çok yıllık saatlik POA |
| POST | `/solar-simulation/deep-comparison` | Paralel çok model + çok strateji karşılaştırması |
| POST | `/solar-simulation/run-modelchain` | Standart pvlib ModelChain |
| POST | `/solar-simulation/run-modelchain-advanced` | SAM veritabanıyla gelişmiş ModelChain |
| POST | `/solar-simulation/generate-irradiance` | Ham ışınım zaman serisi (6 model) |
| POST | `/solar-simulation/run-basic-electric` | Basit verimlilik tabanlı tahmin |
| POST | `/solar-simulation/run-historical-basic` | Tarihsel simülasyon (verimlilik katmanı) |
| POST | `/solar-simulation/run-historical-advanced` | Tarihsel simülasyon (tam bileşen düzeyi) |

### Hesaplama Araçları

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/solar-tools/julian-day` | Julian Günü hesabı |
| POST | `/solar-tools/solar-declination` | Güneş deklinasyonu (Spencer) |
| POST | `/solar-tools/solar-position` | Zenit, yükseklik, azimut, saat açısı |
| POST | `/solar-tools/sunrise-sunset` | Gün doğumu, batımı, öğle vakti, gün uzunluğu |
| POST | `/solar-tools/airmass` | Hava kütlesi (Kasten-Young / Kasten / Basit) |
| POST | `/solar-tools/extraterrestrial` | Dünya dışı radyasyon |
| POST | `/solar-tools/dew-point-to-pw` | Çiy noktası → yoğunlaşabilir su |
| POST | `/solar-tools/station-pressure` | Yükseklikten atmosfer basıncı |
| POST | `/solar-tools/isa-pressure` | ISA standart atmosfer basıncı |
| POST | `/solar-tools/linke-turbidity` | Linke bulanıklık tahmini |
| POST | `/solar-tools/instant-bird` | Tek nokta INSTESRE Bird ışınımı |
| POST | `/solar-tools/erbs-decomposition` | GHI ayrıştırması (DNI + DHI) |
| POST | `/solar-tools/angle-of-incidence` | Eğimli yüzeyde güneş ışını açısı |
| POST | `/solar-tools/optimal-tilt` | Enleme göre optimal panel eğimi |
| POST | `/solar-tools/poa-irradiance` | Düzlem ışınımı (izotropik model) |

### Yardımcı

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/solar-tools/sam-search` | SAM modül/evirici veritabanı arama |
| GET | `/` | Sağlık kontrolü (`{"status":"ok"}`) |

---

## Teknoloji Yığını

| Katman | Teknolojiler |
|---|---|
| **Backend** | Python 3.12 · FastAPI · pvlib 0.10 · Pydantic v2 · NumPy · pandas · SciPy · uvicorn |
| **Dış API'ler** | Open-Meteo Tarihsel Arşiv · PVGIS (JRC) · SAM bileşen veritabanları |
| **Frontend** | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS v3 |
| **Grafikler** | Recharts (Çubuk / Çizgi / Alan — tümünde drill-down) |
| **Harita** | Leaflet + react-leaflet |
| **Altyapı** | Docker · Docker Compose · Nginx (hız sınırlı ters proxy, güvenlik başlıkları) |
| **Yerelleştirme** | Tam TR / EN iki dilli arayüz |

---

## Hızlı Başlangıç (Docker)

### Gereksinimler

- Docker ≥ 24 ve Docker Compose V2
- 80. port boş olmalı (veya `docker-compose.yml`'de değiştir)

### 1. Klonla

```bash
git clone <repo-url>
cd solarhesap-v0.2
```

### 2. Ortam değişkenlerini ayarla

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Üretim için minimum değişiklikler:

```env
APP_ENV=production
ALLOWED_ORIGINS=https://alanadiniz.com
```

### 3. Derle ve başlat

> **Önemli:** Geliştirme override dosyasını devre dışı bırakmak için `-f` bayrağı zorunludur.

```bash
docker compose -f docker-compose.yml up -d --build
```

İlk build 5–10 dakika sürebilir (Python bağımlılıkları + Next.js derleme).

### 4. Doğrula

```bash
curl http://localhost/api/v1/
# → {"status":"ok","app":"Solarhesap","version":"v0.2.0"}
```

Tarayıcıdan `http://localhost` adresine git.

### 5. Sık kullanılan komutlar

```bash
docker compose ps                               # servis durumu
docker compose logs -f                          # canlı loglar (tüm servisler)
docker compose logs -f backend                  # yalnızca backend
docker compose -f docker-compose.yml down       # durdur ve kaldır
docker compose -f docker-compose.yml up -d --build backend  # yalnızca backend yeniden derle
```

---

## Geliştirme Ortamı

Hot-reload ile frontend ve backend'i çalıştırmak için override dosyasını kullan:

```bash
# docker-compose.yml + docker-compose.override.yml otomatik yüklenir
docker compose up -d --build
```

Override dosyası şunları sağlar:
- `backend/app/` dizinini canlı yeniden yükleme için bağlar (uvicorn `--reload`)
- `frontend/` dizinini Next.js dev sunucusu için bağlar
- `APP_ENV=development` olarak ayarlar (→ `/docs` ve `/redoc` açılır)

### Docker Olmadan (Yerel)

**Backend:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.create_app:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
# .env.local dosyası oluştur:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

---

## Yapılandırma Referansı

Tüm çalışma zamanı ayarları `backend/.env` dosyasındadır (`.env.example`'dan kopyalanır).

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `APP_ENV` | `production` | `development` → `/docs`, `/redoc`, wildcard CORS etkinleşir |
| `APP_VERSION` | `v0.2.0` | API sağlık yanıtında görünür |
| `ALLOWED_ORIGINS` | _(boş)_ | İzin verilen origin'ler, virgülle ayrılmış — ör. `https://alanadiniz.com,https://www.alanadiniz.com`. Boş = wildcard (güvensiz) |
| `PVGIS_BASE_URL` | `https://re.jrc.ec.europa.eu/api/v5_3/` | PVGIS API taban URL'si |
| `OPEN_METEO_BASE_URL` | `https://archive-api.open-meteo.com/v1/archive` | Open-Meteo arşiv URL'si |
| `OPENMETEO_TIMEOUT` | `30` | Open-Meteo istekleri için HTTP zaman aşımı (saniye) |
| `PVGIS_TIMEOUT` | `90` | PVGIS istekleri için HTTP zaman aşımı (saniye) |
| `LOG_BASE_LEVEL` | `INFO` | Log seviyesi (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `LOG_STREAM_HANDLER` | `True` | Logları stdout'a yaz |

### Hız Sınırı (Nginx)

`docker-compose.yml` içindeki `nginx` servisi altında ayarlanır:

```yaml
nginx:
  environment:
    API_RATE_LIMIT: "30"   # dakikada IP başına maksimum istek
```

Yalnızca nginx'i yeniden derleyerek uygula:

```bash
docker compose -f docker-compose.yml up -d --build nginx
```

---

## Proje Yapısı

```
solarhesap-v0.2/
├── backend/
│   ├── app/
│   │   ├── api/v1/                  # FastAPI rota işleyiciler
│   │   │   ├── solar_simulation_routes.py
│   │   │   └── solar_tools_routes.py
│   │   ├── services/                # İş mantığı katmanı
│   │   │   ├── clearsky_service.py
│   │   │   ├── modelchain_service.py
│   │   │   ├── advanced_modelchain_service.py
│   │   │   ├── deep_comparison.py
│   │   │   ├── historical_service.py
│   │   │   ├── irradiance_generator_service.py
│   │   │   ├── basic_electric_service.py
│   │   │   └── solar_tools_service.py
│   │   ├── schemas/                 # Pydantic istek/yanıt modelleri
│   │   ├── instesre_bird/           # INSTESRE Bird model uygulaması
│   │   ├── pvlib_tools/             # pvlib sarmalayıcılar (açık-gökyüzü, ModelChain, SAM)
│   │   ├── average_year/            # Ortalama yıl strateji uygulamaları
│   │   ├── outer_apis/              # PVGIS + Open-Meteo HTTP istemcileri
│   │   └── core/                    # Ayarlar, loglama, hata işleyiciler
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                         # Next.js App Router sayfaları
│   │   ├── page.tsx                 # Ana sayfa
│   │   ├── simulation/page.tsx      # Simülasyon (3 sekme)
│   │   ├── modelchain/page.tsx      # Gelişmiş ModelChain
│   │   ├── irradiance/page.tsx      # Işınım üretici
│   │   ├── historical/page.tsx      # Tarihsel analiz
│   │   ├── calculation/page.tsx     # 15 güneş aracı
│   │   ├── about/page.tsx           # Hakkında
│   │   ├── error.tsx                # Global hata sınırı
│   │   └── not-found.tsx            # 404 sayfası
│   ├── components/
│   │   ├── charts/                  # Recharts sarmalayıcılar
│   │   ├── simulation/              # Harita seçici, form bileşenleri
│   │   ├── layout/                  # Navbar, Footer
│   │   └── shared/                  # Tooltip'ler, yeniden kullanılabilir UI
│   ├── lib/
│   │   ├── api.ts                   # API istemci fonksiyonları
│   │   ├── translations.ts          # TR/EN dize tablosu (650+ anahtar)
│   │   └── constants.ts             # Model ayarları, varsayılanlar
│   └── Dockerfile
├── nginx/
│   ├── nginx.conf.template          # Hız sınırı + güvenlik başlıkları
│   ├── entrypoint.sh
│   └── Dockerfile
├── docker-compose.yml               # Üretim compose
├── docker-compose.override.yml      # Geliştirme override'ları (gitignore'da)
├── DEPLOY.md                        # Kurulum rehberi (İngilizce)
└── DEPLOY_TR.md                     # Kurulum rehberi (Türkçe)
```

---

## Bilimsel Atıflar

- **Bird, R.E. & Hulstrom, R.L. (1981).** *A Simplified Clear Sky Model for Direct and Diffuse Insolation on Horizontal Surfaces.* SERI/TR-642-761, Solar Energy Research Institute. — [instesre.org](https://instesre.org/Solar/BirdModelNew.htm)

- **Ineichen, P. & Perez, R. (2002).** *A new airmass independent formulation for the Linke turbidity coefficient.* Solar Energy, 73(3), 151–157.

- **Reindl, D.T., Beckman, W.A., & Duffie, J.A. (1990).** *Diffuse fraction correlations.* Solar Energy, 45(1), 1–7. *(Solis iletkenlik parametrizasyonu)*

- **Erbs, D.G., Klein, S.A., & Duffie, J.A. (1982).** *Estimation of the diffuse radiation fraction for hourly, daily and monthly-average global radiation.* Solar Energy, 28(4), 293–302.

- **Anderson K., Hansen C., Holmgren W., Jensen A., Mikofski M., Driesse A. (2023).** *pvlib python: 2023 project update.* Journal of Open Source Software, 8(92), 5994. — [DOI: 10.21105/joss.05994](https://doi.org/10.21105/joss.05994)

- **Holmgren W., Hansen C., Mikofski M. (2018).** *pvlib python: a python package for modeling solar energy systems.* Journal of Open Source Software, 3(29), 884. — [DOI: 10.21105/joss.00884](https://doi.org/10.21105/joss.00884)

- **Avrupa Komisyonu, Ortak Araştırma Merkezi (JRC).** *Photovoltaic Geographical Information System (PVGIS) — SARAH-2 veri seti.* — [JRC PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en)

- **Zippenfenig, P. (2023).** *Open-Meteo.com Weather API.* Kesintisiz tarihsel atmosferik veri API'si. — [open-meteo.com](https://open-meteo.com/)

- **Meeus, J. (1991).** *Astronomical Algorithms.* Willmann-Bell. *(Güneş pozisyonu, Julian Günü, zaman denklemi)*

- **Spencer, J.W. (1971).** Fourier series representation of the position of the sun. *Search*, 2(5), 172. *(Güneş deklinasyonu)*

- **Kasten, F. & Young, A.T. (1989).** *Revised optical air mass tables and approximation formula.* Applied Optics, 28(22), 4735–4738.
