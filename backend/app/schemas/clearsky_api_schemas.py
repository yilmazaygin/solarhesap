# ./backend/app/schemas/clearsky_api_schemas.py
"""Pydantic request/response schemas for the solar simulation API endpoints."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Literal

from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.schemas.location_schema import LocationSchema
from app.schemas.pvsystem_schema import PVSystemSchema
from app.schemas.modelchain_schema import ModelChainConfigSchema


# ===========================================================================
# Enums
# ===========================================================================

class AvgYearStrategyEnum(str, Enum):
    """Available average-year strategies.

    ``all`` is a shorthand that expands to all four base strategies
    plus ``super_avg_year``.
    """

    SIMPLE_MEAN = "simple_mean"
    TRIMMED_MEAN = "trimmed_mean"
    EXPONENTIAL_WEIGHTED = "exponential_weighted"
    COMBINED = "combined"
    SUPER_AVG = "super_avg_year"
    ALL = "all"


class SolarModelEnum(str, Enum):
    """Supported solar simulation model identifiers."""

    INSTESRE_BIRD = "instesre_bird"
    INEICHEN = "ineichen"
    SIMPLIFIED_SOLIS = "simplified_solis"
    PVLIB_BIRD = "pvlib_bird"
    PVGIS_TMY = "pvgis_tmy"
    PVGIS_POA = "pvgis_poa"


# Keep backward-compatible alias
ClearskyModelEnum = SolarModelEnum


# ===========================================================================
# Helpers
# ===========================================================================

ALL_BASE_STRATEGIES: list[str] = [
    "simple_mean",
    "trimmed_mean",
    "exponential_weighted",
    "combined",
]


def resolve_strategies(strategies: list[str]) -> list[str]:
    """Expand ``'all'`` shorthand and return a de-duplicated strategy list."""
    if "all" in strategies:
        return ALL_BASE_STRATEGIES + ["super_avg_year"]
    return list(dict.fromkeys(strategies))  # preserves order, removes dupes


# ===========================================================================
# Request schemas
# ===========================================================================

class ClearskyBaseRequest(BaseModel):
    """Shared location fields used by every clearsky endpoint."""

    latitude: float = Field(..., ge=-90, le=90, description="Latitude (°N)")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude (°E)")
    elevation: float = Field(default=0.0, ge=-450, le=8850, description="Elevation (m ASL)")

    model_config = ConfigDict(str_strip_whitespace=True)


class ClearskyWithDatesRequest(ClearskyBaseRequest):
    """Extends the base with date range, timezone and avg-year configuration.

    All OpenMeteo-based clearsky models inherit from this.
    """

    start_year: int = Field(default=2015, ge=2005, le=2025, description="First year of analysis")
    end_year: int = Field(default=2020, ge=2005, le=2025, description="Last year of analysis")
    timezone: str = Field(default="UTC", description="IANA timezone for timestamps")

    # --- Average-year configuration ---
    avg_year_strategies: list[str] = Field(
        default=["combined"],
        description=(
            "Which avg-year strategies to compute. Accepts: "
            "simple_mean, trimmed_mean, exponential_weighted, combined, "
            "super_avg_year, all"
        ),
    )
    decay: float = Field(default=0.90, gt=0, lt=1, description="Exponential decay factor (0–1)")
    lower_percentile: float = Field(default=10.0, ge=0, le=50, description="Trimmed-mean lower %")
    upper_percentile: float = Field(default=90.0, ge=50, le=100, description="Trimmed-mean upper %")
    reference_year: int = Field(default=2023, description="Non-leap reference year for output")

    @model_validator(mode="after")
    def validate_year_range(self) -> ClearskyWithDatesRequest:
        if self.start_year > self.end_year:
            raise ValueError("start_year must be ≤ end_year")
        if self.end_year - self.start_year + 1 > 20:
            raise ValueError("Maximum range is 20 years")
        return self


# --- Model-specific request schemas ---

class InstestreBirdRequest(ClearskyWithDatesRequest):
    """INSTESRE Bird clear-sky model request."""
    ozone: float = Field(default=0.3, ge=0, le=1, description="Ozone column (atm-cm)")
    aod500: float = Field(default=0.1, ge=0, le=2, description="AOD at 500 nm")
    aod380: float = Field(default=0.15, ge=0, le=2, description="AOD at 380 nm")
    albedo: float = Field(default=0.2, ge=0, le=1, description="Surface albedo")
    solar_constant: float = Field(default=1367.0, gt=0, description="Solar constant (W/m²)")


class PvlibIneichenRequest(ClearskyWithDatesRequest):
    """pvlib Ineichen/Perez request — Linke turbidity is auto-looked up."""
    pass


class SimplifiedSolisRequest(ClearskyWithDatesRequest):
    """pvlib Simplified Solis request."""
    aod700: float = Field(default=0.1, ge=0, le=0.45, description="AOD at 700 nm")


class PvlibBirdRequest(ClearskyWithDatesRequest):
    """pvlib Bird request (same Bird model, pvlib implementation)."""
    ozone: float = Field(default=0.3, ge=0, le=1, description="Ozone column (atm-cm)")
    aod500: float = Field(default=0.1, ge=0, le=2, description="AOD at 500 nm")
    aod380: float = Field(default=0.15, ge=0, le=2, description="AOD at 380 nm")
    albedo: float = Field(default=0.2, ge=0, le=1, description="Surface albedo")
    asymmetry: float = Field(default=0.85, ge=0, le=1, description="Aerosol asymmetry factor")


class PvgisTmyRequest(ClearskyBaseRequest):
    """PVGIS TMY request — already a typical year, no avg-year needed."""
    startyear: int | None = Field(default=None, description="TMY calculation start year")
    endyear: int | None = Field(default=None, description="TMY calculation end year")
    usehorizon: bool = Field(default=True, description="Include horizon shading")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "latitude": 30,
                    "longitude": 30,
                    "elevation": 0,
                    "usehorizon": True
                }
            ]
        }
    }


class PvgisPOARequest(ClearskyWithDatesRequest):
    """PVGIS Hourly POA irradiance request."""
    surface_tilt: float = Field(default=0.0, ge=0, le=90, description="Panel tilt (°)")
    surface_azimuth: float = Field(default=180.0, ge=0, lt=360, description="Panel azimuth (0=N, 180=S)")
    usehorizon: bool = Field(default=True, description="Include horizon shading")
    raddatabase: str | None = Field(default=None, description="Radiation DB (default: PVGIS-SARAH2)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "latitude": 30,
                    "longitude": 30,
                    "elevation": 0,
                    "start_year": 2015,
                    "end_year": 2020,
                    "timezone": "UTC",
                    "avg_year_strategies": ["combined"],
                    "decay": 0.9,
                    "lower_percentile": 10,
                    "upper_percentile": 90,
                    "reference_year": 2023,
                    "surface_tilt": 0,
                    "surface_azimuth": 180,
                    "usehorizon": True,
                    "raddatabase": "PVGIS-SARAH3"
                }
            ]
        }
    }

    @model_validator(mode="after")
    def validate_pvgis_range(self) -> PvgisPOARequest:
        if self.end_year > 2023:
            raise ValueError("PVGIS SARAH2 data available only up to 2023")
        return self


class DeepComparisonRequest(ClearskyWithDatesRequest):
    """Deep comparison — runs selected models × strategies."""

    models: list[str] = Field(
        default=["instesre_bird", "ineichen", "simplified_solis", "pvlib_bird"],
        description="Which clearsky models to include",
    )
    include_pvgis_tmy: bool = Field(default=True, description="Include PVGIS TMY in comparison")
    include_pvgis_poa: bool = Field(default=False, description="Include PVGIS POA in comparison")
    surface_tilt: float = Field(default=0.0, ge=0, le=90, description="For PVGIS POA")
    surface_azimuth: float = Field(default=180.0, ge=0, lt=360, description="For PVGIS POA")

    # Model params (shared defaults)
    ozone: float = Field(default=0.3, ge=0, le=1)
    aod500: float = Field(default=0.1, ge=0, le=2)
    aod380: float = Field(default=0.15, ge=0, le=2)
    aod700: float = Field(default=0.1, ge=0, le=0.45)
    albedo: float = Field(default=0.2, ge=0, le=1)
    asymmetry: float = Field(default=0.85, ge=0, le=1)
    solar_constant: float = Field(default=1367.0, gt=0)


# ===========================================================================
# ModelChain simulation request
# ===========================================================================

class RunModelChainRequest(BaseModel):
    """Full PVLib ModelChain simulation request.

    Combines PV system hardware configuration with a weather data source
    selection to generate irradiance data and run a complete PV simulation
    in one request.

    Supported weather sources (``weather_source``):
    - ``instesre_bird``, ``ineichen``, ``simplified_solis``, ``pvlib_bird``
      → Clear-sky models with OpenMeteo atmospheric data + avg-year.
    - ``pvgis_tmy`` → PVGIS Typical Meteorological Year (already representative,
      no avg-year applied).
    - ``pvgis_poa`` → PVGIS multi-year POA irradiance + avg-year.
    """

    # --- PV System Configuration ---
    location: LocationSchema = Field(
        ...,
        description="Site location (latitude, longitude, optional tz/altitude/name).",
    )
    pvsystem: PVSystemSchema = Field(
        ...,
        description=(
            "PV system configuration: surface_tilt, surface_azimuth, "
            "module_parameters, inverter_parameters, temperature_model_parameters, "
            "modules_per_string, strings_per_inverter, racking_model, etc."
        ),
    )
    modelchain_config: ModelChainConfigSchema | None = Field(
        default=None,
        description=(
            "Optional ModelChain overrides (dc_model, ac_model, temperature_model, "
            "aoi_model, spectral_model, losses_model, etc.). "
            "If None, pvlib defaults are used."
        ),
    )

    # --- Weather / Data Source Selection ---
    weather_source: str = Field(
        default="ineichen",
        description=(
            "Which weather data source to use for the simulation. "
            "Options: instesre_bird, ineichen, simplified_solis, pvlib_bird, "
            "pvgis_tmy, pvgis_poa."
        ),
    )

    # --- Date Range & Timezone ---
    start_year: int = Field(default=2015, ge=2005, le=2025, description="First year of analysis")
    end_year: int = Field(default=2020, ge=2005, le=2025, description="Last year of analysis")
    timezone: str = Field(default="UTC", description="IANA timezone for timestamps")

    # --- Average-year configuration (ignored for pvgis_tmy) ---
    avg_year_strategies: list[str] = Field(
        default=["combined"],
        description=(
            "Which avg-year strategies to compute. Accepts: "
            "simple_mean, trimmed_mean, exponential_weighted, combined, "
            "super_avg_year, all. Ignored when weather_source is 'pvgis_tmy'."
        ),
    )
    decay: float = Field(default=0.90, gt=0, lt=1, description="Exponential decay factor (0–1)")
    lower_percentile: float = Field(default=10.0, ge=0, le=50, description="Trimmed-mean lower %")
    upper_percentile: float = Field(default=90.0, ge=50, le=100, description="Trimmed-mean upper %")
    reference_year: int = Field(default=2023, description="Non-leap reference year for output")

    # --- Atmospheric parameters (for clearsky models only) ---
    ozone: float = Field(default=0.3, ge=0, le=1, description="Ozone column (atm-cm)")
    aod500: float = Field(default=0.1, ge=0, le=2, description="AOD at 500 nm")
    aod380: float = Field(default=0.15, ge=0, le=2, description="AOD at 380 nm")
    aod700: float = Field(default=0.1, ge=0, le=0.45, description="AOD at 700 nm")
    albedo: float = Field(default=0.2, ge=0, le=1, description="Surface albedo")
    asymmetry: float = Field(default=0.85, ge=0, le=1, description="Aerosol asymmetry factor")
    solar_constant: float = Field(default=1367.0, gt=0, description="Solar constant (W/m²)")

    # --- PVGIS-specific parameters ---
    pvgis_startyear: int | None = Field(default=None, description="PVGIS TMY calculation start year")
    pvgis_endyear: int | None = Field(default=None, description="PVGIS TMY calculation end year")
    usehorizon: bool = Field(default=True, description="Include horizon shading (PVGIS)")
    raddatabase: str | None = Field(default=None, description="PVGIS radiation database (default: PVGIS-SARAH2)")
    pvgis_surface_tilt: float = Field(default=0.0, ge=0, le=90, description="Panel tilt for PVGIS POA (°)")
    pvgis_surface_azimuth: float = Field(default=180.0, ge=0, lt=360, description="Panel azimuth for PVGIS POA (0=N, 180=S)")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "examples": [
                {
                    "location": {
                        "latitude": 30,
                        "longitude": 30
                    },
                    "pvsystem": {
                        "surface_tilt": 30,
                        "surface_azimuth": 180,
                        "module_parameters": {
                            "pdc0": 250,
                            "gamma_pdc": -0.004
                        },
                        "inverter_parameters": {
                            "pdc0": 5000,
                            "eta_inv_nom": 0.96
                        },
                        "temperature_model_parameters": {
                            "a": -3.56,
                            "b": -0.075,
                            "deltaT": 3
                        }
                    },
                    "modelchain_config": {
                        "dc_model": "pvwatts",
                        "ac_model": "pvwatts",
                        "aoi_model": "no_loss",
                        "spectral_model": "no_loss"
                    },
                    "weather_source": "ineichen"
                }
            ]
        },
    )

    @model_validator(mode="after")
    def validate_modelchain_request(self) -> RunModelChainRequest:
        # Year range validation (not needed for pvgis_tmy)
        if self.weather_source != "pvgis_tmy":
            if self.start_year > self.end_year:
                raise ValueError("start_year must be ≤ end_year")
            if self.end_year - self.start_year + 1 > 20:
                raise ValueError("Maximum range is 20 years")
        # PVGIS POA SARAH2 limit
        if self.weather_source == "pvgis_poa" and self.end_year > 2023:
            raise ValueError("PVGIS SARAH2 data available only up to 2023")
        return self
