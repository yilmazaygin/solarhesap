# ./backend/app/schemas/advanced_modelchain_schemas.py
"""Schemas for the advanced ModelChain simulation endpoint.

Supports full pvlib PVSystem feature access:
- Flat system OR multi-array mode (pvlib ignores flat params when arrays given)
- Module/inverter from SAM database or manual parameters
- Temperature model from pvlib lookup table or manual parameters
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Literal

from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.schemas.location_schema import LocationSchema
from app.schemas.modelchain_schema import ModelChainConfigSchema


# ===========================================================================
# Source enums
# ===========================================================================

class ModuleSourceEnum(str, Enum):
    DATABASE = "database"
    MANUAL = "manual"


class InverterSourceEnum(str, Enum):
    DATABASE = "database"
    MANUAL = "manual"


class TempParamSourceEnum(str, Enum):
    LOOKUP = "lookup"
    MANUAL = "manual"


# ===========================================================================
# Component resolution schemas
# ===========================================================================

class ModuleConfigSchema(BaseModel):
    """Module selection — either from a SAM database or manual parameters."""

    source: ModuleSourceEnum = Field(
        default=ModuleSourceEnum.DATABASE,
        description="'database' to load from SAM db, 'manual' to provide params directly",
    )
    db_name: str | None = Field(
        default=None,
        description="SAM database name: 'CECMod' (CEC, uses cec dc_model) or 'SandiaMod' (SAPM, uses sapm dc_model)",
    )
    module_name: str | None = Field(
        default=None,
        description="Exact module identifier in the selected database",
    )
    parameters: Dict[str, Any] | None = Field(
        default=None,
        description=(
            "Manual module parameters dict. "
            "pvwatts: {pdc0, gamma_pdc}. "
            "CEC: {a_ref, I_L_ref, I_o_ref, R_s, R_sh_ref, Adjust, gamma_r, ...}. "
            "SAPM: {Isco, Voco, Impo, Vmpo, ...}."
        ),
    )

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_source_fields(self) -> "ModuleConfigSchema":
        if self.source == ModuleSourceEnum.DATABASE:
            if not self.db_name:
                raise ValueError("db_name is required when source='database'")
            if not self.module_name:
                raise ValueError("module_name is required when source='database'")
        else:
            if not self.parameters:
                raise ValueError("parameters dict is required when source='manual'")
        return self


class InverterConfigSchema(BaseModel):
    """Inverter selection — either from a SAM database or manual parameters."""

    source: InverterSourceEnum = Field(
        default=InverterSourceEnum.DATABASE,
        description="'database' to load from SAM db, 'manual' to provide params directly",
    )
    db_name: str | None = Field(
        default=None,
        description=(
            "SAM database name: 'CECInverter' / 'SandiaInverter' (use sandia ac_model), "
            "'ADRInverter' (use adr ac_model)"
        ),
    )
    inverter_name: str | None = Field(
        default=None,
        description="Exact inverter identifier in the selected database",
    )
    parameters: Dict[str, Any] | None = Field(
        default=None,
        description=(
            "Manual inverter parameters dict. "
            "pvwatts: {pdc0, eta_inv_nom}. "
            "Sandia: {Pso, Paco, Pdco, Vdco, C0, C1, C2, C3, Pnt, ...}."
        ),
    )

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_source_fields(self) -> "InverterConfigSchema":
        if self.source == InverterSourceEnum.DATABASE:
            if not self.db_name:
                raise ValueError("db_name is required when source='database'")
            if not self.inverter_name:
                raise ValueError("inverter_name is required when source='database'")
        else:
            if not self.parameters:
                raise ValueError("parameters dict is required when source='manual'")
        return self


class TempModelConfigSchema(BaseModel):
    """Temperature model parameters — pvlib lookup or manual."""

    source: TempParamSourceEnum = Field(
        default=TempParamSourceEnum.LOOKUP,
        description="'lookup' to use pvlib named config, 'manual' to provide params directly",
    )
    model: str | None = Field(
        default="sapm",
        description="Temperature model: 'sapm' or 'pvsyst'",
    )
    config: str | None = Field(
        default="open_rack_glass_polymer",
        description=(
            "Named config from pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS. "
            "sapm configs: open_rack_glass_glass, close_mount_glass_glass, "
            "open_rack_glass_polymer, insulated_back_glass_polymer. "
            "pvsyst configs: freestanding, insulated."
        ),
    )
    parameters: Dict[str, Any] | None = Field(
        default=None,
        description=(
            "Manual temperature parameters. "
            "sapm: {a, b, deltaT}. "
            "pvsyst: {u_c, u_v}."
        ),
    )

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_source_fields(self) -> "TempModelConfigSchema":
        if self.source == TempParamSourceEnum.LOOKUP:
            if not self.model:
                raise ValueError("model is required when source='lookup'")
            if not self.config:
                raise ValueError("config is required when source='lookup'")
        else:
            if not self.parameters:
                raise ValueError("parameters dict is required when source='manual'")
        return self


# ===========================================================================
# System configuration schemas
# ===========================================================================

class FlatSystemConfigSchema(BaseModel):
    """Flat (non-array) PVSystem configuration.

    Used when use_arrays=False. All params apply at system level.
    pvlib will use these directly on PVSystem().
    """

    surface_tilt: float = Field(default=30.0, ge=0, le=90, description="Panel tilt angle (°)")
    surface_azimuth: float = Field(default=180.0, ge=0, lt=360, description="Panel azimuth (0=N, 180=S)")
    modules_per_string: int = Field(default=10, gt=0, description="Modules per string")
    strings_per_inverter: int = Field(default=1, gt=0, description="Strings per inverter")
    module_type: Literal["glass_polymer", "glass_glass"] = Field(
        default="glass_polymer",
        description="Module construction type (used for temperature model selection)",
    )
    racking_model: Literal["open_rack", "close_mount", "insulated_back"] = Field(
        default="open_rack",
        description="Racking model (used for SAPM temperature model parameter lookup)",
    )
    module: ModuleConfigSchema = Field(..., description="Module selection (database or manual)")
    temperature_model: TempModelConfigSchema = Field(
        ..., description="Temperature model parameters (lookup or manual)"
    )


class ArrayConfigSchema(BaseModel):
    """Configuration for a single pvlib Array.

    Used when use_arrays=True. Each array gets its own orientation,
    module parameters, and temperature model.
    Note: inverter_parameters remain at PVSystem level.
    """

    name: str | None = Field(default=None, description="Optional array name")
    surface_tilt: float = Field(default=30.0, ge=0, le=90)
    surface_azimuth: float = Field(default=180.0, ge=0, lt=360)
    modules_per_string: int = Field(default=10, gt=0)
    strings: int = Field(default=1, gt=0, description="Parallel strings in this array")
    module_type: Literal["glass_polymer", "glass_glass"] = "glass_polymer"
    albedo: float | None = Field(default=None, ge=0, le=1, description="Array-specific ground albedo")
    module: ModuleConfigSchema
    temperature_model: TempModelConfigSchema


# ===========================================================================
# Main request schema
# ===========================================================================

class RunModelChainAdvancedRequest(BaseModel):
    """Full advanced PVLib ModelChain simulation request.

    Key improvements over run-modelchain:
    - Module and inverter can be loaded directly from SAM databases (CECMod,
      SandiaMod, CECInverter, ADRInverter, etc.)
    - Multi-array mode properly uses pvlib Array objects (pvlib ignores flat
      system params when arrays are provided)
    - Temperature model can use pvlib's built-in named configurations
    - All pvlib PVSystem features accessible
    """

    # Location
    location: LocationSchema = Field(..., description="PV system site location")

    # System configuration mode
    use_arrays: bool = Field(
        default=False,
        description=(
            "False = flat PVSystem (flat_system required). "
            "True = multi-array PVSystem (arrays list required). "
            "When True, pvlib ignores any flat system-level orientation/module params."
        ),
    )

    # Flat mode (use_arrays=False)
    flat_system: FlatSystemConfigSchema | None = Field(
        default=None,
        description="Required when use_arrays=False. System-level PV configuration.",
    )

    # Array mode (use_arrays=True)
    arrays: list[ArrayConfigSchema] | None = Field(
        default=None,
        description="Required when use_arrays=True. Each entry defines one pvlib Array.",
    )

    # Inverter (always at system level, regardless of mode)
    inverter: InverterConfigSchema = Field(
        ...,
        description="Inverter configuration. System-level for both flat and array modes.",
    )

    # ModelChain configuration overrides
    modelchain_config: ModelChainConfigSchema | None = Field(
        default=None,
        description=(
            "Optional ModelChain overrides. If not set, pvlib auto-detects models "
            "from parameter sets (recommended when using SAM databases). "
            "Tip: CECMod→dc_model='cec', SandiaMod→dc_model='sapm', "
            "pvwatts params→dc_model='pvwatts'. "
            "CECInverter→ac_model='sandia', ADRInverter→ac_model='adr'."
        ),
    )

    # --- Weather source ---
    weather_source: str = Field(
        default="ineichen",
        description="instesre_bird | ineichen | simplified_solis | pvlib_bird | pvgis_tmy | pvgis_poa",
    )
    start_year: int = Field(default=2015, ge=2005, le=2025)
    end_year: int = Field(default=2020, ge=2005, le=2025)
    timezone: str = Field(default="UTC")
    avg_year_strategies: list[str] = Field(default=["combined"])
    decay: float = Field(default=0.90, gt=0, lt=1)
    lower_percentile: float = Field(default=10.0, ge=0, le=50)
    upper_percentile: float = Field(default=90.0, ge=50, le=100)
    reference_year: int = Field(default=2023)

    # Atmospheric params (clearsky models only)
    ozone: float = Field(default=0.3, ge=0, le=1)
    aod500: float = Field(default=0.1, ge=0, le=2)
    aod380: float = Field(default=0.15, ge=0, le=2)
    aod700: float = Field(default=0.1, ge=0, le=0.45)
    albedo: float = Field(default=0.2, ge=0, le=1)
    asymmetry: float = Field(default=0.85, ge=0, le=1)
    solar_constant: float = Field(default=1367.0, gt=0)

    # PVGIS-specific
    pvgis_startyear: int | None = None
    pvgis_endyear: int | None = None
    usehorizon: bool = True
    raddatabase: str | None = None
    pvgis_surface_tilt: float = Field(default=0.0, ge=0, le=90)
    pvgis_surface_azimuth: float = Field(default=180.0, ge=0, lt=360)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_request(self) -> "RunModelChainAdvancedRequest":
        if self.use_arrays:
            if not self.arrays:
                raise ValueError("arrays list is required when use_arrays=True")
            if len(self.arrays) == 0:
                raise ValueError("arrays list must contain at least one array")
        else:
            if not self.flat_system:
                raise ValueError("flat_system is required when use_arrays=False")

        if self.weather_source != "pvgis_tmy":
            if self.start_year > self.end_year:
                raise ValueError("start_year must be ≤ end_year")
            if self.end_year - self.start_year + 1 > 20:
                raise ValueError("Maximum range is 20 years")
        if self.weather_source == "pvgis_poa" and self.end_year > 2023:
            raise ValueError("PVGIS SARAH2 data available only up to 2023")
        return self
