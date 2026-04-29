# ./backend/app/services/irradiance_generator_service.py
"""Raw irradiance data generation — no averaging strategies applied.

Returns the full hourly timeseries for the requested year range.
For PVGIS TMY, returns both a full dataset and a year-stripped simplified set.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import numpy as np
import pandas as pd

from app.core.logger import alogger
from app.schemas.irradiance_generator_schemas import GenerateIrradianceRequest, IrradianceModelEnum
from app.services.response_serializers import DEFAULT_VALUE_COLS, POA_VALUE_COLS


# ===========================================================================
# Internal helpers
# ===========================================================================

def _location_dict(req: GenerateIrradianceRequest) -> dict[str, Any]:
    return {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "elevation": req.elevation,
        "timezone": req.timezone,
    }


def _sanitize(df: pd.DataFrame) -> pd.DataFrame:
    """Replace NaN and ±inf with JSON-safe values (0 for irradiance, None for others)."""
    irr_cols = {"ghi", "dni", "dhi", "poa_global", "poa_direct", "poa_diffuse"}
    out = df.copy()
    for col in out.columns:
        if col in irr_cols:
            out[col] = out[col].replace([np.inf, -np.inf], 0.0).fillna(0.0).clip(lower=0.0)
        else:
            out[col] = out[col].replace([np.inf, -np.inf], np.nan)
            # Keep NaN as None (becomes null in JSON — valid for temp/wind missing data)
            out[col] = out[col].where(out[col].notna(), other=None)
    return out


def _df_to_records(df: pd.DataFrame, value_cols: list[str]) -> list[dict]:
    """Convert a DatetimeIndex DataFrame to a list of dicts with ISO datetime strings."""
    out = _sanitize(df[[c for c in value_cols if c in df.columns]])
    out.index = out.index.strftime("%Y-%m-%dT%H:%M:%S")
    return out.reset_index().rename(columns={"index": "datetime"}).to_dict(orient="records")


_IRR_PREFIXES = ("ghi", "dni", "dhi", "poa_global", "poa_direct", "poa_diffuse")


def _is_irradiance_col(col: str) -> bool:
    return col in _IRR_PREFIXES or col.startswith("poa_")


def _summary(df: pd.DataFrame, cols: list[str]) -> dict[str, float]:
    irr_cols = [c for c in cols if c in df.columns and _is_irradiance_col(c)]
    result: dict[str, float] = {}
    for col in irr_cols:
        series = df[col].replace([np.inf, -np.inf], np.nan).fillna(0.0).clip(lower=0.0)
        result[f"annual_{col}_kwh_m2"] = round(float(series.sum() / 1000.0), 2)
        result[f"peak_{col}_w_m2"] = round(float(series.max()), 2)
    return result


# ===========================================================================
# Per-model raw DataFrame generators
# ===========================================================================

def _raw_instesre_bird(req: GenerateIrradianceRequest) -> pd.DataFrame:
    from app.instesre_bird.bird_openmeteo import create_bird_df

    return create_bird_df(
        lat=req.latitude, lon=req.longitude, elevation=req.elevation,
        start_date=date(req.start_year, 1, 1),
        end_date=date(req.end_year, 12, 31),
        ozone=req.ozone, aod500=req.aod500, aod380=req.aod380,
        albedo=req.albedo, solar_constant=req.solar_constant,
        timezone=req.timezone, pvlib_format=True,
    )


def _raw_ineichen(req: GenerateIrradianceRequest) -> pd.DataFrame:
    from app.pvlib_tools.clearsky_openmeteo import create_ineichen_df

    return create_ineichen_df(
        lat=req.latitude, lon=req.longitude, elevation=req.elevation,
        start_date=date(req.start_year, 1, 1),
        end_date=date(req.end_year, 12, 31),
        timezone=req.timezone, pvlib_format=True,
    )


def _raw_simplified_solis(req: GenerateIrradianceRequest) -> pd.DataFrame:
    from app.pvlib_tools.clearsky_openmeteo import create_simplified_solis_df

    return create_simplified_solis_df(
        lat=req.latitude, lon=req.longitude, elevation=req.elevation,
        start_date=date(req.start_year, 1, 1),
        end_date=date(req.end_year, 12, 31),
        aod700=req.aod700, timezone=req.timezone, pvlib_format=True,
    )


def _raw_pvlib_bird(req: GenerateIrradianceRequest) -> pd.DataFrame:
    from app.pvlib_tools.clearsky_openmeteo import create_pvlib_bird_df

    return create_pvlib_bird_df(
        lat=req.latitude, lon=req.longitude, elevation=req.elevation,
        start_date=date(req.start_year, 1, 1),
        end_date=date(req.end_year, 12, 31),
        ozone=req.ozone, aod500=req.aod500, aod380=req.aod380,
        albedo=req.albedo, asymmetry=req.asymmetry,
        timezone=req.timezone, pvlib_format=True,
    )


def _raw_pvgis_poa(req: GenerateIrradianceRequest) -> pd.DataFrame:
    from app.schemas.pvgis_request_schemas import PVGISHourlyRequestSchema
    from app.services.pvgis_service import get_hourly_data

    pvgis_req = PVGISHourlyRequestSchema(
        latitude=req.latitude, longitude=req.longitude,
        start=req.start_year, end=req.end_year,
        surface_tilt=req.surface_tilt, surface_azimuth=req.surface_azimuth,
        usehorizon=req.usehorizon, raddatabase=req.raddatabase,
        components=True,
    )
    df, _ = get_hourly_data(pvgis_req, round_time=True)
    return df


# ===========================================================================
# TMY handler (returns two record sets)
# ===========================================================================

def _handle_tmy(req: GenerateIrradianceRequest) -> dict[str, Any]:
    from app.schemas.pvgis_request_schemas import PVGISTMYRequestSchema
    from app.services.pvgis_service import get_tmy_data

    alogger.info("IrradianceGen: PVGIS TMY for (%.4f, %.4f)", req.latitude, req.longitude)

    pvgis_req = PVGISTMYRequestSchema(
        latitude=req.latitude, longitude=req.longitude,
        startyear=req.pvgis_startyear, endyear=req.pvgis_endyear,
        usehorizon=req.usehorizon,
    )
    df, metadata = get_tmy_data(pvgis_req, round_time=True)

    value_cols = [c for c in DEFAULT_VALUE_COLS if c in df.columns]
    clean_df = _sanitize(df[value_cols])

    # Full records — keep original TMY timestamps
    full_df = clean_df.copy()
    full_df.index = full_df.index.strftime("%Y-%m-%dT%H:%M:%S")
    records_full = full_df.reset_index().rename(columns={"index": "datetime"}).to_dict(orient="records")

    # Simplified records — strip year, keep only day_of_year and hour
    simp_df = clean_df.copy()
    simp_df.insert(0, "day_of_year", simp_df.index.dayofyear.astype(int))
    simp_df.insert(1, "hour", simp_df.index.hour.astype(int))
    records_simplified = simp_df.reset_index(drop=True).to_dict(orient="records")

    summary = _summary(df, value_cols)

    return {
        "model": "pvgis_tmy",
        "is_tmy": True,
        "location": _location_dict(req),
        "total_rows": len(df),
        "columns": value_cols,
        "summary": summary,
        "records": records_full,
        "records_simplified": records_simplified,
        "metadata": {"months_selected": metadata.get("months_selected", [])},
    }


# ===========================================================================
# Public entry point
# ===========================================================================

_CLEARSKY_GENERATORS = {
    IrradianceModelEnum.INSTESRE_BIRD: _raw_instesre_bird,
    IrradianceModelEnum.INEICHEN: _raw_ineichen,
    IrradianceModelEnum.SIMPLIFIED_SOLIS: _raw_simplified_solis,
    IrradianceModelEnum.PVLIB_BIRD: _raw_pvlib_bird,
    IrradianceModelEnum.PVGIS_POA: _raw_pvgis_poa,
}


def generate_irradiance(req: GenerateIrradianceRequest) -> dict[str, Any]:
    """Generate raw hourly irradiance data for the requested model and period."""
    if req.model == IrradianceModelEnum.PVGIS_TMY:
        return _handle_tmy(req)

    alogger.info(
        "IrradianceGen: %s for (%.4f, %.4f) %d–%d",
        req.model, req.latitude, req.longitude, req.start_year, req.end_year,
    )

    generator = _CLEARSKY_GENERATORS[req.model]
    df = generator(req)

    is_poa = req.model == IrradianceModelEnum.PVGIS_POA
    value_cols = [c for c in (POA_VALUE_COLS if is_poa else DEFAULT_VALUE_COLS) if c in df.columns]
    records = _df_to_records(df, value_cols)

    return {
        "model": req.model,
        "is_tmy": False,
        "location": _location_dict(req),
        "year_range": {"start_year": req.start_year, "end_year": req.end_year},
        "total_rows": len(df),
        "columns": value_cols,
        "summary": _summary(df, value_cols),
        "records": records,
    }
