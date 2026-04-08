# ./backend/app/schemas/pvlib_engine_schema.py
"""This file contains the PVLibEngineInputSchema which defines the expected input data structure for initializing a PVLibEngine instance."""

from pydantic import BaseModel, Field, ConfigDict
from app.schemas.location_schema import LocationSchema
from app.schemas.pvsystem_schema import PVSystemSchema
from app.schemas.modelchain_schema import ModelChainConfigSchema

class PVLibEngineInputSchema(BaseModel):
    location: LocationSchema = Field(..., description="Location configuration for the PV system site.")
    pvsystem: PVSystemSchema = Field(..., description="PV system configuration including module, inverter, and array parameters.")
    modelchain_config: ModelChainConfigSchema | None = Field(default=None, description="(Optional) ModelChain configuration overrides. If None, pvlib defaults are used for all model selections.")

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "location": {
                    "latitude": 38.42,
                    "longitude": 27.14,
                    "name": "Izmir City Center"
                },
                "pvsystem": {
                    "surface_tilt": 30,
                    "surface_azimuth": 180,
                    "module_parameters": {"pdc0": 250, "gamma_pdc": -0.004},
                    "inverter_parameters": {"pdc0": 5000, "eta_inv_nom": 0.96}
                }
            }
        }
    )
