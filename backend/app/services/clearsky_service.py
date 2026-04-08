# ./backend/app/services/clearsky_service.py
"""Business logic for clearsky API endpoints.

Each ``run_*`` function:
1. Generates multi-year clearsky data using the appropriate model.
2. Applies the requested average-year strategy(ies).
3. Returns a JSON-serialisable dict ready for the API response.

Routes should only call functions from this module — no model logic lives
in the route layer.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import numpy as np
import pandas as pd

from app.core.logger import alogger
from app.schemas.clearsky_api_schemas import (
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisTmyRequest,
    PvgisPOARequest,
    resolve_strategies,
)
from app.average_year.create_average_year import create_average_year
from app.services.super_avg_year import create_super_avg_year


# ===========================================================================
# Shared helpers
# ===========================================================================

_DEFAULT_VALUE_COLS = ["ghi", "dni", "dhi", "temp_air", "wind_speed"]
_POA_VALUE_COLS = ["poa_global", "poa_direct", "poa_diffuse", "temp_air", "wind_speed"]


def _avg_year_for_strategy(
    df: pd.DataFrame,
    strategy_name: str,
    value_columns: list[str],
    reference_year: int,
    decay: float,
    lower_percentile: float,
    upper_percentile: float,
) -> pd.DataFrame:
    """Run a single avg-year strategy or super_avg_year."""
    if strategy_name == "super_avg_year":
        return create_super_avg_year(
            df, value_columns=value_columns, reference_year=reference_year,
            decay=decay, lower_percentile=lower_percentile,
            upper_percentile=upper_percentile,
        )
    return create_average_year(
        df, value_columns=value_columns, strategy=strategy_name,
        reference_year=reference_year, decay=decay,
        lower_percentile=lower_percentile, upper_percentile=upper_percentile,
    )


def _format_strategy_result(
    avg_df: pd.DataFrame,
    strategy_name: str,
    value_columns: list[str],
) -> dict[str, Any]:
    """Format a single avg-year result into a JSON-serialisable dict."""
    # Identify irradiance columns for summary stats
    irr_cols = [c for c in ["ghi", "dni", "dhi", "poa_global", "poa_direct", "poa_diffuse"]
                if c in value_columns and c in avg_df.columns]

    summary: dict[str, float] = {}
    for col in irr_cols:
        summary[f"annual_{col}_kwh_m2"] = round(float(avg_df[col].sum() / 1000.0), 2)
        summary[f"peak_{col}_w_m2"] = round(float(avg_df[col].max()), 2)

    # Build hourly records
    out_cols = [c for c in value_columns if c in avg_df.columns]
    hourly_df = avg_df[out_cols].copy()
    hourly_df.index = hourly_df.index.strftime("%Y-%m-%dT%H:%M:%S")
    hourly_records = hourly_df.reset_index().rename(columns={"index": "datetime"}).to_dict(orient="records")

    return {
        "strategy": strategy_name,
        "summary": summary,
        "hourly": hourly_records,
    }


def _apply_and_format(
    model_name: str,
    request,
    multi_year_df: pd.DataFrame,
    value_columns: list[str] | None = None,
) -> dict[str, Any]:
    """Run avg-year strategies on multi-year data and format the full response."""
    if value_columns is None:
        value_columns = _DEFAULT_VALUE_COLS

    # Only average columns that actually exist
    value_columns = [c for c in value_columns if c in multi_year_df.columns]

    strategies = resolve_strategies(request.avg_year_strategies)

    alogger.info(
        "Applying %d avg-year strategies to %s (%d multi-year rows)",
        len(strategies), model_name, len(multi_year_df),
    )

    results: dict[str, Any] = {}
    for strategy_name in strategies:
        avg_df = _avg_year_for_strategy(
            multi_year_df, strategy_name, value_columns,
            request.reference_year, request.decay,
            request.lower_percentile, request.upper_percentile,
        )
        results[strategy_name] = _format_strategy_result(avg_df, strategy_name, value_columns)

    return {
        "model": model_name,
        "location": {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "elevation": request.elevation,
        },
        "year_range": {
            "start_year": request.start_year,
            "end_year": request.end_year,
        },
        "multi_year_rows": len(multi_year_df),
        "results": results,
    }


# ===========================================================================
# Model generators — each returns a pvlib-format DataFrame
# ===========================================================================

def _generate_instesre_bird(request: InstestreBirdRequest) -> pd.DataFrame:
    from app.instesre_bird.bird_openmeteo import create_bird_df

    return create_bird_df(
        lat=request.latitude, lon=request.longitude, elevation=request.elevation,
        start_date=date(request.start_year, 1, 1),
        end_date=date(request.end_year, 12, 31),
        ozone=request.ozone, aod500=request.aod500, aod380=request.aod380,
        albedo=request.albedo, solar_constant=request.solar_constant,
        timezone=request.timezone,
        pvlib_format=True,
    )


def _generate_ineichen(request: PvlibIneichenRequest) -> pd.DataFrame:
    from app.pvlib_tools.clearsky_openmeteo import create_ineichen_df

    return create_ineichen_df(
        lat=request.latitude, lon=request.longitude, elevation=request.elevation,
        start_date=date(request.start_year, 1, 1),
        end_date=date(request.end_year, 12, 31),
        timezone=request.timezone,
        pvlib_format=True,
    )


def _generate_simplified_solis(request: SimplifiedSolisRequest) -> pd.DataFrame:
    from app.pvlib_tools.clearsky_openmeteo import create_simplified_solis_df

    return create_simplified_solis_df(
        lat=request.latitude, lon=request.longitude, elevation=request.elevation,
        start_date=date(request.start_year, 1, 1),
        end_date=date(request.end_year, 12, 31),
        aod700=request.aod700,
        timezone=request.timezone,
        pvlib_format=True,
    )


def _generate_pvlib_bird(request: PvlibBirdRequest) -> pd.DataFrame:
    from app.pvlib_tools.clearsky_openmeteo import create_pvlib_bird_df

    return create_pvlib_bird_df(
        lat=request.latitude, lon=request.longitude, elevation=request.elevation,
        start_date=date(request.start_year, 1, 1),
        end_date=date(request.end_year, 12, 31),
        ozone=request.ozone, aod500=request.aod500, aod380=request.aod380,
        albedo=request.albedo, asymmetry=request.asymmetry,
        timezone=request.timezone,
        pvlib_format=True,
    )


def _generate_pvgis_poa(request: PvgisPOARequest) -> pd.DataFrame:
    from app.schemas.pvgis_request_schemas import PVGISHourlyRequestSchema
    from app.services.pvgis_service import get_hourly_data

    pvgis_request = PVGISHourlyRequestSchema(
        latitude=request.latitude,
        longitude=request.longitude,
        start=request.start_year,
        end=request.end_year,
        surface_tilt=request.surface_tilt,
        surface_azimuth=request.surface_azimuth,
        usehorizon=request.usehorizon,
        raddatabase=request.raddatabase,
        components=True,
    )

    df, _metadata = get_hourly_data(pvgis_request, round_time=True)
    return df


# ===========================================================================
# Public endpoint handlers
# ===========================================================================

def run_instesre_bird(request: InstestreBirdRequest) -> dict[str, Any]:
    """Run INSTESRE Bird clearsky model and return avg-year results."""
    alogger.info("Service: running INSTESRE Bird for (%.4f, %.4f)", request.latitude, request.longitude)
    df = _generate_instesre_bird(request)
    return _apply_and_format("instesre_bird", request, df)


def run_ineichen(request: PvlibIneichenRequest) -> dict[str, Any]:
    """Run pvlib Ineichen/Perez clearsky model and return avg-year results."""
    alogger.info("Service: running Ineichen for (%.4f, %.4f)", request.latitude, request.longitude)
    df = _generate_ineichen(request)
    return _apply_and_format("ineichen", request, df)


def run_simplified_solis(request: SimplifiedSolisRequest) -> dict[str, Any]:
    """Run pvlib Simplified Solis clearsky model and return avg-year results."""
    alogger.info("Service: running Simplified Solis for (%.4f, %.4f)", request.latitude, request.longitude)
    df = _generate_simplified_solis(request)
    return _apply_and_format("simplified_solis", request, df)


def run_pvlib_bird(request: PvlibBirdRequest) -> dict[str, Any]:
    """Run pvlib Bird clearsky model and return avg-year results."""
    alogger.info("Service: running pvlib Bird for (%.4f, %.4f)", request.latitude, request.longitude)
    df = _generate_pvlib_bird(request)
    return _apply_and_format("pvlib_bird", request, df)


def run_pvgis_tmy(request: PvgisTmyRequest) -> dict[str, Any]:
    """Fetch PVGIS TMY and return formatted result (no avg-year needed)."""
    from app.schemas.pvgis_request_schemas import PVGISTMYRequestSchema
    from app.services.pvgis_service import get_tmy_data

    alogger.info("Service: fetching PVGIS TMY for (%.4f, %.4f)", request.latitude, request.longitude)

    pvgis_request = PVGISTMYRequestSchema(
        latitude=request.latitude,
        longitude=request.longitude,
        startyear=request.startyear,
        endyear=request.endyear,
        usehorizon=request.usehorizon,
    )

    df, metadata = get_tmy_data(pvgis_request, round_time=True)

    # Normalise TMY timestamps to a reference year for consistency
    reference_year = 2023
    new_index = df.index.map(
        lambda dt: dt.replace(year=reference_year)
        if not (dt.month == 2 and dt.day == 29)
        else dt.replace(year=reference_year, month=2, day=28)
    )
    df.index = pd.DatetimeIndex(new_index)

    # Identify available value columns
    value_cols = [c for c in _DEFAULT_VALUE_COLS if c in df.columns]

    # Summary
    irr_cols = [c for c in ["ghi", "dni", "dhi"] if c in df.columns]
    summary: dict[str, float] = {}
    for col in irr_cols:
        summary[f"annual_{col}_kwh_m2"] = round(float(df[col].sum() / 1000.0), 2)
        summary[f"peak_{col}_w_m2"] = round(float(df[col].max()), 2)

    # Hourly records
    hourly_df = df[value_cols].copy()
    hourly_df.index = hourly_df.index.strftime("%Y-%m-%dT%H:%M:%S")
    hourly_records = hourly_df.reset_index().rename(columns={"index": "datetime"}).to_dict(orient="records")

    return {
        "model": "pvgis_tmy",
        "location": {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "elevation": request.elevation,
        },
        "metadata": {
            "months_selected": metadata.get("months_selected", []),
        },
        "results": {
            "tmy": {
                "strategy": "tmy",
                "summary": summary,
                "hourly": hourly_records,
            }
        },
    }


def run_pvgis_poa(request: PvgisPOARequest) -> dict[str, Any]:
    """Fetch PVGIS hourly POA data and return avg-year results."""
    alogger.info(
        "Service: running PVGIS POA for (%.4f, %.4f) tilt=%.1f az=%.1f",
        request.latitude, request.longitude, request.surface_tilt, request.surface_azimuth,
    )
    df = _generate_pvgis_poa(request)

    # Use POA columns
    return _apply_and_format("pvgis_poa", request, df, value_columns=_POA_VALUE_COLS)
