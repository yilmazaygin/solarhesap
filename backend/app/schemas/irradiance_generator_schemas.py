# ./backend/app/schemas/irradiance_generator_schemas.py
from __future__ import annotations

from datetime import date
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

    # --- Full date range (preferred) ---
    start_date: str | None = Field(default=None, description="ISO date string YYYY-MM-DD")
    end_date: str | None = Field(default=None, description="ISO date string YYYY-MM-DD")

    # --- Year-only fallback (kept for backward compatibility) ---
    start_year: int | None = Field(default=None, ge=2005, le=2025)
    end_year: int | None = Field(default=None, ge=2005, le=2025)

    # --- Atmospheric params ---
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

    # --- PVGIS TMY year range ---
    pvgis_startyear: int | None = Field(default=None)
    pvgis_endyear: int | None = Field(default=None)

    # Resolved date objects (set by validator)
    _resolved_start: date | None = None
    _resolved_end: date | None = None

    @model_validator(mode="after")
    def validate_request(self) -> GenerateIrradianceRequest:
        if self.model == IrradianceModelEnum.PVGIS_TMY:
            return self

        # Resolve dates: prefer full date strings, fall back to years
        if self.start_date and self.end_date:
            try:
                s = date.fromisoformat(self.start_date)
                e = date.fromisoformat(self.end_date)
            except ValueError as exc:
                raise ValueError(f"Invalid date format: {exc}") from exc
            self._resolved_start = s
            self._resolved_end = e
            # Backfill year fields for validation reuse
            self.start_year = s.year
            self.end_year = e.year
        elif self.start_year is not None and self.end_year is not None:
            self._resolved_start = date(self.start_year, 1, 1)
            self._resolved_end = date(self.end_year, 12, 31)
        else:
            raise ValueError("Provide start_date/end_date or start_year/end_year for non-TMY models")

        if self._resolved_start > self._resolved_end:
            raise ValueError("start date must be ≤ end date")
        if self.end_year - self.start_year + 1 > 20:
            raise ValueError("Maximum range is 20 years")
        if self.model == IrradianceModelEnum.PVGIS_POA and self.end_year > 2023:
            raise ValueError("PVGIS SARAH2 data available only up to 2023")
        return self

    @property
    def resolved_start(self) -> date:
        return self._resolved_start  # type: ignore[return-value]

    @property
    def resolved_end(self) -> date:
        return self._resolved_end  # type: ignore[return-value]
