# ./backend/app/services/pvgis_service.py
"""Service layer for orchestrating PVGIS data fetching and processing.

Wraps the fetch + pipeline steps with proper exception handling so that
any failure in the PVGIS chain surfaces as ``ExternalAPIError`` (HTTP 502)
instead of a generic 500.
"""

from typing import Any, Dict, Tuple, Union
import pandas as pd
from app.core.logger import alogger
from app.core.exceptions import ExternalAPIError
from app.schemas.pvgis_request_schemas import (
    PVGISHourlyRequestSchema,
    PVGISTMYRequestSchema,
    PVGISHorizonRequestSchema,
)
from app.schemas.pvgis_response_schemas import (
    PVGISHourlyResponseSchema,
    PVGISTMYResponseSchema,
    PVGISHorizonResponseSchema,
)
from app.outer_apis.pvgis.fetch_pvgis import fetch_tmy, fetch_hourly, fetch_horizon
from app.outer_apis.pvgis.pvgis_pipeline import process_pvgis_response


def get_hourly_data(
    request: PVGISHourlyRequestSchema, *, round_time: bool = False
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Fetches PVGIS hourly data and returns a pvlib-ready DataFrame with metadata.

    Raises:
        ExternalAPIError: If PVGIS fetch or data processing fails.
    """
    alogger.info(
        "PVGIS service: fetching hourly data for (%.4f, %.4f)",
        request.latitude, request.longitude,
    )

    response = fetch_hourly(request)  # Can raise ExternalAPIError ✓
    alogger.debug("PVGIS service: hourly response received, processing through pipeline")

    try:
        data, metadata = process_pvgis_response(response, round_time=round_time)
    except ExternalAPIError:
        raise
    except Exception as exc:
        alogger.exception("PVGIS service: hourly pipeline processing failed")
        raise ExternalAPIError("PVGIS", f"Data processing failed: {exc}") from exc

    alogger.info("PVGIS service: hourly data ready — shape=%s", data.shape)
    return data, metadata


def get_tmy_data(
    request: PVGISTMYRequestSchema, *, round_time: bool = False
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Fetches PVGIS TMY data and returns a pvlib-ready DataFrame with metadata.

    Raises:
        ExternalAPIError: If PVGIS fetch or data processing fails.
    """
    alogger.info(
        "PVGIS service: fetching TMY data for (%.4f, %.4f)",
        request.latitude, request.longitude,
    )

    response = fetch_tmy(request)  # Can raise ExternalAPIError ✓
    alogger.debug("PVGIS service: TMY response received, processing through pipeline")

    try:
        data, metadata = process_pvgis_response(response, round_time=round_time)
    except ExternalAPIError:
        raise
    except Exception as exc:
        alogger.exception("PVGIS service: TMY pipeline processing failed")
        raise ExternalAPIError("PVGIS", f"Data processing failed: {exc}") from exc

    alogger.info("PVGIS service: TMY data ready — shape=%s", data.shape)
    return data, metadata


def get_horizon_data(
    request: PVGISHorizonRequestSchema,
) -> Tuple[Dict[float, float], Dict[str, Any]]:
    """Fetches PVGIS horizon profile and returns azimuth-elevation dict with metadata.

    Raises:
        ExternalAPIError: If PVGIS fetch or data processing fails.
    """
    alogger.info(
        "PVGIS service: fetching horizon data for (%.4f, %.4f)",
        request.latitude, request.longitude,
    )

    response = fetch_horizon(request)  # Can raise ExternalAPIError ✓
    alogger.debug("PVGIS service: horizon response received, processing through pipeline")

    try:
        data, metadata = process_pvgis_response(response)
    except ExternalAPIError:
        raise
    except Exception as exc:
        alogger.exception("PVGIS service: horizon pipeline processing failed")
        raise ExternalAPIError("PVGIS", f"Data processing failed: {exc}") from exc

    alogger.info("PVGIS service: horizon data ready — %d azimuth points", len(data))
    return data, metadata


def get_pvgis_data(
    request: Union[PVGISHourlyRequestSchema, PVGISTMYRequestSchema, PVGISHorizonRequestSchema],
    *,
    round_time: bool = False,
) -> Tuple[Any, Dict[str, Any]]:
    """Auto-detects request type and fetches the appropriate PVGIS data."""
    if isinstance(request, PVGISHourlyRequestSchema):
        return get_hourly_data(request, round_time=round_time)

    if isinstance(request, PVGISTMYRequestSchema):
        return get_tmy_data(request, round_time=round_time)

    if isinstance(request, PVGISHorizonRequestSchema):
        return get_horizon_data(request)

    alogger.error("PVGIS service: unsupported request type — %s", type(request))
    raise TypeError(f"Unsupported PVGIS request type: {type(request)}")