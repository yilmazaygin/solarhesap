<div align="center">

# ☀️ Solarhesap

**Yüksek Çözünürlüklü Fotovoltaik (FV) Simülasyon ve Güneş Işınımı Analiz Platformu**<br>
*(High-Fidelity Solar Irradiance Simulation Engine & Photovoltaic Modeling Platform)*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![pvlib](https://img.shields.io/badge/pvlib-0.10-green.svg)](https://pvlib-python.readthedocs.io/)
[![FOSS](https://img.shields.io/badge/FOSS-100%25-brightgreen.svg)](#)

*An open-source research project combining six clear-sky irradiance models, multi-year meteorological data pipelines, a full pvlib ModelChain, historical production analysis, and fifteen standalone solar calculation tools — all in a single bilingual (EN/TR) web application with an open API ecosystem.*

[**Live Demo**](https://solarhesap.net.tr) · [**GitHub**](https://github.com/yilmazaygin/solarhesap) · [**Deploy Guide**](DEPLOY.md)

</div>

---

## Table of Contents

1. [Features at a Glance](#features-at-a-glance)
2. [Irradiance Models](#irradiance-models)
3. [Average-Year Strategies](#average-year-strategies)
4. [PV System Simulation (ModelChain)](#pv-system-simulation-modelchain)
5. [Energy Production Estimate](#energy-production-estimate)
6. [Model Comparison Tools](#model-comparison-tools)
7. [Historical Production Analysis](#historical-production-analysis)
8. [Solar Calculation Tools (15 Calculators)](#solar-calculation-tools-15-calculators)
9. [Raw Irradiance Data Export](#raw-irradiance-data-export)
10. [Interactive API Documentation](#interactive-api-documentation)
11. [Application Pages](#application-pages)
12. [API Endpoints](#api-endpoints)
13. [Technology Stack](#technology-stack)
14. [Quick Start (Docker)](#quick-start-docker)
15. [Development Setup](#development-setup)
16. [Configuration Reference](#configuration-reference)
17. [Project Structure](#project-structure)
18. [Scientific References](#scientific-references)

---

## Features at a Glance

| Category | Highlights |
|---|---|
| 🌤️ **Irradiance Models** | 6 models — INSTESRE Bird, Ineichen/Perez, Simplified Solis, pvlib Bird, PVGIS TMY, PVGIS POA |
| ⚡ **PV Simulation** | Full pvlib ModelChain with 5 DC models, 3 AC models, 6 AOI loss models, multi-array support |
| 📊 **Model Comparison** | Side-by-side irradiance comparison + AC energy yield comparison across all models |
| 🏠 **Energy Estimate** | Quick residential/commercial estimate — area + efficiency tier → annual kWh with auto-sizing |
| 📈 **Historical Analysis** | Simulate past years (2005–2022) with real PVGIS SARAH satellite data; upload actual production for comparison |
| 🔧 **Solar Tools** | 15 standalone calculators — Julian Day, Solar Position, Airmass, Erbs Decomposition, Optimal Tilt, and more |
| 📡 **Irradiance Generator** | Full hourly timeseries export for any location/date range — CSV/JSON download |
| 📖 **API Documentation** | Interactive bilingual API docs page with curl examples, field tables, and copy-to-clipboard |
| 🗄️ **Hardware Database** | 21,500+ modules (SAM CECMod/SandiaMod) + 11,000+ inverters (CEC/Sandia/ADR) with live search |
| 🌍 **Bilingual UI** | Full English/Turkish interface with 650+ translation keys |
| 🎨 **Dark/Light Theme** | Persistent theme toggle with anti-FOUC (Flash of Unstyled Content) protection |
| 🗺️ **Interactive Maps** | Leaflet-based location picker with click-to-select on every simulation page |
| 📥 **Data Export** | CSV and JSON download on every results page |

---

## Irradiance Models

| Model | Algorithm | Data Source |
|---|---|---|
| **INSTESRE Bird** | Bird & Hulstrom (1981) — broadband aerosol, Rayleigh scattering, ozone, water vapor | Open-Meteo historical |
| **Ineichen / Perez** | Linke turbidity broadband; auto-loaded from pvlib climate database | Open-Meteo historical |
| **Simplified Solis** | Atmospheric transmissivity via AOD boundary conditions | Open-Meteo historical |
| **pvlib Bird** | pvlib's implementation of the Bird clear-sky model | Open-Meteo historical |
| **PVGIS TMY** | EU JRC Typical Meteorological Year (SARAH-2 / COSMO-REA6) | PVGIS API |
| **PVGIS POA** | Multi-year hourly plane-of-array irradiance (SARAH-2, 2005–2023) | PVGIS API |

---

## Average-Year Strategies

Multi-year hourly datasets (e.g. 2005–2023) can be synthesized into a single representative year:

| Strategy | Description |
|---|---|
| **Simple Mean** | Naive mathematical average across all years |
| **Trimmed Mean** | Percentile cutoffs (default 10–90%) to discard outlier years |
| **Exponential Weighted** | Exponential decay weighting — recent years carry more weight (default factor 0.9) |

---

## PV System Simulation (Advanced ModelChain)

Go far beyond simple area-efficiency multiplication. Our platform provides an end-to-end PV yield simulation built on the industry-standard **pvlib ModelChain**, giving you granular control over every aspect of the energy conversion process:

| Component | Options |
|---|---|
| **DC Model** | SAPM · CEC · De Soto · PVsyst · PVWatts |
| **AC Model** | Sandia · ADR · PVWatts |
| **AOI Loss Model** | Physical · ASHRAE · SAPM · Martin-Ruiz · Interpolation · No Loss |
| **Spectral Model** | SAPM · First Solar · No Loss |
| **Temperature Model** | SAPM · PVsyst · Faiman · Fuentes · NOCT SAM |
| **Module Database** | SAM CECMod (21,500+) · SAM SandiaMod (523) · **Manual Input (Custom JSON)** |
| **Inverter Database** | SAM CECInverter · SandiaInverter · ADRInverter (11,000+) · **Manual Input (Custom JSON)** |

**Rare & Advanced Capabilities:**
- **Manual Component Overrides:** Can't find a brand-new prototype panel or inverter in the database? No problem. Solarhesap allows you to manually input the exact I-V curve parameters, thermal coefficients, and electrical properties via custom JSON. This is a rare feature even among expensive proprietary software.
- **Detailed Loss Modeling:** Precisely configure Angle of Incidence (AOI) losses, spectral mismatch losses, and apply custom temperature model overrides to see how heat affects your specific cell architecture.
- **Multi-Array Architecture:** Build complex rooftop/ground-mount setups where each array has independent tilt, azimuth, racking mounts, and module configurations feeding into the same inverter.
- **Interactive Drill-Downs:** Visualize output from annual summaries down to hourly behavior using Recharts.

---

## Energy Production Estimate

The **Energy Estimate** page (`/estimate`) provides a quick, user-friendly way to estimate annual solar energy production:

- Select location via interactive map or manual lat/lon input
- Configure roof/panel area (direct m² or A×B dimensions with 85% packing factor)
- Choose panel efficiency tier (14%–22%)
- Set tilt and azimuth (auto-calculated from latitude)
- Powered by PVGIS TMY data — no configuration of atmospheric parameters needed
- Results include: annual energy (kWh/MWh), specific yield (kWh/kWp), capacity factor, DC/AC ratio warnings
- Drill-down energy chart + system-at-a-glance summary + full details panel
- Download results as CSV or JSON

---

## Model Comparison Tools

### Irradiance Comparison (`/irradiance-comparison`)

Compare raw irradiance output (kWh/m²) across all 6 models simultaneously:
- Select which models to include (4 clear-sky + PVGIS TMY + PVGIS POA)
- Summary matrix showing annual irradiance per model per average-year strategy
- Overlaid timeseries chart with per-series toggle
- JSON download of full comparison data

### Energy Yield Comparison (`/comparison`)

Compare **AC energy yield** (kWh) across models for a specific PV system configuration:
- Same model selection as irradiance comparison
- Configure PV system: panel area, efficiency tier, tilt, azimuth
- Summary matrix showing annual AC energy production per model
- Side-by-side bar chart comparison
- CSV and JSON download

---

## Historical Production Analysis (B2C & B2B Focus)

Answer the ultimate question: *"If I had built this plant 5 years ago, how much would it have produced?"* using real PVGIS SARAH satellite data (2005–2022). We cater to two distinct audiences:

### Basic Mode (For End-Users / Feasibility)
- Designed for quick, frictionless estimates.
- Input just roof area (m²) and efficiency tier (14%–22%).
- Instantly generates annual, monthly, and hourly kWh estimates without needing to understand electrical engineering.

### Advanced Mode (For Researchers & Plant Managers)
- Deep, component-level simulation using exact SAM database models or custom manual inputs.
- Granular selection of DC/AC models, temperature lookup tables, and string/inverter topologies.
- **Actual vs. Simulated Analysis:** Upload your plant's real SCADA measurement data (CSV/JSON). The platform overlays your actual production against the theoretical clear-sky or satellite simulation, revealing millimeter-precise performance deviations and degradation over time.
- Monthly and annual deviation analysis

---

## Solar Calculation Tools (15 Calculators)

| Category | Tools |
|---|---|
| **Date & Time** | Julian Day · Solar Declination (Spencer) |
| **Solar Position** | Solar Position (Meeus) — zenith, elevation, azimuth, hour angle, EoT · Sunrise / Sunset / Day Length · Airmass (Kasten-Young / Kasten / Simple) |
| **Atmosphere** | Extraterrestrial Radiation · Linke Turbidity · Dew Point → Precipitable Water · Station Pressure · ISA Pressure |
| **Irradiance** | Erbs Decomposition (GHI → DNI + DHI) · Instant Bird · POA Irradiance (Isotropic) |
| **Geometry** | Angle of Incidence · Optimal Tilt (annual/summer/winter) |

---

## Raw Irradiance Data Export

The **Irradiance Generator** (`/irradiance`) produces full hourly timeseries for any location and date range:
- All 6 irradiance models available
- Outputs: GHI, DNI, DHI, POA (plane-of-array), temperature, wind speed
- PVGIS TMY data available in both full-timestamp and simplified day-of-year/hour formats
- Downloadable as CSV or JSON

---

## Open-Source API Ecosystem (No Strings Attached)

The core philosophy of Solarhesap is to democratize solar research. We expose our entire massive calculation engine as a **100% open, free, and unauthenticated REST API**. There are no API keys, no paywalls, and no rate limits (other than basic DDoS protection). 

Other software projects, smart home dashboards, IoT devices, or grid optimization algorithms can plug directly into Solarhesap as their mathematical brain. 

The interactive **API Docs** page (`/api-docs`) provides a comprehensive reference:
- **Solar Tools Endpoints:** Access 15 standalone calculators. For instance, send a timestamp to `/solar-tools/solar-position` to instantly receive sub-second accurate zenith/azimuth angles based on Meeus (1991). Or send global horizontal irradiance to `/solar-tools/erbs-decomposition` to derive direct and diffuse components.
- **Simulation Endpoints:** Post your manual panel specs to `/solar-simulation/run-modelchain-advanced` and receive an 8760-hour array of AC output power in milliseconds.
- **Developer Friendly:** Every endpoint includes curl examples, JSON payload structures, and one-click copy snippets. Fully bilingual (EN/TR).

---

## Application Pages

| Route | Description |
|---|---|
| `/` | Landing page — feature overview, methodology, academic references, tech stack |
| `/estimate` | Quick energy production estimate — area + efficiency tier → annual kWh |
| `/irradiance` | Raw irradiance timeseries generator — date-range picker, 6 models, CSV/JSON download |
| `/irradiance-comparison` | Side-by-side irradiance comparison across all 6 models |
| `/comparison` | AC energy yield comparison across models for a configured PV system |
| `/modelchain` | Advanced ModelChain — multi-array support, full SAM database search, all DC/AC models |
| `/historical` | Historical production analysis — Basic and Advanced modes, actual data upload |
| `/calculation` | Fifteen standalone solar calculation tools |
| `/api-docs` | Interactive API documentation with curl examples and field tables |
| `/about` | Project background, methodology, team, academic references |

---

## API Endpoints

All routes are prefixed with `/api/v1`. Swagger docs available at `/docs` and ReDoc at `/redoc` when `APP_ENV=development`.

### Simulation & Production

| Method | Path | Description |
|---|---|---|
| POST | `/solar-simulation/instesre-bird` | INSTESRE Bird clear-sky timeseries |
| POST | `/solar-simulation/pvlib-ineichen` | Ineichen/Perez clear-sky timeseries |
| POST | `/solar-simulation/pvlib-solis` | Simplified Solis clear-sky timeseries |
| POST | `/solar-simulation/pvlib-bird` | pvlib Bird clear-sky timeseries |
| POST | `/solar-simulation/pvgis-tmy` | PVGIS Typical Meteorological Year |
| POST | `/solar-simulation/pvgis-poa` | PVGIS multi-year hourly POA |
| POST | `/solar-simulation/deep-comparison` | Parallel multi-model irradiance comparison |
| POST | `/solar-simulation/deep-comparison-yield` | Multi-model AC energy yield comparison |
| POST | `/solar-simulation/run-modelchain` | Standard pvlib ModelChain |
| POST | `/solar-simulation/run-modelchain-advanced` | Advanced ModelChain with SAM database |
| POST | `/solar-simulation/generate-irradiance` | Raw irradiance timeseries (6 models) |
| POST | `/solar-simulation/basic-electric` | Quick efficiency-based energy estimate |
| POST | `/solar-simulation/historical/basic` | Historical simulation (efficiency tier) |
| POST | `/solar-simulation/historical/advanced` | Historical simulation (full components) |

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

### Utilities & Database

| Method | Path | Description |
|---|---|---|
| GET | `/solar-tools/list-sam-components` | Search SAM module/inverter database (paginated) |
| GET | `/solar-tools/sam-component-detail` | Full parameters for a specific SAM component |
| GET | `/solar-tools/temperature-model-configs` | List all pvlib temperature model configurations |
| GET | `/api/v1/health` | Health check (`{"status":"ok"}`) |

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12 · FastAPI · pvlib 0.10 · Pydantic v2 · NumPy · pandas · SciPy · Tenacity · uvicorn |
| **External APIs** | Open-Meteo Historical Archive · PVGIS (JRC) · SAM component databases (CEC/Sandia/ADR) |
| **Frontend** | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS v3 |
| **Charts** | Recharts (Bar / Line / Area — all with drill-down capability) |
| **Map** | Leaflet + react-leaflet |
| **Icons** | Lucide React |
| **Infrastructure** | Docker · Docker Compose · Nginx (rate-limited reverse proxy, security headers) |
| **Localization** | Full EN / TR bilingual UI (650+ translation keys) |
| **Theming** | Dark / Light mode with localStorage persistence and anti-FOUC |

---

## Quick Start (Docker)

### Prerequisites

- Docker ≥ 24 and Docker Compose V2
- Port 90 free (or change in `docker-compose.yml`)

### 1. Clone

```bash
git clone https://github.com/yilmazaygin/solarhesap.git
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

> **Important:** Use the explicit `-f` flag to use only the production compose file.

```bash
docker compose -f docker-compose.yml up -d --build
```

First build takes 5–10 minutes (Python dependencies + Next.js compilation).

### 4. Verify

```bash
curl http://localhost:90/api/v1/health
# → {"status":"ok","app":"Solarhesap","version":"v0.3.0"}
```

Open `http://localhost:90` in your browser.

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

Run frontend and backend with hot-reload using the development override file:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The dev override file (`docker-compose.dev.yml`):
- Uses `Dockerfile.dev` for frontend (Next.js dev server instead of production build)
- Mounts `frontend/app/`, `frontend/components/`, `frontend/lib/`, `frontend/config/`, `frontend/context/` for live editing
- Enables `WATCHPACK_POLLING=true` for Docker file-watching
- Sets `APP_ENV=development` and `APP_DEBUG=True` on backend (enables `/docs` and `/redoc`)

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
| `APP_VERSION` | `v0.3.0` | Shown in API health response |
| `PVGIS_BASE_URL` | `https://re.jrc.ec.europa.eu/api/v5_3/` | PVGIS API base URL |
| `OPEN_METEO_BASE_URL` | `https://archive-api.open-meteo.com/v1/archive` | Open-Meteo archive URL |
| `OPENMETEO_TIMEOUT` | `30` | HTTP timeout (seconds) for Open-Meteo requests |
| `PVGIS_TIMEOUT` | `90` | HTTP timeout (seconds) for PVGIS requests |
| `LOG_BASE_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `LOG_STREAM_HANDLER` | `True` | Print logs to stdout |

### Frontend Admin Configuration

Some UI features (like the Deep Comparison tools) use fixed parameters to simplify the interface. These are configured by administrators in `frontend/config/admin.json`:

```json
{
  "deepComparison": {
    "startYear": 2015,
    "endYear": 2020,
    "averageYearStrategy": "simple_mean"
  }
}
```

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
solarhesap/
├── backend/
│   ├── app/
│   │   ├── api/v1/                      # FastAPI route handlers
│   │   │   ├── solar_simulation_routes.py   # 14 simulation endpoints
│   │   │   └── solar_tools_routes.py        # 15 tools + 3 SAM/utility endpoints
│   │   ├── services/                    # Business logic layer
│   │   │   ├── clearsky_service.py          # 6 irradiance model orchestrators
│   │   │   ├── modelchain_service.py        # Standard ModelChain simulation
│   │   │   ├── advanced_modelchain_service.py # SAM database ModelChain
│   │   │   ├── deep_comparison.py           # Multi-model irradiance comparison
│   │   │   ├── deep_comparison_yield.py     # Multi-model AC yield comparison
│   │   │   ├── historical_service.py        # Historical year simulation
│   │   │   ├── irradiance_generator_service.py # Raw timeseries generation
│   │   │   ├── basic_electric_service.py    # Quick energy estimate
│   │   │   ├── solar_tools_service.py       # 15 standalone calculators
│   │   │   ├── super_avg_year.py            # Average-year strategy engine
│   │   │   ├── openmeteo_service.py         # Open-Meteo HTTP client
│   │   │   ├── pvgis_service.py             # PVGIS HTTP client
│   │   │   └── response_serializers.py      # Response formatting
│   │   ├── schemas/                     # Pydantic request/response models
│   │   ├── instesre_bird/               # INSTESRE Bird model implementation
│   │   ├── pvlib_tools/                 # pvlib wrappers (clearsky, ModelChain, SAM)
│   │   ├── average_year/               # Average-year strategy implementations
│   │   ├── outer_apis/                  # PVGIS + Open-Meteo HTTP clients
│   │   └── core/                        # Settings, logging, error handlers
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                             # Next.js App Router pages
│   │   ├── page.tsx                         # Home / Landing
│   │   ├── estimate/page.tsx                # Energy Estimate
│   │   ├── irradiance/page.tsx              # Irradiance Generator
│   │   ├── irradiance-comparison/page.tsx   # Irradiance Model Comparison
│   │   ├── comparison/page.tsx              # Energy Yield Comparison
│   │   ├── modelchain/page.tsx              # Advanced ModelChain
│   │   ├── historical/page.tsx              # Historical Analysis
│   │   ├── calculation/page.tsx             # 15 Solar Tools
│   │   ├── api-docs/page.tsx                # Interactive API Documentation
│   │   ├── about/page.tsx                   # About
│   │   ├── error.tsx                        # Global error boundary
│   │   └── not-found.tsx                    # 404 page
│   ├── components/
│   │   ├── charts/                      # Recharts wrappers
│   │   │   ├── DrillDownChart.tsx            # Irradiance drill-down
│   │   │   ├── EnergyDrillChart.tsx          # Energy production drill-down
│   │   │   ├── ComparisonChart.tsx           # Multi-model comparison
│   │   │   ├── HistoricalComparisonChart.tsx # Simulated vs. actual
│   │   │   └── ModelChainChart.tsx           # ModelChain output
│   │   ├── simulation/                  # Map picker, form components
│   │   ├── layout/                      # Navbar, Footer
│   │   └── shared/                      # GlassCard, InfoTooltip, reusable UI
│   ├── context/
│   │   ├── LanguageContext.tsx           # EN/TR bilingual provider
│   │   └── ThemeContext.tsx              # Dark/Light theme provider
│   ├── config/
│   │   └── admin.json                   # Admin-configurable parameters
│   ├── lib/
│   │   ├── api.ts                       # API client functions (18 endpoints)
│   │   ├── translations.ts             # EN/TR string table (650+ keys)
│   │   └── constants.ts                # Model configs, SAM DB lists, defaults
│   ├── Dockerfile                       # Production multi-stage build
│   └── Dockerfile.dev                   # Development (next dev)
├── nginx/
│   ├── nginx.conf.template              # Rate limiting + security headers
│   ├── entrypoint.sh
│   └── Dockerfile
├── docker-compose.yml                   # Production compose
├── docker-compose.dev.yml               # Development overrides (hot-reload)
├── DEPLOY.md                            # Deployment guide (English)
├── DEPLOY_TR.md                         # Deployment guide (Turkish)
└── README.md                            # This file
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

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Made with ☀️ as an Open Source Research Project**

[GitHub](https://github.com/yilmazaygin/solarhesap) · [Live Demo](https://solarhesap.net.tr)

</div>
