# Solarhesap v0.2

**Solarhesap** is a high-fidelity solar irradiance simulation engine and photovoltaic (PV) modeling platform developed as a **TÜBİTAK 2209-A** research project. It combines multiple clear-sky models, multi-year meteorological data pipelines, and a full PVLib ModelChain into a single web application.

> For server deployment instructions, see [DEPLOY.md](DEPLOY.md).

---

## Features

### Simulation Models
| Model | Description |
|---|---|
| **INSTESRE Bird** | Bird & Hulstrom (1981) clear-sky — broadband aerosol, Rayleigh scattering, ozone, precipitable water |
| **Ineichen / Perez** | Linke Turbidity-based broadband model, auto-loaded from pvlib database |
| **Simplified Solis** | Atmospheric transmissivity via AOD boundary conditions |
| **pvlib Bird** | pvlib's own implementation of the Bird model |
| **PVGIS TMY** | Typical Meteorological Year data from the EU JRC |
| **PVGIS POA** | Multi-year hourly Plane-of-Array irradiance (SARAH-2 dataset) |

### Average Year Strategies
Multi-year hourly datasets (e.g. 2005–2023) are compressed into a single synthetic reference year via:
- **Simple Mean** — naive mathematical aggregation
- **Trimmed Mean** — percentile cutoffs to remove outlier years
- **Exponential Weighted** — recent years carry higher weight to reflect climate shifts
- **Super Average Year** — consensus across all strategies

### Solar Tools (15 calculators)
Julian Day · Solar Position · Sunrise/Sunset · Solar Declination · Airmass (Kasten-Young) · Extraterrestrial Radiation · Dew Point → Precipitable Water · Station Pressure · ISA Pressure · Linke Turbidity · Erbs Decomposition · Angle of Incidence · Optimal Tilt · POA Irradiance · Instant Bird

### PVLib ModelChain
End-to-end PV simulation: weather → clear-sky irradiance → plane-of-array transposition → DC power → AC power. Supports SAPM, CEC, De Soto, PVWatts DC models; Sandia, ADR, PVWatts AC models; and CEC/Sandia module & inverter databases (25 000+ components).

---

## Technology Stack

**Backend:** FastAPI · pvlib · Pydantic · uvicorn · NumPy · pandas · SciPy  
**Frontend:** Next.js 14 · React · TypeScript · Tailwind CSS · Recharts · Leaflet  
**Infrastructure:** Docker · Docker Compose · Nginx (rate-limited reverse proxy)

---

## Quick Start (Docker)

### Prerequisites
- Docker ≥ 24 and Docker Compose V2 installed
- Port 80 available on the host

### 1. Clone and configure

```bash
git clone <repo-url>
cd solarhesap-v0.2

cp backend/.env.example backend/.env
```

Edit `backend/.env` — at minimum set:

```env
APP_ENV=production
ALLOWED_ORIGINS=["https://yourdomain.com"]
```

### 2. Build and start

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| Application | http://localhost |
| API Health | http://localhost/api/v1/ (via nginx) |

The API documentation (`/docs`, `/redoc`) is only available when `APP_ENV=development`.

### 3. View logs

```bash
docker compose logs -f          # all services
docker compose logs -f backend  # backend only
```

### 4. Stop

```bash
docker compose down
```

---

## Configuration

All runtime configuration lives in `backend/.env` (copy from `.env.example`). The most important production values:

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `production` | Set to `development` to enable `/docs` |
| `ALLOWED_ORIGINS` | `[]` | Browser-facing domain(s), e.g. `["https://yourdomain.com"]` |
| `APP_VERSION` | `v0.2.0` | Shown in API responses |

### Rate Limiting

The Nginx proxy enforces a per-IP request limit. To change it, edit `docker-compose.yml`:

```yaml
nginx:
  environment:
    API_RATE_LIMIT: "60"   # requests per minute per IP
```

Then apply without rebuilding other services:

```bash
docker compose up -d --build nginx
```

---

## Project Structure

```
solarhesap-v0.2/
├── backend/               # FastAPI application
│   ├── app/
│   │   ├── api/v1/        # Route handlers
│   │   ├── services/      # Business logic
│   │   ├── schemas/       # Pydantic models
│   │   ├── pvlib_tools/   # PVLib wrappers
│   │   ├── instesre_bird/ # Custom Bird model
│   │   ├── average_year/  # Avg-year strategies
│   │   └── outer_apis/    # PVGIS & Open-Meteo clients
│   ├── .env.example
│   └── requirements.txt
├── frontend/              # Next.js application
├── nginx/                 # Reverse proxy config
└── docker-compose.yml
```

---

## Scientific References

- **Bird & Hulstrom (1981).** *A Simplified Clear Sky Model for Direct and Diffuse Insolation on Horizontal Surfaces.* SERI/TR-642-761, Solar Energy Research Institute. — [instesre.org](https://instesre.org/Solar/BirdModelNew.htm)

- **Anderson K., Hansen C., Holmgren W., Jensen A., Mikofski M., Driesse A. (2023).** *pvlib python: 2023 project update.* Journal of Open Source Software, 8(92), 5994. — [DOI: 10.21105/joss.05994](https://doi.org/10.21105/joss.05994)

- **Jensen A., Anderson K., Holmgren W., Mikofski M., Hansen C., Boeman L., Loonen R. (2023).** *Open-source Python functions for seamless access to solar irradiance data.* Solar Energy, 266, 112092. — [DOI: 10.1016/j.solener.2023.112092](https://doi.org/10.1016/j.solener.2023.112092)

- **Holmgren W., Hansen C., Mikofski M. (2018).** *pvlib python: a python package for modeling solar energy systems.* Journal of Open Source Software, 3(29), 884. — [DOI: 10.21105/joss.00884](https://doi.org/10.21105/joss.00884)

- **European Commission, Joint Research Centre.** *Photovoltaic Geographical Information System (PVGIS).* — [JRC PVGIS Portal](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en)

- **Zippenfenig P. (2023).** *Open-Meteo.com Weather API.* Seamless historical atmospheric dataset API. — [open-meteo.com](https://open-meteo.com/)

- **Meeus J. (1991).** *Astronomical Algorithms.* Julian Day, Solar Position, Equation of Time, Earth–Sun distance.

- **Spencer J.W. (1971).** Fourier series representation of the position of the sun. *Search*, 2(5), 172. Solar declination calculations.
