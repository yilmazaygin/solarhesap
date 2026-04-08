# ./backend/app/services/pvgis_service.py
"""Service layer for orchestrating PVGIS data fetching and processing into pvlib-ready structures."""

from typing import Any, Dict, Tuple, Union
import pandas as pd
from app.core.logger import alogger
from app.schemas.pvgis_request_schemas import PVGISHourlyRequestSchema, PVGISTMYRequestSchema, PVGISHorizonRequestSchema
from app.schemas.pvgis_response_schemas import PVGISHourlyResponseSchema, PVGISTMYResponseSchema, PVGISHorizonResponseSchema
from app.outer_apis.pvgis.fetch_pvgis import fetch_tmy, fetch_hourly, fetch_horizon
from app.outer_apis.pvgis.pvgis_pipeline import process_pvgis_response


def get_hourly_data(request: PVGISHourlyRequestSchema, *, round_time: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Fetches PVGIS hourly data and returns a pvlib-ready DataFrame with metadata.

    Args:
        request: Validated hourly request schema.
        round_time: If True, round timestamps to the nearest hour.

    Returns:
        Tuple of (pvlib-ready DataFrame, metadata dict).
    """
    alogger.info("PVGIS service: fetching hourly data for (%.4f, %.4f)", request.latitude, request.longitude)

    response = fetch_hourly(request)
    alogger.debug("PVGIS service: hourly response received, processing through pipeline")

    data, metadata = process_pvgis_response(response, round_time=round_time)
    alogger.info("PVGIS service: hourly data ready — shape=%s", data.shape)

    return data, metadata


def get_tmy_data(request: PVGISTMYRequestSchema, *, round_time: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Fetches PVGIS TMY data and returns a pvlib-ready DataFrame with metadata.

    Args:
        request: Validated TMY request schema.
        round_time: If True, round timestamps to the nearest hour.

    Returns:
        Tuple of (pvlib-ready DataFrame, metadata dict).
    """
    alogger.info("PVGIS service: fetching TMY data for (%.4f, %.4f)", request.latitude, request.longitude)

    response = fetch_tmy(request)
    alogger.debug("PVGIS service: TMY response received, processing through pipeline")

    data, metadata = process_pvgis_response(response, round_time=round_time)
    alogger.info("PVGIS service: TMY data ready — shape=%s", data.shape)

    return data, metadata


def get_horizon_data(request: PVGISHorizonRequestSchema) -> Tuple[Dict[float, float], Dict[str, Any]]:
    """Fetches PVGIS horizon profile and returns azimuth-elevation dict with metadata.

    Args:
        request: Validated horizon request schema.

    Returns:
        Tuple of (horizon dict {azimuth: elevation}, metadata dict).
    """
    alogger.info("PVGIS service: fetching horizon data for (%.4f, %.4f)", request.latitude, request.longitude)

    response = fetch_horizon(request)
    alogger.debug("PVGIS service: horizon response received, processing through pipeline")

    data, metadata = process_pvgis_response(response)
    alogger.info("PVGIS service: horizon data ready — %d azimuth points", len(data))

    return data, metadata


def get_pvgis_data(
    request: Union[PVGISHourlyRequestSchema, PVGISTMYRequestSchema, PVGISHorizonRequestSchema],
    *,
    round_time: bool = False,
) -> Tuple[Any, Dict[str, Any]]:
    """Auto-detects request type and fetches the appropriate PVGIS data.

    Args:
        request: Any validated PVGIS request schema.
        round_time: If True, round timestamps to the nearest hour (ignored for horizon).

    Returns:
        Tuple of (processed data, metadata dict).

    Raises:
        TypeError: If request type is not supported.
    """
    if isinstance(request, PVGISHourlyRequestSchema):
        return get_hourly_data(request, round_time=round_time)

    if isinstance(request, PVGISTMYRequestSchema):
        return get_tmy_data(request, round_time=round_time)

    if isinstance(request, PVGISHorizonRequestSchema):
        return get_horizon_data(request)

    alogger.error("PVGIS service: unsupported request type — %s", type(request))
    raise TypeError(f"Unsupported PVGIS request type: {type(request)}")