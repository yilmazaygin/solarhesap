# ./backend/app/services/modelchain_service.py
"""PVLib ModelChain simulation service.

Extracted from ``clearsky_service.py`` to honour Separation of Concerns.
Handles the full ModelChain workflow: weather generation → avg-year →
PVLib Engine → result serialisation.

Routes should call ``run_modelchain()`` — the only public entry point.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.core.logger import alogger
from app.core.exceptions import SimulationError
from app.schemas.clearsky_api_schemas import (
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisTmyRequest,
    PvgisPOARequest,
    RunModelChainRequest,
    resolve_strategies,
)
from app.schemas.pvlib_engine_schema import PVLibEngineInputSchema
from app.pvlib_tools.pvlib_engine import PVLibEngine
from app.services.response_serializers import (
    DEFAULT_VALUE_COLS,
    POA_VALUE_COLS,
    avg_year_for_strategy,
    format_strategy_result,
    serialize_simulation_result,
)


# ===========================================================================
# Fail-Fast: Dry-run ModelChain validation
# ===========================================================================

def _validate_modelchain_config(request: RunModelChainRequest) -> None:
    """Eagerly validate PVLib configuration BEFORE fetching weather data.

    Attempts to build Location → PVSystem → ModelChain with the provided
    parameters.  If *any* of these steps fail (e.g. missing
    ``module_parameters``, ``inverter_parameters`` / ``temperature_model``
    mismatch), a ``ValidationError`` is raised immediately — saving the
    user from waiting for multi-year data fetches that would ultimately
    be wasted.

    Raises
    ------
    ValidationError
        If the configuration is invalid or pvlib cannot construct
        a valid ModelChain from the given parameters.
    """
    from app.core.exceptions import ValidationError as SolarValidationError
    import time

    start_time = time.perf_counter()
    try:
        engine_input = PVLibEngineInputSchema(
            location=request.location,
            pvsystem=request.pvsystem,
            modelchain_config=request.modelchain_config,
        )
        # Initialize the engine — this builds Location + PVSystem + ModelChain
        engine = PVLibEngine(engine_input)
        # Force a ModelChain build to validate all config combinations
        engine._build_modelchain()
        
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        alogger.info(
            "Fail-Fast: ModelChain dry-run passed in %.2f ms — config is valid",
            elapsed_ms
        )
    except SolarValidationError as exc:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        alogger.warning("Fail-Fast: Rejected in %.2f ms — %s", elapsed_ms, exc)
        raise  # Already our exception type
    except (ValueError, TypeError, KeyError) as exc:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        alogger.warning(
            "Fail-Fast: ModelChain configuration rejected in %.2f ms — %s",
            elapsed_ms, exc
        )
        raise SolarValidationError(
            f"PV system configuration error: {exc}. "
            f"Please verify module_parameters, inverter_parameters, "
            f"temperature_model_parameters, and modelchain_config compatibility."
        ) from exc
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        alogger.warning(
            "Fail-Fast: Unexpected error during config validation in %.2f ms — %s",
            elapsed_ms, exc
        )
        raise SolarValidationError(
            f"PV system configuration validation failed: {exc}"
        ) from exc


# ===========================================================================
# Weather source list
# ===========================================================================

_SUPPORTED_WEATHER_SOURCES = [
    "instesre_bird", "ineichen", "simplified_solis", "pvlib_bird",
    "pvgis_tmy", "pvgis_poa",
]


# ===========================================================================
# Request builders — map RunModelChainRequest → model-specific request
# ===========================================================================

def _build_clearsky_request(request: RunModelChainRequest):
    """Build the appropriate model-specific request from a RunModelChainRequest."""
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
    else:
        raise ValueError(
            f"Unsupported weather_source '{model}'. "
            f"Supported: {_SUPPORTED_WEATHER_SOURCES}"
        )


# ===========================================================================
# Model data generators (lazy imports to avoid circular deps)
# ===========================================================================

def _generate_clearsky_data(model_name: str, clearsky_request) -> pd.DataFrame:
    """Generate multi-year clearsky data for the given model."""
    from app.services.clearsky_service import (
        _generate_instesre_bird,
        _generate_ineichen,
        _generate_simplified_solis,
        _generate_pvlib_bird,
    )

    generators = {
        "instesre_bird": _generate_instesre_bird,
        "ineichen": _generate_ineichen,
        "simplified_solis": _generate_simplified_solis,
        "pvlib_bird": _generate_pvlib_bird,
    }
    gen_func = generators[model_name]
    return gen_func(clearsky_request)


def _generate_pvgis_poa_data(pvgis_request) -> pd.DataFrame:
    """Fetch multi-year PVGIS POA data."""
    from app.services.clearsky_service import _generate_pvgis_poa
    return _generate_pvgis_poa(pvgis_request)


# ===========================================================================
# PVLib Engine runner
# ===========================================================================

def _run_engine_simulation(
    request: RunModelChainRequest,
    weather_df: pd.DataFrame,
) -> dict[str, Any]:
    """Create PVLibEngine and run simulation on the given weather DataFrame."""
    try:
        engine_input = PVLibEngineInputSchema(
            location=request.location,
            pvsystem=request.pvsystem,
            modelchain_config=request.modelchain_config,
        )
        engine = PVLibEngine(engine_input)

        if not isinstance(weather_df.index, pd.DatetimeIndex):
            weather_df.index = pd.DatetimeIndex(weather_df.index)

        mc_result = engine.simulate(weather_df)
        return serialize_simulation_result(mc_result)
    except Exception as exc:
        raise SimulationError(
            f"PVLib ModelChain simulation failed: {exc}"
        ) from exc


# ===========================================================================
# ModelChain handlers by weather source type
# ===========================================================================

def _run_modelchain_clearsky(request: RunModelChainRequest) -> dict[str, Any]:
    """Run ModelChain with a clearsky model as weather source."""
    model_name = request.weather_source
    clearsky_request = _build_clearsky_request(request)
    multi_year_df = _generate_clearsky_data(model_name, clearsky_request)

    alogger.info(
        "Multi-year weather generated: %d rows, columns=%s",
        len(multi_year_df), list(multi_year_df.columns),
    )

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

        irradiance_results[strategy_name] = format_strategy_result(
            avg_df, strategy_name, value_columns,
        )

        alogger.info(
            "Running PVLibEngine.simulate() for strategy '%s' (%d weather rows)",
            strategy_name, len(avg_df),
        )

        weather_df = avg_df[value_columns].copy()
        simulation_results[strategy_name] = _run_engine_simulation(request, weather_df)
        alogger.info("PVLib simulation complete for strategy '%s'", strategy_name)

    return {
        "model": model_name,
        "simulation_type": "modelchain",
        "location": {
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "altitude": request.location.altitude,
        },
        "year_range": {
            "start_year": request.start_year,
            "end_year": request.end_year,
        },
        "multi_year_rows": len(multi_year_df),
        "irradiance_results": irradiance_results,
        "simulation_results": simulation_results,
    }


def _run_modelchain_pvgis_tmy(request: RunModelChainRequest) -> dict[str, Any]:
    """Run ModelChain with PVGIS TMY as weather source.

    TMY is already a representative year — no avg-year processing needed.
    """
    from app.schemas.pvgis_request_schemas import PVGISTMYRequestSchema
    from app.services.pvgis_service import get_tmy_data

    alogger.info(
        "Service: running ModelChain with PVGIS TMY for (%.4f, %.4f)",
        request.location.latitude, request.location.longitude,
    )

    pvgis_request = PVGISTMYRequestSchema(
        latitude=request.location.latitude,
        longitude=request.location.longitude,
        startyear=request.pvgis_startyear,
        endyear=request.pvgis_endyear,
        usehorizon=request.usehorizon,
    )

    df, metadata = get_tmy_data(pvgis_request, round_time=True)

    # Normalise TMY timestamps to reference year
    reference_year = request.reference_year
    new_index = df.index.map(
        lambda dt: dt.replace(year=reference_year)
        if not (dt.month == 2 and dt.day == 29)
        else dt.replace(year=reference_year, month=2, day=28)
    )
    df.index = pd.DatetimeIndex(new_index)

    value_cols = [c for c in DEFAULT_VALUE_COLS if c in df.columns]

    # Build irradiance summary
    irr_cols = [c for c in ["ghi", "dni", "dhi"] if c in df.columns]
    summary: dict[str, float] = {}
    for col in irr_cols:
        summary[f"annual_{col}_kwh_m2"] = round(float(df[col].sum() / 1000.0), 2)
        summary[f"peak_{col}_w_m2"] = round(float(df[col].max()), 2)

    hourly_df = df[value_cols].copy()
    hourly_df.index = hourly_df.index.strftime("%Y-%m-%dT%H:%M:%S")
    hourly_records = (
        hourly_df.reset_index()
        .rename(columns={"index": "datetime"})
        .to_dict(orient="records")
    )

    irradiance_results = {
        "tmy": {
            "strategy": "tmy",
            "summary": summary,
            "hourly": hourly_records,
        }
    }

    # Run PVLib simulation
    alogger.info("Running PVLibEngine.simulate() with PVGIS TMY weather (%d rows)", len(df))
    weather_df = df[value_cols].copy()
    sim_result = _run_engine_simulation(request, weather_df)
    simulation_results = {"tmy": sim_result}
    alogger.info("PVLib TMY simulation complete")

    return {
        "model": "pvgis_tmy",
        "simulation_type": "modelchain",
        "location": {
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "altitude": request.location.altitude,
        },
        "metadata": {
            "months_selected": metadata.get("months_selected", []),
        },
        "irradiance_results": irradiance_results,
        "simulation_results": simulation_results,
    }


def _run_modelchain_pvgis_poa(request: RunModelChainRequest) -> dict[str, Any]:
    """Run ModelChain with PVGIS hourly POA as weather source."""
    alogger.info(
        "Service: running ModelChain with PVGIS POA for (%.4f, %.4f) tilt=%.1f az=%.1f",
        request.location.latitude, request.location.longitude,
        request.pvgis_surface_tilt, request.pvgis_surface_azimuth,
    )

    pvgis_poa_request = _build_clearsky_request(request)
    multi_year_df = _generate_pvgis_poa_data(pvgis_poa_request)

    alogger.info(
        "PVGIS POA multi-year data: %d rows, columns=%s",
        len(multi_year_df), list(multi_year_df.columns),
    )

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

        irradiance_results[strategy_name] = format_strategy_result(
            avg_df, strategy_name, value_columns,
        )

        alogger.info(
            "Running PVLibEngine.simulate() with PVGIS POA for strategy '%s' (%d rows)",
            strategy_name, len(avg_df),
        )

        weather_df = avg_df[value_columns].copy()
        simulation_results[strategy_name] = _run_engine_simulation(request, weather_df)
        alogger.info("PVLib POA simulation complete for strategy '%s'", strategy_name)

    return {
        "model": "pvgis_poa",
        "simulation_type": "modelchain",
        "location": {
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "altitude": request.location.altitude,
        },
        "year_range": {
            "start_year": request.start_year,
            "end_year": request.end_year,
        },
        "multi_year_rows": len(multi_year_df),
        "irradiance_results": irradiance_results,
        "simulation_results": simulation_results,
    }


# ===========================================================================
# Public entry point
# ===========================================================================

def run_modelchain(request: RunModelChainRequest) -> dict[str, Any]:
    """Run a full PVLib ModelChain simulation.

    Dispatches to the appropriate handler based on ``request.weather_source``:
    - Clearsky models → multi-year generation → avg-year → simulate
    - PVGIS TMY → fetch TMY → simulate directly (already representative year)
    - PVGIS POA → multi-year POA → avg-year → simulate (auto-detects POA data)
    """
    source = request.weather_source
    alogger.info(
        "Service: running ModelChain simulation with weather_source='%s' for (%.4f, %.4f)",
        source, request.location.latitude, request.location.longitude,
    )

    # ── Fail-Fast: validate PV config BEFORE fetching weather data ──
    _validate_modelchain_config(request)

    if source in ("instesre_bird", "ineichen", "simplified_solis", "pvlib_bird"):
        return _run_modelchain_clearsky(request)
    elif source == "pvgis_tmy":
        return _run_modelchain_pvgis_tmy(request)
    elif source == "pvgis_poa":
        return _run_modelchain_pvgis_poa(request)
    else:
        raise ValueError(
            f"Unsupported weather_source '{source}'. "
            f"Supported: {_SUPPORTED_WEATHER_SOURCES}"
        )
