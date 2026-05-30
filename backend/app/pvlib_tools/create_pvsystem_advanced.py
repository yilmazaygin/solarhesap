# ./backend/app/pvlib_tools/create_pvsystem_advanced.py
"""Build a pvlib PVSystem from an advanced request schema.

Handles:
- Module / inverter resolution from SAM databases or manual params
- Temperature model resolution from pvlib lookup table or manual params
- Flat system mode (PVSystem with system-level params)
- Multi-array mode (PVSystem with Array objects via FixedMount)
"""

from __future__ import annotations

import pandas as pd
from pvlib.pvsystem import PVSystem, Array, retrieve_sam
from pvlib.pvsystem import FixedMount
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

from app.core.logger import alogger
from app.core.exceptions import ValidationError as SolarValidationError
from app.schemas.advanced_modelchain_schemas import (
    RunModelChainAdvancedRequest,
    ModuleConfigSchema,
    InverterConfigSchema,
    TempModelConfigSchema,
    ModuleSourceEnum,
    InverterSourceEnum,
    TempParamSourceEnum,
)


# ===========================================================================
# Component resolvers
# ===========================================================================

def _resolve_module_params(module_cfg: ModuleConfigSchema) -> pd.Series | dict:
    """Return module parameters as a Series (from SAM db) or dict (manual)."""
    if module_cfg.source == ModuleSourceEnum.DATABASE:
        alogger.info(
            "Loading module '%s' from SAM db '%s'",
            module_cfg.module_name, module_cfg.db_name,
        )
        try:
            db = retrieve_sam(module_cfg.db_name)
        except Exception as exc:
            raise SolarValidationError(
                f"Failed to load SAM database '{module_cfg.db_name}': {exc}"
            ) from exc
        if module_cfg.module_name not in db.columns:
            raise SolarValidationError(
                f"Module '{module_cfg.module_name}' not found in '{module_cfg.db_name}'. "
                f"Use /solar-tools/list-sam-components?db={module_cfg.db_name}&search=... to search."
            )
        return db[module_cfg.module_name]

    alogger.info("Using manual module parameters: %s", list(module_cfg.parameters.keys()))
    return module_cfg.parameters


def _resolve_inverter_params(inv_cfg: InverterConfigSchema) -> pd.Series | dict:
    """Return inverter parameters as a Series (from SAM db) or dict (manual)."""
    if inv_cfg.source == InverterSourceEnum.DATABASE:
        alogger.info(
            "Loading inverter '%s' from SAM db '%s'",
            inv_cfg.inverter_name, inv_cfg.db_name,
        )
        try:
            db = retrieve_sam(inv_cfg.db_name)
        except Exception as exc:
            raise SolarValidationError(
                f"Failed to load SAM database '{inv_cfg.db_name}': {exc}"
            ) from exc
        if inv_cfg.inverter_name not in db.columns:
            raise SolarValidationError(
                f"Inverter '{inv_cfg.inverter_name}' not found in '{inv_cfg.db_name}'. "
                f"Use /solar-tools/list-sam-components?db={inv_cfg.db_name}&search=... to search."
            )
        return db[inv_cfg.inverter_name]

    alogger.info("Using manual inverter parameters: %s", list(inv_cfg.parameters.keys()))
    return inv_cfg.parameters


def _resolve_temp_params(temp_cfg: TempModelConfigSchema) -> dict:
    """Return temperature model parameters as a dict."""
    if temp_cfg.source == TempParamSourceEnum.LOOKUP:
        if temp_cfg.model not in TEMPERATURE_MODEL_PARAMETERS:
            raise SolarValidationError(
                f"Unknown temperature model: '{temp_cfg.model}'. "
                f"Available: {list(TEMPERATURE_MODEL_PARAMETERS.keys())}"
            )
        configs = TEMPERATURE_MODEL_PARAMETERS[temp_cfg.model]
        if temp_cfg.config not in configs:
            raise SolarValidationError(
                f"Unknown config '{temp_cfg.config}' for model '{temp_cfg.model}'. "
                f"Available: {list(configs.keys())}"
            )
        params = dict(configs[temp_cfg.config])
        alogger.info(
            "Loaded temperature params: model=%s config=%s → %s",
            temp_cfg.model, temp_cfg.config, params,
        )
        return params

    alogger.info("Using manual temperature parameters: %s", list(temp_cfg.parameters.keys()))
    return temp_cfg.parameters


# ===========================================================================
# PVSystem builder
# ===========================================================================

def create_pvsystem_advanced(request: RunModelChainAdvancedRequest) -> PVSystem:
    """Build a pvlib PVSystem from the advanced request.

    Multi-array mode:
        Builds pvlib Array objects with FixedMount. System-level module/temp
        params are irrelevant — pvlib ignores them when arrays= is provided.
        Inverter remains at system level.

    Flat mode:
        Builds PVSystem with system-level surface_tilt, surface_azimuth,
        module_parameters, temperature_model_parameters, etc.
    """
    inverter_params = _resolve_inverter_params(request.inverter)

    if request.use_arrays:
        pvlib_arrays: list[Array] = []
        for i, arr_cfg in enumerate(request.arrays):
            mod_params = _resolve_module_params(arr_cfg.module)
            temp_params = _resolve_temp_params(arr_cfg.temperature_model)

            arr = Array(
                mount=FixedMount(
                    surface_tilt=arr_cfg.surface_tilt,
                    surface_azimuth=arr_cfg.surface_azimuth,
                ),
                module_type=arr_cfg.module_type,
                module_parameters=mod_params,
                temperature_model_parameters=temp_params,
                modules_per_string=arr_cfg.modules_per_string,
                strings=arr_cfg.strings,
                name=arr_cfg.name or f"Array_{i + 1}",
                albedo=arr_cfg.albedo,
            )
            pvlib_arrays.append(arr)

        alogger.info(
            "Built multi-array PVSystem: %d arrays, inverter_params=%s",
            len(pvlib_arrays), list(inverter_params.keys()) if isinstance(inverter_params, dict) else "SAM Series",
        )
        return PVSystem(arrays=pvlib_arrays, inverter_parameters=inverter_params)

    # Flat mode
    flat = request.flat_system
    mod_params = _resolve_module_params(flat.module)
    temp_params = _resolve_temp_params(flat.temperature_model)

    alogger.info(
        "Built flat PVSystem: tilt=%.1f az=%.1f racking=%s modules/str=%d strings/inv=%d",
        flat.surface_tilt, flat.surface_azimuth, flat.racking_model,
        flat.modules_per_string, flat.strings_per_inverter,
    )
    return PVSystem(
        surface_tilt=flat.surface_tilt,
        surface_azimuth=flat.surface_azimuth,
        module_type=flat.module_type,
        module_parameters=mod_params,
        inverter_parameters=inverter_params,
        temperature_model_parameters=temp_params,
        modules_per_string=flat.modules_per_string,
        strings_per_inverter=flat.strings_per_inverter,
        racking_model=flat.racking_model,
    )
