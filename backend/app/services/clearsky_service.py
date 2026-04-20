# ./backend/app/services/clearsky_service.py
"""Business logic for individual solar simulation model endpoints.

Each ``run_*`` function:
1. Generates multi-year clearsky data using the appropriate model.
2. Applies the requested average-year strategy(ies) via shared helpers.
3. Returns a JSON-serialisable dict ready for the API response.

ModelChain simulation logic has been moved to ``modelchain_service.py``.
Response formatting helpers live in ``response_serializers.py``.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd

from app.core.logger import alogger
from app.schemas.clearsky_api_schemas import (
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisTmyRequest,
    PvgisPOARequest,
)
from app.services.response_serializers import (
    DEFAULT_VALUE_COLS,
    POA_VALUE_COLS,
    apply_strategies_and_format,
)


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
    return apply_strategies_and_format("instesre_bird", request, df)


def run_ineichen(request: PvlibIneichenRequest) -> dict[str, Any]:
    """Run pvlib Ineichen/Perez clearsky model and return avg-year results."""
    alogger.info("Service: running Ineichen for (%.4f, %.4f)", request.latitude, request.longitude)
    df = _generate_ineichen(request)
    return apply_strategies_and_format("ineichen", request, df)


def run_simplified_solis(request: SimplifiedSolisRequest) -> dict[str, Any]:
    """Run pvlib Simplified Solis clearsky model and return avg-year results."""
    alogger.info("Service: running Simplified Solis for (%.4f, %.4f)", request.latitude, request.longitude)
    df = _generate_simplified_solis(request)
    return apply_strategies_and_format("simplified_solis", request, df)


def run_pvlib_bird(request: PvlibBirdRequest) -> dict[str, Any]:
    """Run pvlib Bird clearsky model and return avg-year results."""
    alogger.info("Service: running pvlib Bird for (%.4f, %.4f)", request.latitude, request.longitude)
    df = _generate_pvlib_bird(request)
    return apply_strategies_and_format("pvlib_bird", request, df)


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
    value_cols = [c for c in DEFAULT_VALUE_COLS if c in df.columns]

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
    return apply_strategies_and_format("pvgis_poa", request, df, value_columns=POA_VALUE_COLS)
