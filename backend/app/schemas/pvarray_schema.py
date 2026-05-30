# ./backend/app/schemas/pvarray_schema.py
"""This file contains the PVArraySchema class which defines the schema for a photovoltaic array."""

from typing import Dict, Any, Literal, Union
import pandas as pd
from pydantic import BaseModel, Field, ConfigDict

class PVArraySchema(BaseModel):
    mount: str | None = Field(default=None, description="Mounting for the array, e.g., FixedMount or SingleAxisTrackerMount. Used to determine module orientation. If not provided, a FixedMount with zero tilt is used.")
    albedo: float | None = Field(default=None, ge=0, le=1, description="(Optional) Ground surface albedo. If not supplied, then surface_type is used to look up a value in irradiance.SURFACE_ALBEDOS. If surface_type is also not supplied then a ground surface albedo of 0.25 is used.")
    surface_type: str | None = Field(default=None, description="(Optional) The ground surface type. See irradiance.SURFACE_ALBEDOS for valid values.")
    module: str | None = Field(default=None, description="(Optional) The model name of the modules. May be used to look up the module_parameters dictionary via some other method.")
    module_type: Literal["glass_polymer", "glass_glass"] = Field(default="glass_polymer", description="(Optional) Describes the module's construction. Valid strings are 'glass_polymer' and 'glass_glass'. Used for cell and module temperature calculations.")
    module_parameters: Union[Dict[str, Any], pd.Series] | None = Field(default=None, description="(Optional) Parameters for the module model, e.g., SAPM, CEC, or other. Accepts dict or pandas Series.")
    temperature_model_parameters: Union[Dict[str, Any], pd.Series] | None = Field(default=None, description="(Optional) Parameters for the module temperature model, e.g., SAPM, Pvsyst, or other.")
    modules_per_string: int = Field(default=1, gt=0, description="(default 1) Number of modules per string in the array.")
    strings: int = Field(default=1, gt=0, description="(default 1) Number of parallel strings in the array.")
    array_losses_parameters: Union[Dict[str, Any], pd.Series] | None = Field(default=None, description="(Optional) Supported keys are 'dc_ohmic_percent'.")
    name: str | None = Field(default=None, description="(Optional) Name of Array instance.")

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        arbitrary_types_allowed=True,
        extra="forbid",
        # Add example json here
        json_schema_extra={}
        )