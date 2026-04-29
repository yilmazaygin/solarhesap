# ./backend/app/schemas/irradiance_generator_schemas.py
"""Pydantic schema for the Irradiance Generator endpoint.

Returns raw multi-year hourly irradiance data with no averaging strategy.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, ConfigDict, model_validator


class IrradianceModelEnum(str, Enum):
    INSTESRE_BIRD = "instesre_bird"
    INEICHEN = "ineichen"
    SIMPLIFIED_SOLIS = "simplified_solis"
    PVLIB_BIRD = "pvlib_bird"
    PVGIS_TMY = "pvgis_tmy"
    PVGIS_POA = "pvgis_poa"


class GenerateIrradianceRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # --- Model & Location ---
    model: IrradianceModelEnum = Field(..., description="Irradiance model to use")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation: float = Field(default=0.0, ge=-450, le=8850)
    timezone: str = Field(default="UTC")

    # --- Year range (required for all non-TMY models) ---
    start_year: int | None = Field(default=None, ge=2005, le=2025)
    end_year: int | None = Field(default=None, ge=2005, le=2025)

    # --- Atmospheric params (Bird / Ineichen / Solis) ---
    ozone: float = Field(default=0.3, ge=0, le=1)
    aod500: float = Field(default=0.1, ge=0, le=2)
    aod380: float = Field(default=0.15, ge=0, le=2)
    aod700: float = Field(default=0.1, ge=0, le=0.45)
    albedo: float = Field(default=0.2, ge=0, le=1)
    asymmetry: float = Field(default=0.85, ge=0, le=1)
    solar_constant: float = Field(default=1367.0, gt=0)

    # --- PVGIS POA params ---
    surface_tilt: float = Field(default=0.0, ge=0, le=90)
    surface_azimuth: float = Field(default=180.0, ge=0, lt=360)
    usehorizon: bool = Field(default=True)
    raddatabase: str | None = Field(default=None)

    # --- PVGIS TMY year range (optional, PVGIS uses its own internal range) ---
    pvgis_startyear: int | None = Field(default=None)
    pvgis_endyear: int | None = Field(default=None)

    @model_validator(mode="after")
    def validate_request(self) -> GenerateIrradianceRequest:
        if self.model != IrradianceModelEnum.PVGIS_TMY:
            if self.start_year is None or self.end_year is None:
                raise ValueError("start_year and end_year are required for non-TMY models")
            if self.start_year > self.end_year:
                raise ValueError("start_year must be ≤ end_year")
            if self.end_year - self.start_year + 1 > 20:
                raise ValueError("Maximum range is 20 years")
            if self.model == IrradianceModelEnum.PVGIS_POA and self.end_year > 2023:
                raise ValueError("PVGIS SARAH2 data available only up to 2023")
        return self
