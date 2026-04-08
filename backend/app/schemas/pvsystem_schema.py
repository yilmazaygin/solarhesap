# ./backend/app/schemas/pvsystem_schema.py
"""This file contains the PVSystemSchema class which defines the schema for photovoltaic system data."""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Literal, Union, Sequence
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.pvarray_schema import PVArraySchema

ArrayLike = Union[
    float,
    Sequence[float],
    np.ndarray,
    pd.Series
]

class PVSystemSchema(BaseModel):
    arrays: List[PVArraySchema] | None = Field(default=None, description="(Optional) List of PV arrays. If provided, flat configuration fields must not be used.")
    surface_tilt: ArrayLike = Field(default=0.0, ge=0, le=90, description="(default 0) Surface tilt angles in degrees from horizontal.")
    surface_azimuth: ArrayLike = Field(default=180.0, ge=0, lt=360, description="(default 180) Azimuth angle of the module surface. North=0, East=90, South=180, West=270.")
    albedo: float | None = Field(default=None, ge=0, le=1, description="(Optional) Ground surface albedo.")
    surface_type: str | None = Field(default=None, description="(Optional) The ground surface type.")
    module: str | None = Field(default=None, description="(Optional) Module model name.")
    module_type: Literal["glass_polymer", "glass_glass"] = Field(default="glass_polymer", description="(default 'glass_polymer') Describes the module's construction. Used for cell and module temperature calculations.")
    module_parameters: Union[Dict[str, Any], pd.Series] | None = Field(default=None, description="(Optional) Module parameters as defined by the SAPM, CEC, or other.")
    temperature_model_parameters: Union[Dict[str, Any], pd.Series] | None = Field(default=None, description="(Optional) Temperature model parameters as required by one of the models inpvlib.temperature (excluding poa_global, temp_air and wind_speed).")
    modules_per_string: int = Field(default=1, gt=0, description="(default 1) Modules per string.")
    strings_per_inverter: int = Field(default=1, gt=0, description="(default 1) Strings per inverter.")
    inverter: str | None = Field(default=None, description="(Optional) Inverter model name.")
    inverter_parameters: Union[Dict[str, Any], pd.Series] | None = Field(default=None, description="(Optional) Inverter parameters as defined by the SAPM, CEC, or other.")
    racking_model: Literal["open_rack", "close_mount", "insulated_back"] = Field(default="open_rack", description="(default 'open_rack') Used to identify a parameter set for the SAPM cell temperature model.")
    losses_parameters: Union[Dict[str, Any], pd.Series] | None = Field(default=None, description="(Optional) Losses parameters as defined by PVWatts or other.")
    name: str | None = Field(default=None, description="(Optional) System name.")

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        arbitrary_types_allowed=True,
        # This is for **kwargs, Arbitrary keyword arguments of PVSystem. Included for compatibility, but not used.
        extra="allow",
        # Add example json here
        json_schema_extra={}
    )
