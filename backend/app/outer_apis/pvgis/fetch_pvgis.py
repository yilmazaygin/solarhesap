# ./backend/app/outer_apis/pvgis/fetch_pvgis.py
"""Fetch PVGIS data via pvlib with retry and structured error handling.

Uses Tenacity for exponential-backoff retry on transient network errors.
Raises ``ExternalAPIError`` / ``ExternalAPITimeoutError`` on permanent
failures so that the FastAPI error-handler middleware returns the correct
HTTP status code (502 / 504).
"""

from __future__ import annotations

from typing import Callable, Any, TypeVar

import requests.exceptions
from pvlib.iotools import get_pvgis_tmy, get_pvgis_hourly, get_pvgis_horizon
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from app.core.logger import alogger
from app.core.settings import settings
from app.core.exceptions import ExternalAPIError, ExternalAPITimeoutError
from app.schemas.pvgis_request_schemas import (
    PVGISTMYRequestSchema,
    PVGISHourlyRequestSchema,
    PVGISHorizonRequestSchema,
)
from app.outer_apis.pvgis.pvgis_helpers import (
    transform_tmy,
    transform_hourly,
    transform_horizon,
)

T = TypeVar("T")

# Transient exceptions that warrant a retry.
# requests.exceptions.* inherit from OSError, but we list them explicitly
# for clarity.  pvlib uses requests internally for PVGIS calls.
_RETRYABLE = (
    ConnectionError,
    TimeoutError,
    OSError,
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


@retry(
    stop=stop_after_attempt(settings.RETRY_MAX_ATTEMPTS),
    wait=wait_exponential(multiplier=settings.RETRY_WAIT_MULTIPLIER, min=2, max=30),
    retry=retry_if_exception_type(_RETRYABLE),
    before_sleep=before_sleep_log(alogger, log_level=20),  # INFO
    reraise=True,
)
def _call_pvgis(func: Callable[..., T], **params: Any) -> T:
    """Call a pvlib PVGIS function with retry and structured error handling."""
    try:
        alogger.debug(
            "Calling PVGIS function %s with parameters: %s",
            func.__name__, params,
        )
        return func(**params)
    except (TimeoutError, requests.exceptions.Timeout) as exc:
        alogger.warning("PVGIS request timed out: %s", exc)
        raise  # Tenacity will retry
    except (ConnectionError, OSError, requests.exceptions.ConnectionError) as exc:
        alogger.warning("PVGIS connection error (will retry): %s", exc)
        raise  # Tenacity will retry
    except requests.exceptions.HTTPError as exc:
        # PVGIS returned an HTTP error (e.g. 500, 503, 400)
        status = getattr(exc.response, "status_code", None)
        if status and 500 <= status < 600:
            # Server-side error — worth retrying
            alogger.warning("PVGIS server error %d (will retry): %s", status, exc)
            raise OSError(f"PVGIS HTTP {status}") from exc  # Triggers retry
        # Client-side error (4xx) — non-retryable
        alogger.error("PVGIS client error %s: %s", status, exc)
        raise ExternalAPIError("PVGIS", str(exc)) from exc
    except Exception as exc:
        # Non-retryable errors
        alogger.exception("PVGIS request failed (non-retryable)")
        raise ExternalAPIError("PVGIS", str(exc)) from exc


def _fetch(
    func: Callable[..., Any],
    request: PVGISTMYRequestSchema | PVGISHourlyRequestSchema | PVGISHorizonRequestSchema,
    transformer: Callable[..., Any],
):
    """Generic PVGIS fetch orchestration: call → transform."""
    params = request.to_pvlib_params()

    alogger.info(
        "Fetching %s for (%.4f, %.4f)",
        func.__name__, request.latitude, request.longitude,
    )
    alogger.debug("PVGIS fetch parameters: %s", params)

    try:
        result = _call_pvgis(func, **params)
    except _RETRYABLE as exc:
        # All retries exhausted — convert to timeout or API error
        if isinstance(exc, (TimeoutError, requests.exceptions.Timeout)):
            raise ExternalAPITimeoutError("PVGIS", settings.PVGIS_TIMEOUT) from exc
        raise ExternalAPIError(
            "PVGIS",
            f"Connection failed after {settings.RETRY_MAX_ATTEMPTS} retries: {exc}",
        ) from exc
    except ExternalAPIError:
        raise  # Already wrapped — propagate as-is

    # Transform the raw pvlib result into our schema.
    # Wrap transformation errors so they don't leak as generic 500.
    try:
        return transformer(result)
    except Exception as exc:
        alogger.exception("PVGIS response transformation failed")
        raise ExternalAPIError(
            "PVGIS", f"Failed to process PVGIS response: {exc}"
        ) from exc


# ---------------------------------------------------------------------------

def fetch_tmy(request: PVGISTMYRequestSchema):
    """Fetch TMY data from PVGIS."""
    return _fetch(get_pvgis_tmy, request, transform_tmy)


def fetch_hourly(request: PVGISHourlyRequestSchema):
    """Fetch hourly radiation data from PVGIS."""
    return _fetch(get_pvgis_hourly, request, transform_hourly)


def fetch_horizon(request: PVGISHorizonRequestSchema):
    """Fetch horizon profile data from PVGIS."""
    return _fetch(get_pvgis_horizon, request, transform_horizon)


# ---------------------------------------------------------------------------

def fetch_pvgis_generic(
    request: PVGISTMYRequestSchema | PVGISHourlyRequestSchema | PVGISHorizonRequestSchema,
):
    """Auto-detect request type and dispatch to the appropriate fetcher."""
    if isinstance(request, PVGISTMYRequestSchema):
        return fetch_tmy(request)
    elif isinstance(request, PVGISHourlyRequestSchema):
        return fetch_hourly(request)
    elif isinstance(request, PVGISHorizonRequestSchema):
        return fetch_horizon(request)
    else:
        raise TypeError(f"Unsupported request type: {type(request)}")