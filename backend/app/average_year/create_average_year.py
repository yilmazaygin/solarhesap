# ./backend/app/average_year/create_average_year.py
"""Average-year construction from multi-year hourly irradiance data.

Given a DataFrame of hourly data spanning multiple years (e.g. 20 years of
clear-sky model output), this module compresses it into a single
representative "average year" of 365 days × 24 hours = 8760 rows.

Four averaging strategies are available, each producing a different
trade-off between stability and responsiveness to recent climate trends.

Leap-day handling
-----------------
February 29 data is merged into February 28 before averaging.  This is
standard practice in TMY (Typical Meteorological Year) generation and
ensures a consistent 365-day output regardless of how many leap years
are present in the input data.

References
----------
- Wilcox, S. & Marion, W. (2008). "Users Manual for TMY3 Data Sets".
  Technical Report NREL/TP-581-43156.
- ISO 15927-4:2005 — Meteorological data for assessing energy
  performance of buildings.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from enum import Enum

from app.core.logger import alogger


# ===========================================================================
# Strategy identifiers
# ===========================================================================

class AverageYearStrategy(str, Enum):
    """Available averaging strategies."""

    SIMPLE_MEAN = "simple_mean"
    TRIMMED_MEAN = "trimmed_mean"
    EXPONENTIAL_WEIGHTED = "exponential_weighted"
    COMBINED = "combined"


# ===========================================================================
# Leap-day handling
# ===========================================================================

def _merge_leap_day(df: pd.DataFrame) -> pd.DataFrame:
    """Redirect February 29 rows to February 28.

    Creates canonical ``(month, day)`` columns where all Feb-29 entries
    are reassigned to Feb-28.  This means Feb-28 will have up to 2×
    as many observations in leap years, which is correct for averaging.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain a ``datetime`` column (or DatetimeIndex).

    Returns
    -------
    pd.DataFrame
        Copy of *df* with additional columns ``_month``, ``_day``, ``_hour``,
        ``_year`` used for grouping.
    """
    out = df.copy()

    if "datetime" in out.columns:
        dt = pd.to_datetime(out["datetime"])
    elif isinstance(out.index, pd.DatetimeIndex):
        dt = out.index.to_series()
    else:
        raise ValueError(
            "DataFrame must have a 'datetime' column or a DatetimeIndex."
        )

    out["_year"] = dt.dt.year
    out["_month"] = dt.dt.month
    out["_day"] = dt.dt.day
    out["_hour"] = dt.dt.hour

    # Merge Feb 29 → Feb 28
    leap_mask = (out["_month"] == 2) & (out["_day"] == 29)
    n_leap = leap_mask.sum()
    if n_leap > 0:
        alogger.info("Merging %d Feb-29 rows into Feb-28", n_leap)
        out.loc[leap_mask, "_day"] = 28

    return out


def _build_reference_year(reference_year: int = 2023) -> pd.DatetimeIndex:
    """Build a 365-day hourly DatetimeIndex for a non-leap reference year."""
    start = pd.Timestamp(f"{reference_year}-01-01 00:00:00")
    end = pd.Timestamp(f"{reference_year}-12-31 23:00:00")
    return pd.date_range(start, end, freq="h")


# ===========================================================================
# Strategy implementations
# ===========================================================================

def _strategy_simple_mean(
    df: pd.DataFrame,
    value_cols: list[str],
) -> pd.DataFrame:
    """Arithmetic mean across all years for each (month, day, hour).

    The simplest strategy.  Every year contributes equally.  Sensitive to
    extreme values in any single year.

    Best for: Quick estimates, stable climate regions.
    """
    alogger.info("Applying strategy: simple_mean over %d value columns", len(value_cols))

    grouped = df.groupby(["_month", "_day", "_hour"])[value_cols].mean()
    return grouped.reset_index()


def _strategy_trimmed_mean(
    df: pd.DataFrame,
    value_cols: list[str],
    lower_percentile: float = 10.0,
    upper_percentile: float = 90.0,
) -> pd.DataFrame:
    """Trimmed (winsorised) mean — outlier years are excluded.

    For each (month, day, hour) group, values below the *lower_percentile*
    and above the *upper_percentile* are discarded before averaging.  This
    removes anomalous years (e.g. volcanic eruptions, unusual weather).

    The trimming is applied **per column independently**, so a year that is
    an outlier for GHI won't affect DNI trimming.

    Best for: Robust long-term estimates, noisy datasets.

    Parameters
    ----------
    lower_percentile : float
        Lower percentile threshold (default 10).
    upper_percentile : float
        Upper percentile threshold (default 90).
    """
    alogger.info(
        "Applying strategy: trimmed_mean (%.0f–%.0f percentile) over %d columns",
        lower_percentile, upper_percentile, len(value_cols),
    )

    def _trim_and_mean(group):
        result = {}
        for col in value_cols:
            vals = group[col].dropna()
            if len(vals) <= 2:
                # Too few values to trim — use plain mean
                result[col] = vals.mean()
            else:
                lo = np.percentile(vals, lower_percentile)
                hi = np.percentile(vals, upper_percentile)
                trimmed = vals[(vals >= lo) & (vals <= hi)]
                result[col] = trimmed.mean() if len(trimmed) > 0 else vals.mean()
        return pd.Series(result)

    grouped = df.groupby(["_month", "_day", "_hour"]).apply(_trim_and_mean)
    return grouped.reset_index()


def _strategy_exponential_weighted(
    df: pd.DataFrame,
    value_cols: list[str],
    decay: float = 0.90,
) -> pd.DataFrame:
    """Exponentially weighted mean — recent years count more.

    Each year receives weight ``decay^(max_year - year)``:
    - Most recent year: weight = 1.0
    - 1 year ago: weight = *decay*
    - 2 years ago: weight = *decay*²
    - etc.

    With the default *decay=0.90*, the most recent 7 years account for
    ~52 % of the total weight.  With *decay=0.85*, the most recent 5 years
    account for ~56 %.

    Best for: Locations with changing climate, new construction sites.

    Parameters
    ----------
    decay : float
        Decay factor per year (default 0.90).  Lower = more emphasis on
        recent data.  Valid range: (0, 1).
    """
    alogger.info(
        "Applying strategy: exponential_weighted (decay=%.2f) over %d columns",
        decay, len(value_cols),
    )

    max_year = df["_year"].max()
    df = df.copy()
    df["_weight"] = decay ** (max_year - df["_year"])

    def _weighted_mean(group):
        weights = group["_weight"].values
        w_sum = weights.sum()
        if w_sum == 0:
            return pd.Series({col: np.nan for col in value_cols})
        result = {}
        for col in value_cols:
            vals = group[col].values
            mask = ~np.isnan(vals)
            if mask.any():
                result[col] = np.average(vals[mask], weights=weights[mask])
            else:
                result[col] = np.nan
        return pd.Series(result)

    grouped = df.groupby(["_month", "_day", "_hour"]).apply(_weighted_mean)
    return grouped.reset_index()


def _strategy_combined(
    df: pd.DataFrame,
    value_cols: list[str],
    decay: float = 0.90,
    lower_percentile: float = 10.0,
    upper_percentile: float = 90.0,
) -> pd.DataFrame:
    """Combined strategy: trim outliers, then apply exponential weighting.

    First removes values outside the [lower, upper] percentile range,
    then applies exponential weighting to the remaining observations.
    This is the most robust strategy — it ignores anomalous years while
    still prioritising recent data.

    Best for: Production-grade energy yield estimates.

    Parameters
    ----------
    decay : float
        Exponential decay factor (default 0.90).
    lower_percentile : float
        Lower trim threshold (default 10).
    upper_percentile : float
        Upper trim threshold (default 90).
    """
    alogger.info(
        "Applying strategy: combined (trim %.0f–%.0f, decay=%.2f) over %d columns",
        lower_percentile, upper_percentile, decay, len(value_cols),
    )

    max_year = df["_year"].max()
    df = df.copy()
    df["_weight"] = decay ** (max_year - df["_year"])

    def _trim_and_weighted_mean(group):
        weights = group["_weight"].values
        result = {}
        for col in value_cols:
            vals = group[col].values
            mask = ~np.isnan(vals)
            if mask.sum() <= 2:
                # Too few to trim
                if mask.any():
                    result[col] = np.average(vals[mask], weights=weights[mask])
                else:
                    result[col] = np.nan
                continue

            lo = np.percentile(vals[mask], lower_percentile)
            hi = np.percentile(vals[mask], upper_percentile)
            trim_mask = mask & (vals >= lo) & (vals <= hi)

            if trim_mask.any():
                result[col] = np.average(vals[trim_mask], weights=weights[trim_mask])
            elif mask.any():
                # All values trimmed — fall back to weighted mean
                result[col] = np.average(vals[mask], weights=weights[mask])
            else:
                result[col] = np.nan
        return pd.Series(result)

    grouped = df.groupby(["_month", "_day", "_hour"]).apply(_trim_and_weighted_mean)
    return grouped.reset_index()


# ===========================================================================
# Main entry point
# ===========================================================================

def create_average_year(
    df: pd.DataFrame,
    value_columns: list[str] | None = None,
    strategy: AverageYearStrategy | str = AverageYearStrategy.COMBINED,
    reference_year: int = 2023,
    decay: float = 0.90,
    lower_percentile: float = 10.0,
    upper_percentile: float = 90.0,
) -> pd.DataFrame:
    """Create a single average year from multi-year hourly data.

    Takes a DataFrame spanning multiple calendar years and produces a
    365-day × 24-hour representative year using the chosen averaging strategy.

    Parameters
    ----------
    df : pd.DataFrame
        Multi-year hourly data.  Must contain either a ``datetime`` column
        or have a DatetimeIndex.
    value_columns : list[str], optional
        Which columns to average.  If ``None``, defaults to
        ``['ghi', 'dni', 'dhi', 'temp_air', 'wind_speed']`` (pvlib format).
        Only existing columns from this list are used.
    strategy : AverageYearStrategy or str
        Averaging strategy (default ``'combined'``).

        - ``'simple_mean'``: Equal-weight arithmetic mean.
        - ``'trimmed_mean'``: Remove outlier years, then mean.
        - ``'exponential_weighted'``: Recent years weighted more (decay).
        - ``'combined'``: Trim outliers + exponential weighting (recommended).

    reference_year : int
        Non-leap year to use for output timestamps (default 2023).
    decay : float
        Exponential decay factor for weighted strategies (default 0.90).
    lower_percentile : float
        Lower trim threshold in percent (default 10).
    upper_percentile : float
        Upper trim threshold in percent (default 90).

    Returns
    -------
    pd.DataFrame
        DataFrame with 8760 rows (365 × 24), DatetimeIndex set to
        *reference_year*, and the averaged value columns.
        Column ``strategy`` records which strategy was used.

    Notes
    -----
    - February 29 data is merged into February 28 before averaging.
    - If the input has < 3 years of data, ``trimmed_mean`` and ``combined``
      fall back to simple averaging for groups with too few observations.
    """
    strategy = AverageYearStrategy(strategy)

    if value_columns is None:
        value_columns = ["ghi", "dni", "dhi", "temp_air", "wind_speed"]

    # Only use columns that exist in the input
    available_cols = [c for c in value_columns if c in df.columns]
    if not available_cols:
        raise ValueError(
            f"None of the requested value_columns {value_columns} "
            f"exist in the input DataFrame (columns: {list(df.columns)})"
        )

    alogger.info(
        "Creating average year: strategy=%s, %d value columns, reference_year=%d",
        strategy.value, len(available_cols), reference_year,
    )

    # --- Determine year range from input data ---------------------------------
    if "datetime" in df.columns:
        years = pd.to_datetime(df["datetime"]).dt.year.unique()
    elif isinstance(df.index, pd.DatetimeIndex):
        years = df.index.year.unique()
    else:
        raise ValueError("Cannot determine years from input data.")

    alogger.info(
        "Input spans %d years: %d → %d (%d total rows)",
        len(years), years.min(), years.max(), len(df),
    )

    # --- Merge leap days and add grouping columns -----------------------------
    prepared = _merge_leap_day(df)

    # --- Apply strategy -------------------------------------------------------
    if strategy == AverageYearStrategy.SIMPLE_MEAN:
        averaged = _strategy_simple_mean(prepared, available_cols)

    elif strategy == AverageYearStrategy.TRIMMED_MEAN:
        averaged = _strategy_trimmed_mean(
            prepared, available_cols, lower_percentile, upper_percentile,
        )

    elif strategy == AverageYearStrategy.EXPONENTIAL_WEIGHTED:
        averaged = _strategy_exponential_weighted(
            prepared, available_cols, decay,
        )

    elif strategy == AverageYearStrategy.COMBINED:
        averaged = _strategy_combined(
            prepared, available_cols, decay, lower_percentile, upper_percentile,
        )

    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    # --- Map to reference year timestamps -------------------------------------
    ref_index = _build_reference_year(reference_year)

    # Build a lookup from (month, day, hour) → row
    averaged["_ref_dt"] = averaged.apply(
        lambda r: pd.Timestamp(
            year=reference_year,
            month=int(r["_month"]),
            day=int(r["_day"]),
            hour=int(r["_hour"]),
        ),
        axis=1,
    )
    averaged = averaged.set_index("_ref_dt").reindex(ref_index)

    # Some (month, day, hour) slots might be missing (shouldn't happen with
    # 20 years of data, but handle gracefully)
    if averaged[available_cols].isna().any().any():
        n_missing = averaged[available_cols].isna().sum().sum()
        alogger.warning("Filling %d NaN slots via interpolation", n_missing)
        averaged[available_cols] = (
            averaged[available_cols].interpolate(method="time").ffill().bfill()
        )

    # --- Build final output ---------------------------------------------------
    result = averaged[available_cols].copy()
    result.index.name = None
    result["strategy"] = strategy.value

    alogger.info(
        "Average year created: %d rows, strategy=%s, reference_year=%d",
        len(result), strategy.value, reference_year,
    )

    return result
