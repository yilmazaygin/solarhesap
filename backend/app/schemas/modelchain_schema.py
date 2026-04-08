# ./backend/app/schemas/modelchain_schema.py
"""This file contains the ModelChainSchema which defines the expected input data structure for creating a pvlib ModelChain object."""

from typing import Callable
from pydantic import BaseModel, ConfigDict, Field
from pvlib.location import Location
from pvlib.pvsystem import PVSystem

class ModelChainSchema(BaseModel):
    system: PVSystem = Field(..., description="A pvlib.pvsystem.PVSystem object that representsthe connected set of modules, inverters, etc.")
    location: Location = Field(..., description="A pvlib.location.Location object representing the location of the PV system.")
    clearky_model: str | None = Field(default=None, description="(default 'ineichen') Passed to location.get_clearsky. Only used when DNI is not found inthe weather inputs.")
    transposition_model: str | None = Field(default=None, description="(default 'haydavies')Passed to system.get_irradiance.")
    solar_position_method: str | None = Field(default=None, description="(default 'nrel_numpy') Passed to location.get_solarposition.")
    airmass_model: str | None = Field(default=None, description="(default 'kastenyoung1989') Passed to location.get_airmass.")
    dc_model: str | Callable | None = Field(default=None, description="(Optional) If not specified, the model will be inferred from the parameters that are common to all of system.arrays[i].module_parameters. Valid strings are 'sapm', 'desoto', 'cec', 'pvsyst', 'pvwatts'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    ac_model: str | Callable | None = Field(default=None, description="(Optional) If not specified, the model will be inferred from the parameters that are common to all of system.inverter_parameters. Valid strings are 'sandia', 'adr', 'pvwatts'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    aoi_model: str | Callable | None = Field(default=None, description="(Optional) If not specified, the model will be inferred from the parameters that are common to all of system.arrays[i].module_parameters. Valid strings are 'physical', 'ashrae', 'sapm', 'martin_ruiz', 'interp' and 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    spectral_model: str | Callable | None = Field(default=None, description="(Optional)If not specified, the model will be inferred from the parameters that are common to all of system.arrays[i].module_parameters. Valid strings are 'sapm', 'first_solar', 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    temperature_model: str | Callable | None = Field(default=None, description="(Optional) Valid strings are: 'sapm', 'pvsyst', 'faiman', 'fuentes', 'noct_sam'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    dc_ohmic_model: str | Callable | None = Field(default=None, description="(default 'no_loss')Valid strings are 'dc_ohms_from_percent', 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    losses_model: str | Callable | None = Field(default=None, description="(default 'no_loss') Valid strings are 'pvwatts', 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    name: str | None = Field(default=None, description="(Optional) Name of ModelChain instance.")

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        arbitrary_types_allowed=True,
        extra="forbid",
        # Add example json here
        json_schema_extra={}
    )
    
class ModelChainConfigSchema(BaseModel):
    clearky_model: str | None = Field(default=None, description="(default 'ineichen') Passed to location.get_clearsky. Only used when DNI is not found inthe weather inputs.")
    transposition_model: str | None = Field(default=None, description="(default 'haydavies')Passed to system.get_irradiance.")
    solar_position_method: str | None = Field(default=None, description="(default 'nrel_numpy') Passed to location.get_solarposition.")
    airmass_model: str | None = Field(default=None, description="(default 'kastenyoung1989') Passed to location.get_airmass.")
    dc_model: str | Callable | None = Field(default=None, description="(Optional) If not specified, the model will be inferred from the parameters that are common to all of system.arrays[i].module_parameters. Valid strings are 'sapm', 'desoto', 'cec', 'pvsyst', 'pvwatts'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    ac_model: str | Callable | None = Field(default=None, description="(Optional) If not specified, the model will be inferred from the parameters that are common to all of system.inverter_parameters. Valid strings are 'sandia', 'adr', 'pvwatts'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    aoi_model: str | Callable | None = Field(default=None, description="(Optional) If not specified, the model will be inferred from the parameters that are common to all of system.arrays[i].module_parameters. Valid strings are 'physical', 'ashrae', 'sapm', 'martin_ruiz', 'interp' and 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    spectral_model: str | Callable | None = Field(default=None, description="(Optional)If not specified, the model will be inferred from the parameters that are common to all of system.arrays[i].module_parameters. Valid strings are 'sapm', 'first_solar', 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    temperature_model: str | Callable | None = Field(default=None, description="(Optional) Valid strings are: 'sapm', 'pvsyst', 'faiman', 'fuentes', 'noct_sam'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    dc_ohmic_model: str | Callable | None = Field(default=None, description="(default 'no_loss')Valid strings are 'dc_ohms_from_percent', 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    losses_model: str | Callable | None = Field(default=None, description="(default 'no_loss') Valid strings are 'pvwatts', 'no_loss'. The ModelChain instance will be passed as the first argument to a user-defined function.")
    name: str | None = Field(default=None, description="(Optional) Name of ModelChain instance.")

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        arbitrary_types_allowed=True,
        extra="forbid",
        # Add example json here
        json_schema_extra={}
    )