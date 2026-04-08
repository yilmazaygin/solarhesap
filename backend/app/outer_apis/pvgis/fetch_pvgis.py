# ./backend/app/outer_apis/pvgis/fetch_pvgis.py
"""Fetch PVGIS data via pvlib and transform into response schemas."""

from typing import Callable, Any, TypeVar

from pvlib.iotools import get_pvgis_tmy, get_pvgis_hourly, get_pvgis_horizon

from app.core.logger import alogger
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


def _call_pvgis(func: Callable[..., T], **params: Any) -> T:
    """Call a pvlib PVGIS function with uniform error handling."""
    try:
        alogger.debug(
            "Calling PVGIS function %s with parameters: %s",
            func.__name__, params,
        )
        return func(**params)
    except Exception as exc:
        alogger.exception("PVGIS request failed")
        raise RuntimeError(f"PVGIS request failed: {exc}") from exc


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

    result = _call_pvgis(func, **params)
    return transformer(result)


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