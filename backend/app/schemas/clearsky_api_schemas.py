# ./backend/app/schemas/clearsky_api_schemas.py
"""Pydantic request/response schemas for the clearsky API endpoints."""

from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, model_validator


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


class ClearskyModelEnum(str, Enum):
    """Supported clearsky model identifiers."""

    INSTESRE_BIRD = "instesre_bird"
    INEICHEN = "ineichen"
    SIMPLIFIED_SOLIS = "simplified_solis"
    PVLIB_BIRD = "pvlib_bird"
    PVGIS_TMY = "pvgis_tmy"
    PVGIS_POA = "pvgis_poa"


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
    end_year: int = Field(default=2024, ge=2005, le=2025, description="Last year of analysis")
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


class PvgisPOARequest(ClearskyWithDatesRequest):
    """PVGIS Hourly POA irradiance request."""
    surface_tilt: float = Field(default=0.0, ge=0, le=90, description="Panel tilt (°)")
    surface_azimuth: float = Field(default=180.0, ge=0, lt=360, description="Panel azimuth (0=N, 180=S)")
    usehorizon: bool = Field(default=True, description="Include horizon shading")
    raddatabase: str | None = Field(default=None, description="Radiation DB (default: PVGIS-SARAH2)")

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
