# ./backend/app/outer_apis/openmeteo/fetch_openmeteo.py
"""Fetch Open-Meteo historical weather data with schema-validated requests."""

from __future__ import annotations

from typing import Any, Callable, TypeVar

import pandas as pd
import requests

from app.core.settings import settings
from app.core.logger import alogger
from app.outer_apis.openmeteo.openmeteo_helpers import (
    build_request_url,
    timeseries_to_dataframe,
)
from app.schemas.openmeteo_schemas import (
    OpenMeteoRequestSchema,
    OpenMeteoResponseSchema,
)

T = TypeVar("T")


def _call_open_meteo(func: Callable[..., T], **params: Any) -> T:
    """Invoke an HTTP function and normalise transport-level errors."""
    try:
        alogger.debug("Calling Open-Meteo with params: %s", params)
        return func(**params)
    except requests.exceptions.RequestException as exc:
        alogger.exception("Open-Meteo request failed")
        raise RuntimeError(f"Open-Meteo request failed: {exc}") from exc


def _extract_openmeteo_json(response: requests.Response) -> dict[str, Any]:
    """Validate HTTP response and return parsed JSON body."""
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        detail = str(exc)
        try:
            detail = response.json().get("reason", detail)
        except Exception:
            pass
        alogger.error("Open-Meteo HTTP error: %s", detail)
        raise RuntimeError(f"Open-Meteo API error: {detail}") from exc

    data: dict[str, Any] = response.json()
    if data.get("error"):
        reason = data.get("reason", "Unknown error")
        alogger.error("Open-Meteo API logical error: %s", reason)
        raise RuntimeError(f"Open-Meteo API error: {reason}")

    return data


# ---------------------------------------------------------------------------

def _fetch(
    request: OpenMeteoRequestSchema,
) -> dict[str, OpenMeteoResponseSchema | pd.DataFrame | None]:
    """Generic Open-Meteo fetch orchestration."""
    base_url, query_params = build_request_url(request)

    alogger.info(
        "Fetching Open-Meteo data for (%.4f, %.4f) from %s to %s",
        request.latitude, request.longitude,
        request.start_date, request.end_date,
    )
    alogger.debug("Open-Meteo URL: %s", base_url)
    alogger.debug("Open-Meteo query params: %s", query_params)

    response = _call_open_meteo(
        requests.get,
        url=base_url,
        params=query_params,
        timeout=settings.OPENMETEO_TIMEOUT,
    )
    raw_json = _extract_openmeteo_json(response)

    validated_response = OpenMeteoResponseSchema.model_validate(raw_json)

    hourly_df: pd.DataFrame | None = None
    daily_df: pd.DataFrame | None = None

    if validated_response.hourly is not None:
        hourly_df = timeseries_to_dataframe(validated_response.hourly)
        alogger.info("Hourly DataFrame shape: %s", hourly_df.shape)

    if validated_response.daily is not None:
        daily_df = timeseries_to_dataframe(validated_response.daily)
        alogger.info("Daily DataFrame shape: %s", daily_df.shape)

    return {
        "response": validated_response,
        "hourly_dataframe": hourly_df,
        "daily_dataframe": daily_df,
    }


# ---------------------------------------------------------------------------

def fetch_open_meteo(
    request: OpenMeteoRequestSchema,
) -> dict[str, OpenMeteoResponseSchema | pd.DataFrame | None]:
    """Public entry point: fetch historical weather data from Open-Meteo."""
    return _fetch(request)
