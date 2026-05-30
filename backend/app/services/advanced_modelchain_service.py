# ./backend/app/services/advanced_modelchain_service.py
"""Advanced ModelChain simulation service.

Mirrors modelchain_service.py but uses RunModelChainAdvancedRequest and
create_pvsystem_advanced() to support full pvlib feature access:
  - SAM database module/inverter lookup
  - pvlib named temperature model configurations
  - Proper multi-array PVSystem construction
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.core.logger import alogger
from app.core.exceptions import SimulationError, ValidationError as SolarValidationError
from app.schemas.advanced_modelchain_schemas import RunModelChainAdvancedRequest
from app.schemas.clearsky_api_schemas import (
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisTmyRequest,
    PvgisPOARequest,
    resolve_strategies,
)
from app.pvlib_tools.pvlib_engine import PVLibEngine
from app.pvlib_tools.create_pvsystem_advanced import create_pvsystem_advanced
from app.pvlib_tools.create_location import create_location
from app.services.response_serializers import (
    DEFAULT_VALUE_COLS,
    POA_VALUE_COLS,
    avg_year_for_strategy,
    format_strategy_result,
    serialize_simulation_result,
)


# ===========================================================================
# Fail-fast validation
# ===========================================================================

def _validate_advanced_config(request: RunModelChainAdvancedRequest) -> None:
    """Eagerly validate the entire PV configuration before fetching weather.

    Builds Location → PVSystem → ModelChain. Fails fast with a clear error
    if any configuration is invalid (bad module name, incompatible dc_model, etc.)
    so the user doesn't wait for a long data fetch that will ultimately fail.
    """
    import time
    start = time.perf_counter()
    try:
        location = create_location(request.location)
        system = create_pvsystem_advanced(request)

        mc_config: dict = {}
        if request.modelchain_config is not None:
            mc_config = request.modelchain_config.model_dump(exclude_none=True)

        from pvlib.modelchain import ModelChain
        mc = ModelChain(system=system, location=location, **mc_config)

        elapsed_ms = (time.perf_counter() - start) * 1000
        alogger.info(
            "Advanced Fail-Fast: validation passed in %.2f ms (dc=%s ac=%s)",
            elapsed_ms, mc.dc_model, mc.ac_model,
        )
    except SolarValidationError:
        raise
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000
        alogger.warning(
            "Advanced Fail-Fast: config rejected in %.2f ms — %s", elapsed_ms, exc
        )
        raise SolarValidationError(
            f"PV configuration error: {exc}. "
            "Check module_parameters, inverter_parameters, temperature_model, "
            "and modelchain_config compatibility."
        ) from exc
    except Exception as exc:
        raise SolarValidationError(f"PV configuration validation failed: {exc}") from exc


# ===========================================================================
# Weather request builders (reuses existing schema types)
# ===========================================================================

def _build_weather_request(request: RunModelChainAdvancedRequest):
    """Build a model-specific weather request from the advanced request."""
    model = request.weather_source
    common = dict(
        latitude=request.location.latitude,
        longitude=request.location.longitude,
        elevation=request.location.altitude or 0.0,
        start_year=request.start_year,
        end_year=request.end_year,
        timezone=request.timezone,
        avg_year_strategies=request.avg_year_strategies,
        decay=request.decay,
        lower_percentile=request.lower_percentile,
        upper_percentile=request.upper_percentile,
        reference_year=request.reference_year,
    )

    if model == "instesre_bird":
        return InstestreBirdRequest(
            **common,
            ozone=request.ozone, aod500=request.aod500,
            aod380=request.aod380, albedo=request.albedo,
            solar_constant=request.solar_constant,
        )
    elif model == "ineichen":
        return PvlibIneichenRequest(**common)
    elif model == "simplified_solis":
        return SimplifiedSolisRequest(**common, aod700=request.aod700)
    elif model == "pvlib_bird":
        return PvlibBirdRequest(
            **common,
            ozone=request.ozone, aod500=request.aod500,
            aod380=request.aod380, albedo=request.albedo,
            asymmetry=request.asymmetry,
        )
    elif model == "pvgis_poa":
        return PvgisPOARequest(
            **common,
            surface_tilt=request.pvgis_surface_tilt,
            surface_azimuth=request.pvgis_surface_azimuth,
            usehorizon=request.usehorizon,
            raddatabase=request.raddatabase,
        )
    elif model == "pvgis_tmy":
        return PvgisTmyRequest(
            latitude=request.location.latitude,
            longitude=request.location.longitude,
            elevation=request.location.altitude or 0.0,
            startyear=request.pvgis_startyear,
            endyear=request.pvgis_endyear,
            usehorizon=request.usehorizon,
        )
    raise ValueError(f"Unsupported weather_source: '{model}'")


# ===========================================================================
# Engine runner
# ===========================================================================

def _run_engine(
    request: RunModelChainAdvancedRequest,
    weather_df: pd.DataFrame,
) -> dict[str, Any]:
    """Run PVLibEngine with the advanced PVSystem configuration."""
    try:
        location = create_location(request.location)
        system = create_pvsystem_advanced(request)

        mc_config: dict = {}
        if request.modelchain_config is not None:
            mc_config = request.modelchain_config.model_dump(exclude_none=True)

        from pvlib.modelchain import ModelChain
        mc = ModelChain(system=system, location=location, **mc_config)

        if not isinstance(weather_df.index, pd.DatetimeIndex):
            weather_df.index = pd.DatetimeIndex(weather_df.index)

        # Detect irradiance type and run appropriate simulation
        cols = set(weather_df.columns)
        if "effective_irradiance" in cols:
            mc.run_model_from_effective_irradiance(weather_df)
        elif "poa_global" in cols:
            mc.run_model_from_poa(weather_df)
        elif "ghi" in cols:
            mc.run_model(weather_df)
        else:
            raise SimulationError(
                f"Cannot detect irradiance type from columns: {list(weather_df.columns)}"
            )

        from collections import namedtuple
        MCResult = namedtuple("MCResult", ["ac", "dc", "total_irrad"])
        result = MCResult(ac=mc.results.ac, dc=mc.results.dc, total_irrad=mc.results.total_irrad)
        return serialize_simulation_result(result)

    except SimulationError:
        raise
    except Exception as exc:
        raise SimulationError(f"PVLib ModelChain simulation failed: {exc}") from exc


# ===========================================================================
# Handlers per weather source
# ===========================================================================

def _run_clearsky(request: RunModelChainAdvancedRequest) -> dict[str, Any]:
    from app.services.clearsky_service import (
        _generate_instesre_bird, _generate_ineichen,
        _generate_simplified_solis, _generate_pvlib_bird,
    )
    generators = {
        "instesre_bird": _generate_instesre_bird,
        "ineichen": _generate_ineichen,
        "simplified_solis": _generate_simplified_solis,
        "pvlib_bird": _generate_pvlib_bird,
    }
    model_name = request.weather_source
    clearsky_req = _build_weather_request(request)
    multi_year_df = generators[model_name](clearsky_req)

    alogger.info("Multi-year data: %d rows, columns=%s", len(multi_year_df), list(multi_year_df.columns))

    value_columns = [c for c in DEFAULT_VALUE_COLS if c in multi_year_df.columns]
    strategies = resolve_strategies(request.avg_year_strategies)

    irradiance_results: dict[str, Any] = {}
    simulation_results: dict[str, Any] = {}

    for strategy_name in strategies:
        avg_df = avg_year_for_strategy(
            multi_year_df, strategy_name, value_columns,
            request.reference_year, request.decay,
            request.lower_percentile, request.upper_percentile,
        )
        irradiance_results[strategy_name] = format_strategy_result(avg_df, strategy_name, value_columns)

        weather_df = avg_df[value_columns].copy()
        alogger.info("Running simulation for strategy '%s'", strategy_name)
        simulation_results[strategy_name] = _run_engine(request, weather_df)

    return {
        "model": model_name,
        "simulation_type": "advanced_modelchain",
        "location": {
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "altitude": request.location.altitude,
        },
        "year_range": {"start_year": request.start_year, "end_year": request.end_year},
        "multi_year_rows": len(multi_year_df),
        "irradiance_results": irradiance_results,
        "simulation_results": simulation_results,
    }


def _run_pvgis_tmy(request: RunModelChainAdvancedRequest) -> dict[str, Any]:
    from app.schemas.pvgis_request_schemas import PVGISTMYRequestSchema
    from app.services.pvgis_service import get_tmy_data

    alogger.info("Advanced: PVGIS TMY for (%.4f, %.4f)", request.location.latitude, request.location.longitude)

    pvgis_req = PVGISTMYRequestSchema(
        latitude=request.location.latitude,
        longitude=request.location.longitude,
        startyear=request.pvgis_startyear,
        endyear=request.pvgis_endyear,
        usehorizon=request.usehorizon,
    )
    df, metadata = get_tmy_data(pvgis_req, round_time=True)

    ref_year = request.reference_year
    new_index = df.index.map(
        lambda dt: dt.replace(year=ref_year) if not (dt.month == 2 and dt.day == 29)
        else dt.replace(year=ref_year, month=2, day=28)
    )
    df.index = pd.DatetimeIndex(new_index)

    value_cols = [c for c in DEFAULT_VALUE_COLS if c in df.columns]
    irr_cols = [c for c in ["ghi", "dni", "dhi"] if c in df.columns]
    summary: dict[str, float] = {}
    for col in irr_cols:
        summary[f"annual_{col}_kwh_m2"] = round(float(df[col].sum() / 1000.0), 2)
        summary[f"peak_{col}_w_m2"] = round(float(df[col].max()), 2)

    hourly_df = df[value_cols].copy()
    hourly_df.index = hourly_df.index.strftime("%Y-%m-%dT%H:%M:%S")
    hourly_records = hourly_df.reset_index().rename(columns={"index": "datetime"}).to_dict(orient="records")

    irradiance_results = {
        "tmy": {"strategy": "tmy", "summary": summary, "hourly": hourly_records}
    }

    weather_df = df[value_cols].copy()
    simulation_results = {"tmy": _run_engine(request, weather_df)}

    return {
        "model": "pvgis_tmy",
        "simulation_type": "advanced_modelchain",
        "location": {
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "altitude": request.location.altitude,
        },
        "metadata": {"months_selected": metadata.get("months_selected", [])},
        "irradiance_results": irradiance_results,
        "simulation_results": simulation_results,
    }


def _run_pvgis_poa(request: RunModelChainAdvancedRequest) -> dict[str, Any]:
    from app.services.clearsky_service import _generate_pvgis_poa

    alogger.info("Advanced: PVGIS POA for (%.4f, %.4f)", request.location.latitude, request.location.longitude)

    pvgis_req = _build_weather_request(request)
    multi_year_df = _generate_pvgis_poa(pvgis_req)

    value_columns = [c for c in POA_VALUE_COLS if c in multi_year_df.columns]
    strategies = resolve_strategies(request.avg_year_strategies)

    irradiance_results: dict[str, Any] = {}
    simulation_results: dict[str, Any] = {}

    for strategy_name in strategies:
        avg_df = avg_year_for_strategy(
            multi_year_df, strategy_name, value_columns,
            request.reference_year, request.decay,
            request.lower_percentile, request.upper_percentile,
        )
        irradiance_results[strategy_name] = format_strategy_result(avg_df, strategy_name, value_columns)

        weather_df = avg_df[value_columns].copy()
        simulation_results[strategy_name] = _run_engine(request, weather_df)

    return {
        "model": "pvgis_poa",
        "simulation_type": "advanced_modelchain",
        "location": {
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "altitude": request.location.altitude,
        },
        "year_range": {"start_year": request.start_year, "end_year": request.end_year},
        "multi_year_rows": len(multi_year_df),
        "irradiance_results": irradiance_results,
        "simulation_results": simulation_results,
    }


# ===========================================================================
# Public entry point
# ===========================================================================

def run_advanced_modelchain(request: RunModelChainAdvancedRequest) -> dict[str, Any]:
    """Run a full advanced PVLib ModelChain simulation.

    Steps:
    1. Fail-fast: validate entire PV config before fetching weather
    2. Dispatch to weather handler
    3. For each avg-year strategy: avg-year + simulate
    """
    source = request.weather_source
    alogger.info(
        "Advanced ModelChain: source='%s' use_arrays=%s lat=%.4f lon=%.4f",
        source, request.use_arrays,
        request.location.latitude, request.location.longitude,
    )

    _validate_advanced_config(request)

    if source in ("instesre_bird", "ineichen", "simplified_solis", "pvlib_bird"):
        return _run_clearsky(request)
    elif source == "pvgis_tmy":
        return _run_pvgis_tmy(request)
    elif source == "pvgis_poa":
        return _run_pvgis_poa(request)
    else:
        raise ValueError(
            f"Unsupported weather_source '{source}'. "
            "Supported: instesre_bird, ineichen, simplified_solis, pvlib_bird, pvgis_tmy, pvgis_poa"
        )
