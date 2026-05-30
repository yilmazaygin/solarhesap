# ./backend/app/services/openmeteo_service.py
"""Service layer for orchestrating Open-Meteo historical weather data fetching."""

from typing import Dict, Any, Union
import pandas as pd
from app.core.logger import alogger
from app.schemas.openmeteo_schemas import OpenMeteoRequestSchema, OpenMeteoResponseSchema
from app.outer_apis.openmeteo.fetch_openmeteo import fetch_open_meteo


def get_openmeteo_data(request: OpenMeteoRequestSchema) -> Dict[str, Union[OpenMeteoResponseSchema, pd.DataFrame, None]]:
    """Fetches historical weather data from Open-Meteo and returns the full result.

    Returns a dict with:
        - 'response': Validated OpenMeteoResponseSchema
        - 'hourly_dataframe': pd.DataFrame | None (hourly time-series)
        - 'daily_dataframe': pd.DataFrame | None (daily time-series)

    Args:
        request: Validated Open-Meteo request schema.

    Returns:
        Dict containing the validated response and optional DataFrames.
    """
    alogger.info(
        "OpenMeteo service: fetching data for (%.4f, %.4f) from %s to %s",
        request.latitude, request.longitude, request.start_date, request.end_date,
    )

    result = fetch_open_meteo(request)

    alogger.info(
        "OpenMeteo service: data received — hourly=%s, daily=%s",
        result["hourly_dataframe"].shape if result["hourly_dataframe"] is not None else None,
        result["daily_dataframe"].shape if result["daily_dataframe"] is not None else None,
    )

    return result


def get_hourly_weather(request: OpenMeteoRequestSchema) -> pd.DataFrame:
    """Fetches Open-Meteo data and returns only the hourly DataFrame.

    Args:
        request: Validated Open-Meteo request schema. Must include hourly variables.

    Returns:
        pd.DataFrame with hourly weather data indexed by datetime.

    Raises:
        ValueError: If the response contains no hourly data.
    """
    alogger.info(
        "OpenMeteo service: fetching hourly weather for (%.4f, %.4f) from %s to %s",
        request.latitude, request.longitude, request.start_date, request.end_date,
    )

    result = fetch_open_meteo(request)
    hourly_df = result["hourly_dataframe"]

    if hourly_df is None or hourly_df.empty:
        alogger.error("OpenMeteo service: no hourly data returned")
        raise ValueError("No hourly data returned from Open-Meteo.")

    alogger.info("OpenMeteo service: hourly weather ready — shape=%s", hourly_df.shape)
    return hourly_df


def get_daily_weather(request: OpenMeteoRequestSchema) -> pd.DataFrame:
    """Fetches Open-Meteo data and returns only the daily DataFrame.

    Args:
        request: Validated Open-Meteo request schema. Must include daily variables.

    Returns:
        pd.DataFrame with daily weather data indexed by datetime.

    Raises:
        ValueError: If the response contains no daily data.
    """
    alogger.info(
        "OpenMeteo service: fetching daily weather for (%.4f, %.4f) from %s to %s",
        request.latitude, request.longitude, request.start_date, request.end_date,
    )

    result = fetch_open_meteo(request)
    daily_df = result["daily_dataframe"]

    if daily_df is None or daily_df.empty:
        alogger.error("OpenMeteo service: no daily data returned")
        raise ValueError("No daily data returned from Open-Meteo.")

    alogger.info("OpenMeteo service: daily weather ready — shape=%s", daily_df.shape)
    return daily_df