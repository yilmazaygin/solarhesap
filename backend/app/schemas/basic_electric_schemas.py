# ./backend/app/schemas/basic_electric_schemas.py
"""Request schema for the Basic Electric Production Estimate endpoint."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class BasicElectricRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees.")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees.")
    elevation: float = Field(0.0, ge=0, le=8850, description="Elevation above sea level (m).")

    efficiency_tier: Literal["very_low", "low", "medium", "medium_high", "high"] = Field(
        ..., description="Panel efficiency preset to use."
    )

    # Area — either total m² or dimensions A × B
    area_m2: float | None = Field(None, gt=0, le=100_000, description="Total available area in m².")
    area_a: float | None = Field(None, gt=0, le=1_000, description="Area dimension A in metres.")
    area_b: float | None = Field(None, gt=0, le=1_000, description="Area dimension B in metres.")

    # Optional surface orientation (auto-calculated from latitude if omitted)
    surface_tilt: float | None = Field(None, ge=0, le=90, description="Panel tilt angle (°).")
    surface_azimuth: float | None = Field(None, ge=0, le=360, description="Panel azimuth angle (° from North).")

    @model_validator(mode="after")
    def validate_area(self) -> "BasicElectricRequest":
        if self.area_m2 is None:
            if self.area_a is None or self.area_b is None:
                raise ValueError(
                    "Provide either area_m2 or both area_a and area_b."
                )
        return self
