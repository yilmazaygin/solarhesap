# ./backend/app/schemas/solar_tools_schemas.py
"""Pydantic request schemas for solar calculation tool endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field, ConfigDict
from typing import Literal


class DateTimeInput(BaseModel):
    """Common date-time fields."""
    year: int = Field(..., ge=1, le=9999)
    month: int = Field(..., ge=1, le=12)
    day: int = Field(..., ge=1, le=31)
    hour: int = Field(default=12, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    second: int = Field(default=0, ge=0, le=59)

    model_config = ConfigDict(str_strip_whitespace=True)


class LocationDateInput(DateTimeInput):
    """Location + date-time fields."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class JulianDayRequest(BaseModel):
    """Can use explicit fields or an ISO string."""
    year: int | None = Field(default=None, ge=1, le=9999)
    month: int | None = Field(default=None, ge=1, le=12)
    day: int | None = Field(default=None, ge=1, le=31)
    hour: int = Field(default=0, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    second: int = Field(default=0, ge=0, le=59)
    iso_string: str | None = Field(default=None, description="ISO 8601 datetime, e.g. 2024-06-15T12:30:00")


class SolarPositionRequest(LocationDateInput):
    """Solar position calculation request."""
    pass


class SunriseSunsetRequest(BaseModel):
    """Sunrise/sunset calculation request."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    year: int = Field(..., ge=1, le=9999)
    month: int = Field(..., ge=1, le=12)
    day: int = Field(..., ge=1, le=31)


class AirmassRequest(BaseModel):
    """Air mass calculation request."""
    zenith_deg: float = Field(..., ge=0, le=180)
    model: Literal["kastenyoung", "kasten", "simple"] = Field(default="kastenyoung")


class ExtraterrestrialRequest(BaseModel):
    """Extraterrestrial irradiance request."""
    year: int = Field(..., ge=1, le=9999)
    month: int = Field(..., ge=1, le=12)
    day: int = Field(..., ge=1, le=31)
    solar_constant: float = Field(default=1367.0, gt=0)


class DewPointRequest(BaseModel):
    """Dew point to precipitable water request."""
    dew_point_c: float = Field(..., ge=-80, le=60)


class StationPressureRequest(BaseModel):
    """Station pressure from elevation request."""
    elevation_m: float = Field(..., ge=-450, le=8850)
    sea_level_pressure_hpa: float = Field(default=1013.25, gt=0)


class ISAPressureRequest(BaseModel):
    """ISA (Int'l Standard Atmosphere) pressure request."""
    elevation_m: float = Field(..., ge=0, le=11000)


class AngleOfIncidenceRequest(BaseModel):
    """Angle of incidence calculation request."""
    surface_tilt: float = Field(..., ge=0, le=90)
    surface_azimuth: float = Field(..., ge=0, lt=360)
    solar_zenith: float = Field(..., ge=0, le=180)
    solar_azimuth: float = Field(..., ge=0, lt=360)


class OptimalTiltRequest(BaseModel):
    """Optimal tilt estimate request."""
    latitude: float = Field(..., ge=-90, le=90)


class InstantBirdRequest(LocationDateInput):
    """Instant BIRD clearsky calculation request."""
    elevation: float = Field(default=0.0, ge=-450, le=8850)
    pressure_sea_level: float = Field(default=1013.25, gt=0)
    ozone: float = Field(default=0.3, ge=0, le=1)
    precipitable_water: float = Field(default=1.42, ge=0, le=10)
    aod500: float = Field(default=0.1, ge=0, le=2)
    aod380: float = Field(default=0.15, ge=0, le=2)
    albedo: float = Field(default=0.2, ge=0, le=1)
    solar_constant: float = Field(default=1367.0, gt=0)


class SolarDeclinationRequest(BaseModel):
    """Solar declination request."""
    year: int = Field(..., ge=1, le=9999)
    month: int = Field(..., ge=1, le=12)
    day: int = Field(..., ge=1, le=31)


class LinkeTurbidityRequest(BaseModel):
    """Linke turbidity estimate request."""
    elevation_m: float = Field(default=0.0, ge=-450, le=8850)
    precipitable_water_cm: float = Field(default=1.4, ge=0, le=10)
    aod700: float = Field(default=0.1, ge=0, le=0.45)


class ErbsDecompositionRequest(BaseModel):
    """Erbs GHI decomposition request."""
    ghi: float = Field(..., ge=0, le=1500)
    zenith_deg: float = Field(..., ge=0, le=180)
    day_of_year: int = Field(..., ge=1, le=366)
    solar_constant: float = Field(default=1367.0, gt=0)


class POAIrradianceRequest(BaseModel):
    """POA irradiance (isotropic model) request."""
    ghi: float = Field(..., ge=0, le=1500)
    dni: float = Field(..., ge=0, le=1500)
    dhi: float = Field(..., ge=0, le=1000)
    surface_tilt: float = Field(..., ge=0, le=90)
    surface_azimuth: float = Field(..., ge=0, lt=360)
    solar_zenith: float = Field(..., ge=0, le=180)
    solar_azimuth: float = Field(..., ge=0, lt=360)
    albedo: float = Field(default=0.2, ge=0, le=1)
