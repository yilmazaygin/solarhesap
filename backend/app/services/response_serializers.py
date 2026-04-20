# ./backend/app/services/response_serializers.py
"""Shared JSON response formatting utilities for solar simulation endpoints.

Extracted from ``clearsky_service.py`` to eliminate code duplication (DRY).
Every ``run_*`` and ``_run_modelchain_*`` function uses these helpers to
build consistent JSON-serialisable API responses.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.core.logger import alogger
from app.schemas.clearsky_api_schemas import resolve_strategies
from app.average_year.create_average_year import create_average_year
from app.services.super_avg_year import create_super_avg_year


# ===========================================================================
# Constants
# ===========================================================================

DEFAULT_VALUE_COLS = ["ghi", "dni", "dhi", "temp_air", "wind_speed"]
POA_VALUE_COLS = ["poa_global", "poa_direct", "poa_diffuse", "temp_air", "wind_speed"]


# ===========================================================================
# Average-year helpers
# ===========================================================================

def avg_year_for_strategy(
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


# ===========================================================================
# Result formatting
# ===========================================================================

def format_strategy_result(
    avg_df: pd.DataFrame,
    strategy_name: str,
    value_columns: list[str],
) -> dict[str, Any]:
    """Format a single avg-year result into a JSON-serialisable dict."""
    irr_cols = [
        c for c in ["ghi", "dni", "dhi", "poa_global", "poa_direct", "poa_diffuse"]
        if c in value_columns and c in avg_df.columns
    ]

    summary: dict[str, float] = {}
    for col in irr_cols:
        summary[f"annual_{col}_kwh_m2"] = round(float(avg_df[col].sum() / 1000.0), 2)
        summary[f"peak_{col}_w_m2"] = round(float(avg_df[col].max()), 2)

    out_cols = [c for c in value_columns if c in avg_df.columns]
    hourly_df = avg_df[out_cols].copy()
    hourly_df.index = hourly_df.index.strftime("%Y-%m-%dT%H:%M:%S")
    hourly_records = (
        hourly_df.reset_index()
        .rename(columns={"index": "datetime"})
        .to_dict(orient="records")
    )

    return {
        "strategy": strategy_name,
        "summary": summary,
        "hourly": hourly_records,
    }


def apply_strategies_and_format(
    model_name: str,
    request,
    multi_year_df: pd.DataFrame,
    value_columns: list[str] | None = None,
) -> dict[str, Any]:
    """Run avg-year strategies on multi-year data and format the full response.

    This is the main entry point used by individual model endpoint handlers
    (``run_instesre_bird``, ``run_ineichen``, etc.).
    """
    if value_columns is None:
        value_columns = DEFAULT_VALUE_COLS

    value_columns = [c for c in value_columns if c in multi_year_df.columns]
    strategies = resolve_strategies(request.avg_year_strategies)

    alogger.info(
        "Applying %d avg-year strategies to %s (%d multi-year rows)",
        len(strategies), model_name, len(multi_year_df),
    )

    results: dict[str, Any] = {}
    for strategy_name in strategies:
        avg_df = avg_year_for_strategy(
            multi_year_df, strategy_name, value_columns,
            request.reference_year, request.decay,
            request.lower_percentile, request.upper_percentile,
        )
        results[strategy_name] = format_strategy_result(
            avg_df, strategy_name, value_columns,
        )

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


def serialize_simulation_result(result) -> dict[str, Any]:
    """Serialise PVLibEngine ModelChainResult to a JSON-safe dict."""

    def _series_to_list(s):
        if s is None:
            return None
        if hasattr(s, "to_dict"):
            out = s.copy()
            if hasattr(out, "index"):
                out.index = out.index.astype(str)
            return out.to_dict()
        return s

    def _df_to_records(df):
        if df is None:
            return None
        if isinstance(df, pd.DataFrame):
            out = df.copy()
            out.index = out.index.astype(str)
            return (
                out.reset_index()
                .rename(columns={"index": "datetime"})
                .to_dict(orient="records")
            )
        return _series_to_list(df)

    ac_series = result.ac
    dc_data = result.dc

    summary: dict[str, float] = {}
    if ac_series is not None and not ac_series.empty:
        ac_clean = ac_series.fillna(0.0).replace([np.inf, -np.inf], 0.0)
        summary["annual_ac_kwh"] = round(float(ac_clean.sum() / 1000.0), 2)
        summary["peak_ac_w"] = round(float(ac_clean.max()), 2)

    if isinstance(dc_data, pd.DataFrame) and not dc_data.empty:
        if "p_mp" in dc_data.columns:
            dc_clean = dc_data["p_mp"].fillna(0.0).replace([np.inf, -np.inf], 0.0)
            summary["annual_dc_kwh"] = round(float(dc_clean.sum() / 1000.0), 2)
            summary["peak_dc_w"] = round(float(dc_clean.max()), 2)
    elif isinstance(dc_data, pd.Series) and not dc_data.empty:
        dc_clean = dc_data.fillna(0.0).replace([np.inf, -np.inf], 0.0)
        summary["annual_dc_kwh"] = round(float(dc_clean.sum() / 1000.0), 2)
        summary["peak_dc_w"] = round(float(dc_clean.max()), 2)

    return {
        "summary": summary,
        "ac": _series_to_list(ac_series),
        "dc": _df_to_records(dc_data),
        "total_irrad": (
            _df_to_records(result.total_irrad)
            if isinstance(result.total_irrad, (pd.DataFrame, pd.Series))
            else result.total_irrad
        ),
    }
