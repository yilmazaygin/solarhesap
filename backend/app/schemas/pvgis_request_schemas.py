# ./backend/app/schemas/pvgis_request_schemas.py
"""This file contains Pydantic schemas for validating and documenting PVGIS API request parameters."""

from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.core.settings import settings

class PVGISBaseRequestSchema(BaseModel):
    latitude: float = Field(default=..., ge=-90, le=90, description="Latitude in degrees north.")
    longitude: float = Field(default=..., ge=-180, le=180, description="Longitude in degrees east.")
    url: str = Field(default=settings.PVGIS_BASE_URL, description="Base PVGIS API URL.")
    timeout: int = Field(default=settings.PVGIS_TIMEOUT, gt=0, description="Request timeout in seconds.")

    def to_pvlib_params(self) -> dict[str, Any]:
        """Convert the schema into parameters compatible with pvlib."""
        return self.model_dump(exclude_none=True)

    model_config = ConfigDict(from_attributes=True, validate_assignment=True, str_strip_whitespace=True)

# ================

class PVGISHourlyRequestSchema(PVGISBaseRequestSchema):
    start: int | datetime | None = Field(default=None, description="First year (int) or datetime of the radiation time series.")
    end: int | datetime | None = Field(default=None, description="Last year (int) or datetime of the radiation time series.")
    raddatabase: str | None = Field(default=None, description="Name of radiation database. Depends on location.")
    components: bool = Field(default=True, description="If True, output solar radiation components.")
    surface_tilt: float = Field(default=0.0, ge=0, le=90, description="Tilt angle from horizontal plane.")
    surface_azimuth: float = Field(default=180.0, ge=0, lt=360, description="Surface azimuth clockwise from north (0=N, 90=E, 180=S, 270=W).")
    usehorizon: bool = Field(default=True, description="Include horizon shading effects.")
    userhorizon: list[float] | None = Field(default=None, description="User-defined horizon elevations (degrees).")
    pvcalculation: bool = Field(default=False, description="Return estimate of hourly PV production.")
    loss: float = Field(default=0.0, ge=0, le=100, description="Sum of PV system losses in percent.")
    peakpower: float | None = Field(default=None, gt=0, description="Nominal PV power in kW. Required if pvcalculation=True.")
    pvtechchoice: Literal["crystSi", "CIS", "CdTe", "Unknown"] = Field(default="crystSi", description="PV technology choice.")
    mountingplace: Literal["free", "building"] = Field(default="free", description="Mounting type.")
    trackingtype: Literal[0, 1, 2, 3, 4, 5] = Field(default=0, description="Tracking type.")
    optimal_surface_tilt: bool = Field(default=False, description="Calculate optimal tilt.")
    optimalangles: bool = Field(default=False, description="Calculate optimal tilt and azimuth angles.")
    outputformat: Literal["json", "csv"] = Field(default="json", description="Output format.")
    map_variables: bool = Field(default=True, description="Map output variables to pvlib naming.")

    @model_validator(mode="after")
    def validate_cross_fields(self) -> "PVGISHourlyRequestSchema":
        if self.pvcalculation and self.peakpower is None:
            raise ValueError("peakpower must be provided when pvcalculation=True")
        return self

# ================

class PVGISTMYRequestSchema(PVGISBaseRequestSchema):
    """PVGIS Typical Meteorological Year (TMY) request schema."""
    outputformat: Literal["csv", "basic", "epw", "json"] = Field(default="json", description="Output format of the TMY data.")
    usehorizon: bool = Field(default=True, description="Include effects of horizon shading.")
    userhorizon: list[float] | None = Field(default=None, description="Optional user-specified horizon elevation angles.")
    startyear: int | None = Field(default=None, description="First year to calculate the TMY.")
    endyear: int | None = Field(default=None, description="Last year to calculate the TMY.")
    map_variables: bool = Field(default=True, description="Rename dataframe columns to pvlib variable names.")

    @model_validator(mode="after")
    def validate_cross_fields(self) -> "PVGISTMYRequestSchema":
        if self.userhorizon is not None and not self.usehorizon:
            raise ValueError("userhorizon is only valid when usehorizon=True")
        return self

# ================

class PVGISHorizonRequestSchema(PVGISBaseRequestSchema):
    request_kwargs: dict[str, Any] | None = Field(default=None, description="Additional keyword arguments passed directly to requests.get.")

    def to_pvlib_params(self) -> dict[str, Any]:
        """Return pvlib-compatible params, unpacking request_kwargs."""
        params = self.model_dump(exclude_none=True)
        extra = params.pop("request_kwargs", {}) or {}
        params.update(extra)
        return params

    model_config = ConfigDict(extra="forbid", from_attributes=True, validate_assignment=True, str_strip_whitespace=True)