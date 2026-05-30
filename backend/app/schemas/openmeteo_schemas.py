# ./backend/app/schemas/openmeteo_schemas.py
"""This file contains Pydantic schemas for Open-Meteo request and response data."""

import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator

# Allowed hourly variable names accepted by the Open-Meteo Historical Weather API.
HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "apparent_temperature",
    "pressure_msl",
    "surface_pressure",
    "precipitation",
    "rain",
    "snowfall",
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "shortwave_radiation",
    "direct_radiation",
    "diffuse_radiation",
    "direct_normal_irradiance",
    "global_tilted_irradiance",
    "sunshine_duration",
    "wind_speed_10m",
    "wind_speed_100m",
    "wind_direction_10m",
    "wind_direction_100m",
    "wind_gusts_10m",
    "et0_fao_evapotranspiration",
    "weather_code",
    "snow_depth",
    "vapour_pressure_deficit",
    "soil_temperature_0_to_7cm",
    "soil_temperature_7_to_28cm",
    "soil_temperature_28_to_100cm",
    "soil_temperature_100_to_255cm",
    "soil_moisture_0_to_7cm",
    "soil_moisture_7_to_28cm",
    "soil_moisture_28_to_100cm",
    "soil_moisture_100_to_255cm",
]

# Allowed daily variable names accepted by the Open-Meteo Historical Weather API.
DAILY_VARIABLES = [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "apparent_temperature_mean",
    "precipitation_sum",
    "rain_sum",
    "snowfall_sum",
    "precipitation_hours",
    "sunrise",
    "sunset",
    "sunshine_duration",
    "daylight_duration",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "wind_direction_10m_dominant",
    "shortwave_radiation_sum",
    "et0_fao_evapotranspiration",
    "weather_code",
]


class OpenMeteoRequestSchema(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in degrees north.")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in degrees east.")
    start_date: datetime.date = Field(..., description="Start date of the historical range (YYYY-MM-DD).")
    end_date: datetime.date = Field(..., description="End date of the historical range (YYYY-MM-DD).")
    hourly: list[str] | None = Field(default=None, description="Hourly weather variables to request.")
    daily: list[str] | None = Field(default=None, description="Daily aggregated weather variables to request.")
    timezone: str = Field(default="UTC", description="Timezone for timestamps (e.g. 'UTC', 'Europe/Istanbul').")
    temperature_unit: Literal["celsius", "fahrenheit"] = Field(default="celsius", description="Temperature unit.")
    wind_speed_unit: Literal["kmh", "ms", "mph", "kn"] = Field(default="kmh", description="Wind speed unit.")
    precipitation_unit: Literal["mm", "inch"] = Field(default="mm", description="Precipitation unit.")

    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "latitude": 38.42,
                "longitude": 27.14,
                "start_date": "2020-01-01",
                "end_date": "2020-01-07",
                "hourly": ["temperature_2m", "precipitation"],
                "daily": ["temperature_2m_max", "temperature_2m_min"],
                "timezone": "UTC",
            }
        },
    )

    @model_validator(mode="after")
    def validate_dates_and_variables(self) -> "OpenMeteoRequestSchema":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")

        if not self.hourly and not self.daily:
            raise ValueError("At least one of 'hourly' or 'daily' must be provided")

        if self.hourly:
            invalid_hourly = [name for name in self.hourly if name not in HOURLY_VARIABLES]
            if invalid_hourly:
                raise ValueError(f"Invalid hourly variable(s): {invalid_hourly}")

        if self.daily:
            invalid_daily = [name for name in self.daily if name not in DAILY_VARIABLES]
            if invalid_daily:
                raise ValueError(f"Invalid daily variable(s): {invalid_daily}")

        return self

    def to_query_params(self) -> dict[str, str]:
        params: dict[str, str] = {
            "latitude": str(self.latitude),
            "longitude": str(self.longitude),
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "timezone": self.timezone,
            "temperature_unit": self.temperature_unit,
            "wind_speed_unit": self.wind_speed_unit,
            "precipitation_unit": self.precipitation_unit,
        }

        if self.hourly:
            params["hourly"] = ",".join(self.hourly)

        if self.daily:
            params["daily"] = ",".join(self.daily)

        return params


class OpenMeteoUnitsSchema(BaseModel):
    model_config = ConfigDict(extra="allow")


class OpenMeteoTimeSeriesSchema(BaseModel):
    time: list[str] = Field(..., description="ISO-8601 timestamps for each data point.")
    model_config = ConfigDict(extra="allow")


class OpenMeteoResponseSchema(BaseModel):
    latitude: float = Field(..., description="Latitude of the grid cell used.")
    longitude: float = Field(..., description="Longitude of the grid cell used.")
    elevation: float = Field(..., description="Elevation of the grid cell (m).")
    generationtime_ms: float = Field(..., description="Server-side generation time (ms).")
    utc_offset_seconds: int = Field(..., description="UTC offset in seconds.")
    timezone: str = Field(..., description="Timezone identifier.")
    timezone_abbreviation: str = Field(..., description="Timezone abbreviation.")
    hourly: OpenMeteoTimeSeriesSchema | None = Field(default=None, description="Hourly time-series data.")
    hourly_units: OpenMeteoUnitsSchema | None = Field(default=None, description="Units for hourly variables.")
    daily: OpenMeteoTimeSeriesSchema | None = Field(default=None, description="Daily time-series data.")
    daily_units: OpenMeteoUnitsSchema | None = Field(default=None, description="Units for daily variables.")

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        extra="ignore",
        json_schema_extra={
            "example": {
                "latitude": 38.4,
                "longitude": 27.1,
                "timezone": "UTC",
                "hourly": {
                    "time": ["2020-01-01T00:00", "2020-01-01T01:00"],
                    "temperature_2m": [9.1, 8.8],
                },
            }
        },
    )
