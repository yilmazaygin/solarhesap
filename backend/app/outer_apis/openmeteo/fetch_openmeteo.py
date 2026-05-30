# ./backend/app/outer_apis/openmeteo/fetch_openmeteo.py
"""Fetch Open-Meteo historical weather data with retry and structured errors.

Uses Tenacity for exponential-backoff retry on transient network errors.
Raises ``ExternalAPIError`` / ``ExternalAPITimeoutError`` on permanent
failures so that the FastAPI error-handler middleware returns the correct
HTTP status code (502 / 504).
"""

from __future__ import annotations

from typing import Any, Callable, TypeVar

import pandas as pd
import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from app.core.settings import settings
from app.core.logger import alogger
from app.core.exceptions import ExternalAPIError, ExternalAPITimeoutError
from app.outer_apis.openmeteo.openmeteo_helpers import (
    build_request_url,
    timeseries_to_dataframe,
)
from app.schemas.openmeteo_schemas import (
    OpenMeteoRequestSchema,
    OpenMeteoResponseSchema,
)

T = TypeVar("T")

# Transient exceptions that warrant a retry
_RETRYABLE = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
    ConnectionError,
)


@retry(
    stop=stop_after_attempt(settings.RETRY_MAX_ATTEMPTS),
    wait=wait_exponential(multiplier=settings.RETRY_WAIT_MULTIPLIER, min=2, max=30),
    retry=retry_if_exception_type(_RETRYABLE),
    before_sleep=before_sleep_log(alogger, log_level=20),  # INFO
    reraise=True,
)
def _call_open_meteo(func: Callable[..., T], **params: Any) -> T:
    """Invoke an HTTP function with retry and structured error handling."""
    try:
        alogger.debug("Calling Open-Meteo with params: %s", params)
        return func(**params)
    except requests.exceptions.Timeout as exc:
        alogger.warning("Open-Meteo request timed out: %s", exc)
        raise  # Tenacity will retry
    except requests.exceptions.ConnectionError as exc:
        alogger.warning("Open-Meteo connection error (will retry): %s", exc)
        raise  # Tenacity will retry
    except requests.exceptions.RequestException as exc:
        # Non-retryable HTTP errors (e.g. 400, 403)
        alogger.exception("Open-Meteo request failed (non-retryable)")
        raise ExternalAPIError("Open-Meteo", str(exc)) from exc


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
        raise ExternalAPIError("Open-Meteo", detail) from exc

    data: dict[str, Any] = response.json()
    if data.get("error"):
        reason = data.get("reason", "Unknown error")
        alogger.error("Open-Meteo API logical error: %s", reason)
        raise ExternalAPIError("Open-Meteo", reason)

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

    try:
        response = _call_open_meteo(
            requests.get,
            url=base_url,
            params=query_params,
            timeout=settings.OPENMETEO_TIMEOUT,
        )
    except requests.exceptions.Timeout as exc:
        # All retries exhausted
        raise ExternalAPITimeoutError("Open-Meteo", settings.OPENMETEO_TIMEOUT) from exc
    except _RETRYABLE as exc:
        raise ExternalAPIError(
            "Open-Meteo",
            f"Connection failed after {settings.RETRY_MAX_ATTEMPTS} retries: {exc}",
        ) from exc

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
