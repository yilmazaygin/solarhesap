# ./backend/app/schemas/historical_schemas.py
"""Schemas for historical solar production simulation.

Uses PVGIS hourly POA data for a specific calendar year (2005-2022) instead
of TMY.  This produces actual-year irradiance data which can be compared
against real measured production data for that year.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator, ConfigDict

from app.schemas.advanced_modelchain_schemas import (
    FlatSystemConfigSchema,
    ArrayConfigSchema,
    InverterConfigSchema,
)
from app.schemas.modelchain_schema import ModelChainConfigSchema

HISTORICAL_YEAR_MIN = 2005
HISTORICAL_YEAR_MAX = 2022


class HistoricalBasicRequest(BaseModel):
    """Basic historical simulation — auto-configured system, PVGIS POA for a specific year.

    Mirrors BasicElectricRequest but uses actual PVGIS hourly POA data for the
    chosen year instead of TMY.  Panel layout and inverter selection are still
    automated from the efficiency-tier presets.
    """

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation: float = Field(0.0, ge=0, le=8850)
    year: int = Field(
        ...,
        ge=HISTORICAL_YEAR_MIN,
        le=HISTORICAL_YEAR_MAX,
        description=f"Calendar year for historical simulation ({HISTORICAL_YEAR_MIN}–{HISTORICAL_YEAR_MAX})",
    )
    efficiency_tier: Literal["very_low", "low", "medium", "medium_high", "high"]
    area_m2: float | None = Field(None, gt=0, le=100_000)
    area_a: float | None = Field(None, gt=0, le=1_000)
    area_b: float | None = Field(None, gt=0, le=1_000)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_area(self) -> "HistoricalBasicRequest":
        if self.area_m2 is None:
            if self.area_a is None or self.area_b is None:
                raise ValueError("Provide either area_m2 or both area_a and area_b.")
        return self


class HistoricalAdvancedRequest(BaseModel):
    """Advanced historical simulation — full ModelChain config, PVGIS POA for a specific year.

    Accepts the same system configuration as RunModelChainAdvancedRequest but
    forces weather_source='pvgis_poa' for the chosen year.  Surface orientation
    for PVGIS POA fetch is taken from flat_system (or first array in array mode).
    """

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation: float = Field(0.0, ge=0, le=8850)
    year: int = Field(..., ge=HISTORICAL_YEAR_MIN, le=HISTORICAL_YEAR_MAX)

    use_arrays: bool = Field(default=False)
    flat_system: FlatSystemConfigSchema | None = None
    arrays: list[ArrayConfigSchema] | None = None
    inverter: InverterConfigSchema
    modelchain_config: ModelChainConfigSchema | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_request(self) -> "HistoricalAdvancedRequest":
        if self.use_arrays:
            if not self.arrays:
                raise ValueError("arrays list is required when use_arrays=True")
        else:
            if not self.flat_system:
                raise ValueError("flat_system is required when use_arrays=False")
        return self
