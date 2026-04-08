# Solarhesap v0.2: High-Fidelity Solar Irradiance Simulation Engine

**Solarhesap** is an advanced, service-oriented ecosystem designed for high-fidelity solar irradiance modeling, multi-model data orchestration, and robust photovoltaic (PV) simulations. Funded as a **TÜBİTAK 2209** project, this backend (v0.2) delivers a robust FastAPI application serving pure physical and empirical radiation equations, orchestrating APIs from major climatological institutions, and providing specialized dataset averaging frameworks for researchers.

---

## Technical & Scientific Capabilities

The architecture is split into interconnected systems addressing varying degrees of simulation complexity.

### 1. Robust Clear-Sky Modeling
Solarhesap reconstructs theoretical irradiance components (GHI, DNI, DHI, POA) via pure physical implementations and robust empirical methodologies under cloudless atmospheric conditions:

* **Strict BIRD Model Implementation**: A foundational implementation based on the Bird & Hulstrom (1981) model, capable of translating astronomical models (Meeus), broadband aerosol transmissions, Rayleigh scattering, ozone absorption, and precipitable water dynamics. It features sub-zero atmospheric twilight protections ensuring continuous computational stability near the terminator.
* **Integrated Framework Capabilities**: Wraps globally standardized models configured to ingest exact coordinates and multi-year timeframes:
  * **Ineichen / Perez**: Resolves accurate broadband optical thickness variations using climatological Linke Turbidity factor derivatives.
  * **Simplified Solis**: Fits atmospheric transmissivity to the sophisticated Solis spectral parameterization using AOD boundary conditions.

### 2. Multi-Year Meteorological Data Aggregation
The engine establishes stable ETL pipelines from distinct global APIs, projecting decades of historical patterns into simulated time series matching exact boundary conditions.

* **Open-Meteo Archive Synchronization**: Reconstructs localized micro-climatologies dynamically via 8760-hour matrices. Integrates inputs containing localized temperatures, boundary wind gradients, and multi-layer optical depths.
* **PVGIS Data Aggregation**:
  * Extrapolates specialized datasets natively including PVGIS **TMY** (Typical Meteorological Year) outputs.
  * Resolves direct, diffuse and ground-reflected radiation dynamics on slanted surfaces directly mapping **Plane of Array (POA)** constraints alongside topographical horizons.

### 3. Advanced Strategy Compilation ("Average Year" Pipeline)
Data gathered over massive longitudinal periods (e.g., 2005-2023) are compiled via scientifically standardized compression paradigms to build idealized, synthetic reference years. 

* **Simple Mean Strategy**: Generates naive mathematical aggregations bridging anomalous noise.
* **Trimmed Mean Strategy**: Purges statistical outliers dynamically using percentile cut-offs (e.g., extracting extreme micro-variations).
* **Exponential Weighted Strategy**: Projects decaying influence onto historical phenomena, biasing recent shifts in macro-climates (identifying shifting irradiance realities).
* **Consensus (Super Average Year)**: Formats an aggressively flattened model resolving differences across varying mathematical permutations to formulate isolated "ground truth" datasets.

### 4. Pure Solar Calculation Utilities
An extensive array of stateless algorithmic calculations handles astronomical geometry down to precise numerical thresholds:
* **Astronomical Projections & Positionings**: Meeus Julian day configurations, localized solar noon extractions, Extraterrestrial Radiation bounds (ETR), and precise diurnal length determinations.
* **Radiometric Decompositions & Conversions**: Including dynamic *Erbs Decomposition* mapping global bounds to exact Direct/Diffuse compositions utilizing localized Clearness Indices ($K_T$).
* **Spatial Optimizations**: Computes optimized, bi-axial orientation limits (Optimal Tilt/Azimuth computations), and handles vector dot cross-product equations addressing structural Angles of Incidence.

---

## Core Technologies & Dependencies

* `FastAPI`: High-performance asynchronous framework controlling dependency injunction and schema validation structures.
* `Pydantic`: Standardized type casting utilizing structured input constraint validations.
* `uvicorn`: ASGI specification protocol serving endpoints.

## Scientific Acknowledgements & Citations

The strength of Solarhesap revolves through extensive orchestration of highly respected public research ecosystems and data structures. Any project mapping functionality through this service acknowledges the subsequent providers:

* **BIRD Model Base Logic**: Bird, R. E., & Hulstrom, R. L. (1981). *A Simplified Clear Sky Model for Direct and Diffuse Insolation on Horizontal Surfaces*. Technical Report SERI/TR-642-761, Solar Energy Research Institute.
* **PVLIB Framework**: Holmgren, W. F., Hansen, C. W., & Mikofski, M. A. (2018). *pvlib python: a python package for modeling solar energy systems*. Journal of Open Source Software, 3(29), 884.
* **PVGIS Integration Engine**: Raw solar projections derived from European Commission, Joint Research Centre (JRC) *Photovoltaic Geographical Information System*. 
* **Open-Meteo Integration Engine**: Zippenfenig, P. (2023). *Open-Meteo.com Weather API*. Seamless historical dataset API serving boundary atmospheric datasets.
