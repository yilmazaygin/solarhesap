# ./backend/app/outer_apis/openmeteo/openmeteo_helpers.py
"""Helper functions for Open-Meteo Historical Weather API integration."""

from datetime import date, datetime

import pandas as pd

from app.core.logger import alogger
from app.core.settings import settings
from app.schemas.openmeteo_schemas import (
    OpenMeteoRequestSchema,
    OpenMeteoTimeSeriesSchema,
)


def build_request_url(
    request: OpenMeteoRequestSchema,
) -> tuple[str, dict[str, str]]:
    """Build base URL and query parameters for the Open-Meteo API."""
    base_url: str = settings.OPEN_METEO_BASE_URL
    params = request.to_query_params()

    alogger.debug("Built Open-Meteo URL: %s  params=%s", base_url, params)
    return base_url, params


def validate_date_string(value: str) -> date:
    """Parse and validate an ISO-8601 date string (YYYY-MM-DD).

    Raises
    ------
    ValueError
        If the string cannot be parsed as a valid date.
    """
    try:
        alogger.debug("Validating date string: %s", value)
        return date.fromisoformat(value)
    except (ValueError, TypeError) as exc:
        alogger.error(
            "Invalid date string '%s'. Expected format YYYY-MM-DD.", value,
        )
        raise ValueError(
            f"Invalid date string '{value}'. Expected format YYYY-MM-DD."
        ) from exc


def ensure_date(value: str | date) -> date:
    """Coerce a string or date/datetime into a ``date`` instance."""
    if isinstance(value, datetime):
        alogger.debug("Coercing datetime to date: %s", value)
        return value.date()

    if isinstance(value, date):
        alogger.debug("Value is already a date: %s", value)
        return value

    alogger.debug("Value is a string, validating as date: %s", value)
    return validate_date_string(value)


def timeseries_to_dataframe(
    ts: OpenMeteoTimeSeriesSchema,
    time_column: str = "time",
) -> pd.DataFrame:
    """Convert an Open-Meteo time-series block into a DataFrame.

    The ``time`` field becomes the DatetimeIndex; remaining fields become
    columns.
    """
    alogger.debug(
        "Converting Open-Meteo time series to DataFrame. Time column: %s",
        time_column,
    )
    raw = ts.model_dump()

    times = raw.pop(time_column)
    df = pd.DataFrame(raw, index=pd.to_datetime(times))
    df.index.name = time_column

    return df