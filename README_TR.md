# Solarhesap v0.2

**Solarhesap**, **TÜBİTAK 2209-A** kapsamında geliştirilen yüksek hassasiyetli bir güneş ışınımı simülasyon motoru ve fotovoltaik (FV) modelleme platformudur. Birden fazla açık gökyüzü modelini, çok yıllı meteorolojik veri hatlarını ve eksiksiz bir PVLib ModelChain'i tek bir web uygulamasında bir araya getirir.

> Sunucu kurulum adımları için bkz. [DEPLOY.md](DEPLOY.md).

---

## Özellikler

### Simülasyon Modelleri
| Model | Açıklama |
|---|---|
| **INSTESRE Bird** | Bird & Hulstrom (1981) açık gökyüzü — geniş bant aerosol, Rayleigh saçılması, ozon, yoğunlaşabilir su |
| **Ineichen / Perez** | Linke Bulanıklık faktörü tabanlı geniş bant model, pvlib veritabanından otomatik yükleme |
| **Simplified Solis** | AOD sınır koşulları üzerinden atmosferik geçirgenlik |
| **pvlib Bird** | pvlib'in kendi Bird model uygulaması |
| **PVGIS TMY** | AB JRC'nin Tipik Meteorolojik Yıl verisi |
| **PVGIS POA** | Çok yıllı saatlik Düzlem Işınımı — SARAH-2 veri seti |

### Ortalama Yıl Stratejileri
Uzun dönem saatlik veri setleri (ör. 2005–2023) tek bir sentetik referans yılına dönüştürülür:
- **Simple Mean** — temel matematiksel ortalama
- **Trimmed Mean** — aykırı yılları eleyen yüzdelik kırpma
- **Exponential Weighted** — iklim kaymasını yakalamak için yakın yıllara ağırlık
- **Super Average Year** — tüm stratejilerin konsensüsü

### Güneş Araçları (15 hesaplayıcı)
Julian Günü · Güneş Pozisyonu · Gün Doğumu/Batımı · Güneş Deklinasyonu · Hava Kütlesi (Kasten-Young) · Dünya Dışı Radyasyon · Çiy Noktası → Yoğunlaşabilir Su · İstasyon Basıncı · ISA Basıncı · Linke Bulanıklığı · Erbs Ayrıştırması · Geliş Açısı · Optimal Eğim · POA Işınımı · Anlık Bird

### PVLib ModelChain
Uçtan uca FV simülasyonu: hava verisi → açık gökyüzü ışınımı → düzlem transpozizyonu → DC güç → AC güç çıkışı. SAPM, CEC, De Soto, PVWatts DC modelleri; Sandia, ADR, PVWatts AC modelleri; CEC/Sandia modül ve evirici veritabanları (25 000+ bileşen) desteklenir.

---

## Teknoloji Yığını

**Backend:** FastAPI · pvlib · Pydantic · uvicorn · NumPy · pandas · SciPy  
**Frontend:** Next.js 14 · React · TypeScript · Tailwind CSS · Recharts · Leaflet  
**Altyapı:** Docker · Docker Compose · Nginx (hız sınırlı ters proxy)

---

## Hızlı Başlangıç (Docker)

### Gereksinimler
- Docker ≥ 24 ve Docker Compose V2 kurulu olmalı
- 80. port boş olmalı

### 1. Klonla ve yapılandır

```bash
git clone <repo-url>
cd solarhesap-v0.2

cp backend/.env.example backend/.env
```

`backend/.env` dosyasını düzenle — en azından şunları ayarla:

```env
APP_ENV=production
ALLOWED_ORIGINS=["https://alanadiniz.com"]
```

### 2. Derle ve başlat

```bash
docker compose up -d --build
```

| Servis | Adres |
|---|---|
| Uygulama | http://localhost |
| API Sağlık | http://localhost/api/v1/ (nginx üzerinden) |

API dokümantasyonu (`/docs`, `/redoc`) yalnızca `APP_ENV=development` iken erişilebilir.

### 3. Logları izle

```bash
docker compose logs -f          # tüm servisler
docker compose logs -f backend  # yalnızca backend
```

### 4. Durdur

```bash
docker compose down
```

---

## Yapılandırma

Tüm çalışma zamanı ayarları `backend/.env` dosyasındadır (`.env.example`'dan kopyalanır). Önemli production değerleri:

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `APP_ENV` | `production` | `development` yapılırsa `/docs` açılır |
| `ALLOWED_ORIGINS` | `[]` | Tarayıcının ulaştığı domain — ör. `["https://alanadiniz.com"]` |
| `APP_VERSION` | `v0.2.0` | API yanıtlarında görünür |

### Hız Sınırı

Nginx proxy, IP başına istek limitini uygular. Değiştirmek için `docker-compose.yml`:

```yaml
nginx:
  environment:
    API_RATE_LIMIT: "60"   # dakikada IP başına istek
```

Ardından yalnızca nginx'i yeniden başlat:

```bash
docker compose up -d --build nginx
```

---

## Proje Yapısı

```
solarhesap-v0.2/
├── backend/               # FastAPI uygulaması
│   ├── app/
│   │   ├── api/v1/        # Rota işleyiciler
│   │   ├── services/      # İş mantığı
│   │   ├── schemas/       # Pydantic modeller
│   │   ├── pvlib_tools/   # PVLib sarmalayıcılar
│   │   ├── instesre_bird/ # Özel Bird modeli
│   │   ├── average_year/  # Ortalama yıl stratejileri
│   │   └── outer_apis/    # PVGIS ve Open-Meteo istemcileri
│   ├── .env.example
│   └── requirements.txt
├── frontend/              # Next.js uygulaması
├── nginx/                 # Ters proxy yapılandırması
└── docker-compose.yml
```

---

## Bilimsel Atıflar

- **Bird, R.E. & Hulstrom, R.L. (1981).** *A Simplified Clear Sky Model for Direct and Diffuse Insolation on Horizontal Surfaces.* SERI/TR-642-761, Solar Energy Research Institute. — [instesre.org](https://instesre.org/Solar/BirdModelNew.htm)

- **Anderson K., Hansen C., Holmgren W., Jensen A., Mikofski M., Driesse A. (2023).** *pvlib python: 2023 project update.* Journal of Open Source Software, 8(92), 5994. — [DOI: 10.21105/joss.05994](https://doi.org/10.21105/joss.05994)

- **Jensen A., Anderson K., Holmgren W., Mikofski M., Hansen C., Boeman L., Loonen R. (2023).** *Open-source Python functions for seamless access to solar irradiance data.* Solar Energy, 266, 112092. — [DOI: 10.1016/j.solener.2023.112092](https://doi.org/10.1016/j.solener.2023.112092)

- **Holmgren W., Hansen C., Mikofski M. (2018).** *pvlib python: a python package for modeling solar energy systems.* Journal of Open Source Software, 3(29), 884. — [DOI: 10.21105/joss.00884](https://doi.org/10.21105/joss.00884)

- **Avrupa Komisyonu, Ortak Araştırma Merkezi (JRC).** *Photovoltaic Geographical Information System (PVGIS).* — [JRC PVGIS Portalı](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en)

- **Zippenfenig P. (2023).** *Open-Meteo.com Weather API.* Kesintisiz tarihsel atmosferik veri API'si. — [open-meteo.com](https://open-meteo.com/)

- **Meeus J. (1991).** *Astronomical Algorithms.* Julian Günü, Güneş Pozisyonu, Zaman Denklemi, Dünya–Güneş mesafesi hesaplamaları.

- **Spencer J.W. (1971).** Fourier series representation of the position of the sun. *Search*, 2(5), 172. Güneş deklinasyonu hesaplamaları.
