# Solarhesap v0.2

**Solarhesap** is a high-fidelity solar irradiance simulation engine and photovoltaic (PV) modeling platform. It combines six clear-sky irradiance models, multi-year meteorological data pipelines, a full pvlib ModelChain, historical production analysis, and fifteen standalone solar calculation tools — all in a single bilingual (EN/TR) web application.

> **Deploy to a server?** → [DEPLOY.md](DEPLOY.md) · [DEPLOY_TR.md](DEPLOY_TR.md)

---

## Table of Contents

1. [Features Overview](#features-overview)
2. [Application Pages](#application-pages)
3. [API Endpoints](#api-endpoints)
4. [Technology Stack](#technology-stack)
5. [Quick Start (Docker)](#quick-start-docker)
6. [Development Setup](#development-setup)
7. [Configuration Reference](#configuration-reference)
8. [Project Structure](#project-structure)
9. [Scientific References](#scientific-references)

---

## Features Overview

### Irradiance Models

| Model | Algorithm | Data Source |
|---|---|---|
| **INSTESRE Bird** | Bird & Hulstrom (1981) — broadband aerosol, Rayleigh scattering, ozone, water vapor | Open-Meteo historical |
| **Ineichen / Perez** | Linke turbidity broadband; auto-loaded from pvlib climate database | Open-Meteo historical |
| **Simplified Solis** | Atmospheric transmissivity via AOD boundary conditions | Open-Meteo historical |
| **pvlib Bird** | pvlib's implementation of the Bird clear-sky model | Open-Meteo historical |
| **PVGIS TMY** | EU JRC Typical Meteorological Year (SARAH-2 / COSMO-REA6) | PVGIS API |
| **PVGIS POA** | Multi-year hourly plane-of-array irradiance (SARAH-2, 2005–2023) | PVGIS API |

### Average-Year Strategies

Multi-year hourly datasets (e.g. 2005–2023) can be synthesized into a single representative year using:

| Strategy | Description |
|---|---|
| **Simple Mean** | Naive mathematical average across all years |
| **Trimmed Mean** | Percentile cutoffs (default 10–90 %) to discard outlier years |
| **Exponential Weighted** | Exponential decay weighting — recent years carry more weight (default factor 0.9) |
| **Combined Average Year** | Aggregate of Simple Mean + Trimmed Mean + Exp. Weighted |
| **Super Average Year** | Consensus across all base strategies |
| **All Strategies** | Run every strategy in one request for comparison |

### PV System Simulation (ModelChain)

End-to-end PV yield simulation built on **pvlib ModelChain**:

| Component | Options |
|---|---|
| **DC Model** | SAPM · CEC · De Soto · PVsyst · PVWatts |
| **AC Model** | Sandia · ADR · PVWatts |
| **AOI Loss Model** | Physical · ASHRAE · SAPM · Martin-Ruiz · Interpolation · No Loss |
| **Spectral Model** | SAPM · First Solar · No Loss |
| **Temperature Model** | SAPM · PVsyst · Faiman · Fuentes · NOCT SAM |
| **Module Database** | SAM CECMod (21 500+) · SAM SandiaMod (523) · Manual JSON |
| **Inverter Database** | SAM CECInverter · SandiaInverter · ADRInverter (combined 11 000+) · Manual JSON |

### Historical Production Analysis

Simulate a specific past year (2005–2022) using real PVGIS SARAH satellite irradiance data. Two modes:

- **Basic mode** — roof area + efficiency tier (14 %–22 %) → annual/monthly/hourly kWh estimate
- **Advanced mode** — full component-level simulation with SAM database modules and inverters; optionally upload real measured production data (CSV/JSON) for simulated vs. actual comparison

### Solar Calculation Tools (15 calculators)

| Category | Tools |
|---|---|
| Date & Time | Julian Day · Solar Declination |
| Solar Position | Solar Position (Meeus) · Sunrise / Sunset · Airmass (Kasten-Young) |
| Atmosphere | Extraterrestrial Radiation · Linke Turbidity · Dew Point → Precipitable Water · Station Pressure · ISA Pressure |
| Irradiance | Erbs Decomposition (GHI → DNI + DHI) · Instant Bird · POA Irradiance |
| Geometry | Angle of Incidence · Optimal Tilt · — |

### Raw Irradiance Data Export

The **Irradiance Generator** produces full hourly timeseries for any location and date range. Outputs include GHI, DNI, DHI, POA (plane-of-array), temperature, and wind speed. Results are downloadable as CSV or JSON. PVGIS TMY data is available in both full-timestamp and simplified day-of-year/hour formats.

---

## Application Pages

| Route | Description |
|---|---|
| `/` | Landing page — feature overview, methodology, team |
| `/simulation` | Three-tab interface: Individual Model · Deep Comparison · Advanced Forecast (ModelChain) |
| `/modelchain` | Standalone advanced ModelChain with multi-array support, full SAM database search |
| `/irradiance` | Raw irradiance timeseries generator — date-range picker, 6 models, CSV/JSON download |
| `/historical` | Historical production analysis — Basic and Advanced modes, actual data upload |
| `/calculation` | Fifteen standalone solar calculation tools |
| `/about` | Project background, methodology, team, academic references |

### Simulation Page — Tab Details

**Individual Model tab**
- Select one of 6 clear-sky models
- Interactive map + manual lat/lon/elevation/timezone inputs
- Date range (day-level precision) up to 20 years; model-specific atmospheric parameters (ozone, AOD500/380/700, albedo, asymmetry)
- Average-year strategy selection
- Results: summary statistics, DrillDown irradiance chart (annual → monthly → daily → hourly), data download

**Deep Comparison tab**
- Run multiple models and strategies simultaneously
- Summary matrix comparing total/avg/peak across all combinations
- Overlaid timeseries chart (Bar / Line / Area) with per-series toggle

**Advanced Forecast tab (ModelChain)**
- Full PVLib ModelChain with SAPM / CEC / De Soto / PVWatts DC models
- Multi-array support (add/remove arrays with independent tilt, azimuth, racking)
- Module search (21 500+ components from SAM CECMod/SandiaMod) or manual JSON
- Inverter search (11 000+ components) or manual JSON
- Temperature model (SAPM / PVsyst / Faiman / Fuentes / NOCT SAM)
- Weather source: any of the 6 irradiance models
- Energy output drill-down chart with Bar/Line toggle and period label
- Detailed system summary (DC/AC capacity, DC/AC ratio, per-string layout)

---

## API Endpoints

All routes are prefixed with `/api/v1`. API docs available at `/docs` and `/redoc` when `APP_ENV=development`.

### Simulation

| Method | Path | Description |
|---|---|---|
| POST | `/solar-simulation/instesre-bird` | INSTESRE Bird clear-sky timeseries |
| POST | `/solar-simulation/pvlib-ineichen` | Ineichen/Perez clear-sky timeseries |
| POST | `/solar-simulation/pvlib-solis` | Simplified Solis clear-sky timeseries |
| POST | `/solar-simulation/pvlib-bird` | pvlib Bird clear-sky timeseries |
| POST | `/solar-simulation/pvgis-tmy` | PVGIS Typical Meteorological Year |
| POST | `/solar-simulation/pvgis-poa` | PVGIS multi-year hourly POA |
| POST | `/solar-simulation/deep-comparison` | Parallel multi-model + multi-strategy comparison |
| POST | `/solar-simulation/run-modelchain` | Standard pvlib ModelChain |
| POST | `/solar-simulation/run-modelchain-advanced` | Advanced ModelChain with SAM database |
| POST | `/solar-simulation/generate-irradiance` | Raw irradiance timeseries (6 models) |
| POST | `/solar-simulation/run-basic-electric` | Simple efficiency-based estimate |
| POST | `/solar-simulation/run-historical-basic` | Historical simulation (efficiency tier) |
| POST | `/solar-simulation/run-historical-advanced` | Historical simulation (full components) |

### Calculation Tools

| Method | Path | Description |
|---|---|---|
| POST | `/solar-tools/julian-day` | Julian Day Number |
| POST | `/solar-tools/solar-declination` | Solar declination (Spencer) |
| POST | `/solar-tools/solar-position` | Zenith, elevation, azimuth, hour angle |
| POST | `/solar-tools/sunrise-sunset` | Sunrise, sunset, solar noon, day length |
| POST | `/solar-tools/airmass` | Airmass (Kasten-Young / Kasten / Simple) |
| POST | `/solar-tools/extraterrestrial` | Extraterrestrial radiation |
| POST | `/solar-tools/dew-point-to-pw` | Dew point → precipitable water |
| POST | `/solar-tools/station-pressure` | Atmospheric pressure from elevation |
| POST | `/solar-tools/isa-pressure` | ISA standard atmosphere pressure |
| POST | `/solar-tools/linke-turbidity` | Linke turbidity estimate |
| POST | `/solar-tools/instant-bird` | Single-point INSTESRE Bird irradiance |
| POST | `/solar-tools/erbs-decomposition` | GHI decomposition (DNI + DHI) |
| POST | `/solar-tools/angle-of-incidence` | Sunlight angle on tilted surface |
| POST | `/solar-tools/optimal-tilt` | Latitude-based optimal panel tilt |
| POST | `/solar-tools/poa-irradiance` | Plane-of-array irradiance (isotropic) |

### Utilities

| Method | Path | Description |
|---|---|---|
| GET | `/solar-tools/sam-search` | Search SAM module/inverter database |
| GET | `/api/v1/health` | Health check (`{"status":"ok"}`) |

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12 · FastAPI · pvlib 0.10 · Pydantic v2 · NumPy · pandas · SciPy · uvicorn |
| **External APIs** | Open-Meteo Historical Archive · PVGIS (JRC) · SAM component databases |
| **Frontend** | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS v3 |
| **Charts** | Recharts (Bar / Line / Area — all with drill-down) |
| **Map** | Leaflet + react-leaflet |
| **Infrastructure** | Docker · Docker Compose · Nginx (rate-limited reverse proxy, security headers) |
| **Localization** | Full EN / TR bilingual UI |

---

## Quick Start (Docker)

### Prerequisites

- Docker ≥ 24 and Docker Compose V2
- Port 80 free (or change in `docker-compose.yml`)

### 1. Clone

```bash
git clone <repo-url>
cd solarhesap
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Minimum changes for production:

```env
APP_ENV=production
```

### 3. Build and start

> **Important:** Use the explicit `-f` flag to skip the development override file.

```bash
docker compose -f docker-compose.yml up -d --build
```

First build takes 5–10 minutes (Python dependencies + Next.js compilation).

### 4. Verify

```bash
curl http://localhost/api/v1/health
# → {"status":"ok","app":"Solarhesap","version":"v0.2.0"}
```

Open `http://localhost` in your browser.

### 5. Useful commands

```bash
docker compose ps                        # check service status
docker compose logs -f                   # live logs (all services)
docker compose logs -f backend           # backend only
docker compose -f docker-compose.yml down # stop and remove containers
docker compose -f docker-compose.yml up -d --build backend  # rebuild backend only
```

---

## Development Setup

Run frontend and backend with hot-reload using the override file:

```bash
# Uses docker-compose.yml + docker-compose.override.yml automatically
docker compose up -d --build
```

The override file:
- Mounts `backend/app/` for live reload (uvicorn `--reload`)
- Mounts `frontend/` for Next.js dev server
- Sets `APP_ENV=development` (enables `/docs` and `/redoc`)

### Local (no Docker)

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
# create .env.local with:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

---

## Configuration Reference

All runtime config lives in `backend/.env` (copy from `.env.example`).

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `production` | `development` enables `/docs`, `/redoc` |
| `APP_VERSION` | `v0.2.0` | Shown in API health response |
| `PVGIS_BASE_URL` | `https://re.jrc.ec.europa.eu/api/v5_3/` | PVGIS API base URL |
| `OPEN_METEO_BASE_URL` | `https://archive-api.open-meteo.com/v1/archive` | Open-Meteo archive URL |
| `OPENMETEO_TIMEOUT` | `30` | HTTP timeout (seconds) for Open-Meteo requests |
| `PVGIS_TIMEOUT` | `90` | HTTP timeout (seconds) for PVGIS requests |
| `LOG_BASE_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `LOG_STREAM_HANDLER` | `True` | Print logs to stdout |

### Rate Limiting (nginx)

Configured via `docker-compose.yml` under the `nginx` service:

```yaml
nginx:
  environment:
    API_RATE_LIMIT: "30"   # max requests per minute per IP
```

Apply without full rebuild:

```bash
docker compose -f docker-compose.yml up -d --build nginx
```

---

## Project Structure

```
solarhesap-v0.2/
├── backend/
│   ├── app/
│   │   ├── api/v1/                  # FastAPI route handlers
│   │   │   ├── solar_simulation_routes.py
│   │   │   └── solar_tools_routes.py
│   │   ├── services/                # Business logic layer
│   │   │   ├── clearsky_service.py
│   │   │   ├── modelchain_service.py
│   │   │   ├── advanced_modelchain_service.py
│   │   │   ├── deep_comparison.py
│   │   │   ├── historical_service.py
│   │   │   ├── irradiance_generator_service.py
│   │   │   ├── basic_electric_service.py
│   │   │   └── solar_tools_service.py
│   │   ├── schemas/                 # Pydantic request/response models
│   │   ├── instesre_bird/           # INSTESRE Bird model implementation
│   │   ├── pvlib_tools/             # pvlib wrappers (clearsky, ModelChain, SAM)
│   │   ├── average_year/            # Average-year strategy implementations
│   │   ├── outer_apis/              # PVGIS + Open-Meteo HTTP clients
│   │   └── core/                    # Settings, logging, error handlers
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                         # Next.js App Router pages
│   │   ├── page.tsx                 # Home
│   │   ├── simulation/page.tsx      # Simulation (3 tabs)
│   │   ├── modelchain/page.tsx      # Advanced ModelChain
│   │   ├── irradiance/page.tsx      # Irradiance generator
│   │   ├── historical/page.tsx      # Historical analysis
│   │   ├── calculation/page.tsx     # 15 solar tools
│   │   ├── about/page.tsx           # About
│   │   ├── error.tsx                # Global error boundary
│   │   └── not-found.tsx            # 404 page
│   ├── components/
│   │   ├── charts/                  # Recharts wrappers
│   │   ├── simulation/              # Map picker, form components
│   │   ├── layout/                  # Navbar, Footer
│   │   └── shared/                  # Tooltips, reusable UI
│   ├── lib/
│   │   ├── api.ts                   # API client functions
│   │   ├── translations.ts          # EN/TR string table (650+ keys)
│   │   └── constants.ts             # Model configs, defaults
│   └── Dockerfile
├── nginx/
│   ├── nginx.conf.template          # Rate limiting + security headers
│   ├── entrypoint.sh
│   └── Dockerfile
├── docker-compose.yml               # Production compose
├── docker-compose.override.yml      # Development overrides (gitignored)
├── DEPLOY.md                        # Deployment guide (English)
└── DEPLOY_TR.md                     # Deployment guide (Turkish)
```

---

## Scientific References

- **Bird, R.E. & Hulstrom, R.L. (1981).** *A Simplified Clear Sky Model for Direct and Diffuse Insolation on Horizontal Surfaces.* SERI/TR-642-761, Solar Energy Research Institute. — [instesre.org](https://instesre.org/Solar/BirdModelNew.htm)

- **Ineichen, P. & Perez, R. (2002).** *A new airmass independent formulation for the Linke turbidity coefficient.* Solar Energy, 73(3), 151–157.

- **Reindl, D.T., Beckman, W.A., & Duffie, J.A. (1990).** *Diffuse fraction correlations.* Solar Energy, 45(1), 1–7. *(Solis transmissivity parameterization)*

- **Erbs, D.G., Klein, S.A., & Duffie, J.A. (1982).** *Estimation of the diffuse radiation fraction for hourly, daily and monthly-average global radiation.* Solar Energy, 28(4), 293–302.

- **Anderson K., Hansen C., Holmgren W., Jensen A., Mikofski M., Driesse A. (2023).** *pvlib python: 2023 project update.* Journal of Open Source Software, 8(92), 5994. — [DOI: 10.21105/joss.05994](https://doi.org/10.21105/joss.05994)

- **Holmgren W., Hansen C., Mikofski M. (2018).** *pvlib python: a python package for modeling solar energy systems.* Journal of Open Source Software, 3(29), 884. — [DOI: 10.21105/joss.00884](https://doi.org/10.21105/joss.00884)

- **European Commission, Joint Research Centre.** *Photovoltaic Geographical Information System (PVGIS) — SARAH-2 dataset.* — [JRC PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en)

- **Zippenfenig, P. (2023).** *Open-Meteo.com Weather API.* Historical archive atmospheric dataset. — [open-meteo.com](https://open-meteo.com/)

- **Meeus, J. (1991).** *Astronomical Algorithms.* Willmann-Bell. *(Solar position, Julian Day, equation of time)*

- **Spencer, J.W. (1971).** Fourier series representation of the position of the sun. *Search*, 2(5), 172. *(Solar declination)*

- **Kasten, F. & Young, A.T. (1989).** *Revised optical air mass tables and approximation formula.* Applied Optics, 28(22), 4735–4738.
