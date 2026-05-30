# ./backend/app/services/super_avg_year.py
"""Super Average Year: combines all four averaging strategies.

Runs ``simple_mean``, ``trimmed_mean``, ``exponential_weighted`` and
``combined`` strategies, then takes the element-wise arithmetic mean of
their results.  This smooths out strategy-specific biases and produces
a consensus estimate.
"""

from __future__ import annotations

import pandas as pd

from app.average_year.create_average_year import create_average_year
from app.core.logger import alogger


_BASE_STRATEGIES = ["simple_mean", "trimmed_mean", "exponential_weighted", "combined"]


def create_super_avg_year(
    df: pd.DataFrame,
    value_columns: list[str] | None = None,
    reference_year: int = 2023,
    decay: float = 0.90,
    lower_percentile: float = 10.0,
    upper_percentile: float = 90.0,
) -> pd.DataFrame:
    """Create a consensus average year from all four base strategies.

    Parameters
    ----------
    df : pd.DataFrame
        Multi-year hourly data (same input as ``create_average_year``).
    value_columns : list[str], optional
        Columns to average (default: ghi, dni, dhi, temp_air, wind_speed).
    reference_year : int
        Non-leap year for output timestamps.
    decay : float
        Exponential decay factor.
    lower_percentile, upper_percentile : float
        Trimming thresholds for the trimmed/combined strategies.

    Returns
    -------
    pd.DataFrame
        8760-row DataFrame (same format as ``create_average_year``),
        with ``strategy`` column set to ``'super_avg_year'``.
    """
    alogger.info("Creating super_avg_year from %d base strategies", len(_BASE_STRATEGIES))

    avg_dfs: list[pd.DataFrame] = []

    for strategy_name in _BASE_STRATEGIES:
        avg_df = create_average_year(
            df,
            value_columns=value_columns,
            strategy=strategy_name,
            reference_year=reference_year,
            decay=decay,
            lower_percentile=lower_percentile,
            upper_percentile=upper_percentile,
        )
        avg_dfs.append(avg_df)

    # Determine numeric columns (everything except 'strategy')
    numeric_cols = [c for c in avg_dfs[0].columns if c != "strategy"]

    # Element-wise arithmetic mean across all strategies
    super_df = avg_dfs[0][numeric_cols].copy()
    for other_df in avg_dfs[1:]:
        super_df[numeric_cols] += other_df[numeric_cols]
    super_df[numeric_cols] /= len(avg_dfs)

    super_df["strategy"] = "super_avg_year"

    alogger.info(
        "super_avg_year created: %d rows, strategy consensus from %s",
        len(super_df), _BASE_STRATEGIES,
    )

    return super_df
