# ./backend/app/schemas/pvgis_response_schemas.py
"""Pydantic schemas for validating and documenting PVGIS API responses. These schemas structure the data returned by pvlib/PVGIS functions."""

from typing import Any
from pydantic import BaseModel, Field, ConfigDict

# Sub-schemas for specific response types
class PVGISMonthYear(BaseModel):
    """Represents the year selected for a specific month in TMY."""
    month: int = Field(default=..., ge=1, le=12)
    year: int = Field(default=..., ge=1900, le=2100)

# ================

class PVGISBaseResponseSchema(BaseModel):
    inputs: dict[str, Any] = Field(default_factory=dict, description="Dictionary of the request input parameters as returned by PVGIS.")
    metadata: dict[str, Any] | list[str] = Field(default_factory=dict, description="Metadata containing variable descriptions, units, or additional file information.")

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore",
    )

# ================

class PVGISHourlyResponseSchema(PVGISBaseResponseSchema):
    data: list[dict[str, Any]] = Field(default=..., description="Time-series of hourly data including radiation and PV power.")

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore",
        json_schema_extra={
            "example": {
                "data": [{"time": "2020-01-01T00:00:00Z", "poa_global": 120.5, "temp_air": 15.2}],
                "inputs": {"latitude": 38.4, "longitude": 27.1, "raddatabase": "PVGIS-SARAH2"},
                "metadata": {"G(i)": "Global irradiance on inclined plane (W/m2)"}
            }
        }
    )

# ================

class PVGISTMYResponseSchema(PVGISBaseResponseSchema):
    data: list[dict[str, Any]] = Field(default=..., description="The typical meteorological year weather data.")
    months_selected: list[PVGISMonthYear] = Field(default_factory=list, description="TMY year selected for each month.")

# ================

class PVGISHorizonResponseSchema(BaseModel):
    data: dict[float | str, float] = Field(default=..., description="Horizon profile: Azimuth (key) vs Elevation angle (value).")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata returned by the horizon tool.")

    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore",
        json_schema_extra={}
    )