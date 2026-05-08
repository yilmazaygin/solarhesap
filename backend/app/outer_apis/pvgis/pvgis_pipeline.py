# ./backend/app/outer_apis/pvgis/pvgis_pipeline.py
"""Pipeline for processing PVGIS responses into pvlib-ready structures.

Supports:
    - Hourly → POA-based DataFrame
    - TMY   → GHI/DNI/DHI DataFrame
    - Horizon → dict[azimuth → elevation]
"""

from typing import Tuple, Dict, Any, List, Union

import pandas as pd

from app.schemas.pvgis_response_schemas import (
    PVGISHourlyResponseSchema,
    PVGISTMYResponseSchema,
    PVGISHorizonResponseSchema,
)
from app.core.logger import alogger


# ---- Internal extractors ----------------------------------------------------

def _extract_from_hourly_schema(
    response: PVGISHourlyResponseSchema,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Extract data and metadata from PVGISHourlyResponseSchema."""
    alogger.debug("Extracting data from PVGISHourlyResponseSchema")

    return response.data, {
        "inputs": response.inputs,
        "metadata": response.metadata,
    }


def _extract_from_tmy_schema(
    response: PVGISTMYResponseSchema,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Extract data and metadata from PVGISTMYResponseSchema."""
    alogger.debug("Extracting data from PVGISTMYResponseSchema")

    return response.data, {
        "inputs": response.inputs,
        "metadata": response.metadata,
        "months_selected": [m.model_dump() for m in response.months_selected],
    }


def _extract_from_horizon_schema(
    response: PVGISHorizonResponseSchema,
) -> Tuple[Dict[float, float], Dict[str, Any]]:
    """Extract horizon data and metadata."""
    alogger.debug("Extracting data from PVGISHorizonResponseSchema")

    return response.data, {
        "metadata": response.metadata,
    }


def _extract_from_dict(
    response: Dict[str, Any],
) -> Tuple[Any, Dict[str, Any]]:
    """Generic dict extractor for untyped responses."""
    if "data" not in response:
        raise ValueError("Invalid PVGIS response: missing 'data' field")

    alogger.debug("Extracting data from raw dict response")

    return response["data"], {
        k: v for k, v in response.items() if k != "data"
    }


# ---- Core transformations ---------------------------------------------------

def _build_dataframe(
    data: List[Dict[str, Any]],
    *,
    time_key: str,
    round_time: bool,
) -> pd.DataFrame:
    """Build a DatetimeIndex DataFrame from time-series records."""
    if not data:
        raise ValueError("Empty PVGIS data")

    df = pd.DataFrame(data)

    if time_key not in df.columns:
        raise ValueError(f"Missing '{time_key}' field in PVGIS data")

    df[time_key] = pd.to_datetime(df[time_key], utc=True)
    df = df.set_index(time_key)

    if round_time:
        df.index = df.index.floor("h")

    return df


def _hourly_to_pvlib(
    data: List[Dict[str, Any]],
    *,
    round_time: bool,
) -> pd.DataFrame:
    """Convert hourly PVGIS data into a pvlib-compatible DataFrame."""
    df = _build_dataframe(data, time_key="time", round_time=round_time)

    rename_map = {
        "poa_sky_diffuse": "poa_diffuse",
    }
    df = df.rename(columns=rename_map)

    # PVGIS doesn't return poa_global directly — compute from components.
    # pvlib's run_model_from_poa() requires this column.
    if "poa_global" not in df.columns:
        poa_components = [c for c in ("poa_direct", "poa_diffuse", "poa_ground_diffuse") if c in df.columns]
        if poa_components:
            df["poa_global"] = df[poa_components].sum(axis=1)

    # Drop non-pvlib columns
    for col in ("P", "Int", "solar_elevation"):
        if col in df.columns:
            df = df.drop(columns=[col])

    return df


def _tmy_to_pvlib(
    data: List[Dict[str, Any]],
    *,
    round_time: bool,
) -> pd.DataFrame:
    """Convert TMY PVGIS data into a pvlib-compatible DataFrame."""
    df = _build_dataframe(data, time_key="time(UTC)", round_time=round_time)
    return df


def _horizon_to_pvlib(data: Dict[str | float, float]) -> Dict[float, float]:
    """Convert horizon data to {azimuth: elevation} float dict."""
    if not isinstance(data, dict):
        raise ValueError("Invalid horizon data format")

    try:
        return {float(k): float(v) for k, v in data.items()}
    except Exception as exc:
        raise ValueError("Failed to parse horizon data") from exc


# ---- Public pipeline --------------------------------------------------------

def process_pvgis_response(
    response: Union[
        PVGISHourlyResponseSchema,
        PVGISTMYResponseSchema,
        PVGISHorizonResponseSchema,
        Dict[str, Any],
    ],
    *,
    round_time: bool = False,
) -> Tuple[Any, Dict[str, Any]]:
    """Unified PVGIS processing pipeline.

    Returns
    -------
    result : DataFrame | dict
        Processed data (time-series or horizon profile).
    other : dict
        Metadata and inputs.
    """
    # ---- Type dispatch ----

    if isinstance(response, PVGISHourlyResponseSchema):
        data, other = _extract_from_hourly_schema(response)
        result = _hourly_to_pvlib(data, round_time=round_time)

    elif isinstance(response, PVGISTMYResponseSchema):
        data, other = _extract_from_tmy_schema(response)
        result = _tmy_to_pvlib(data, round_time=round_time)

    elif isinstance(response, PVGISHorizonResponseSchema):
        data, other = _extract_from_horizon_schema(response)
        result = _horizon_to_pvlib(data)

    elif isinstance(response, dict):
        data, other = _extract_from_dict(response)

        # Heuristic type detection
        if isinstance(data, dict):
            result = _horizon_to_pvlib(data)
        elif data and "time(UTC)" in data[0]:
            result = _tmy_to_pvlib(data, round_time=round_time)
        else:
            result = _hourly_to_pvlib(data, round_time=round_time)

    else:
        raise TypeError(f"Unsupported response type: {type(response)}")

    alogger.debug(
        "PVGIS pipeline completed: type=%s, meta_keys=%s",
        type(result), list(other.keys()),
    )

    return result, other


# ---- Convenience wrappers ---------------------------------------------------

def get_pvlib_ready_from_hourly(
    response: PVGISHourlyResponseSchema,
    *,
    round_time: bool = False,
):
    """Process an hourly response through the pipeline."""
    return process_pvgis_response(response, round_time=round_time)


def get_pvlib_ready_from_tmy(
    response: PVGISTMYResponseSchema,
    *,
    round_time: bool = False,
):
    """Process a TMY response through the pipeline."""
    return process_pvgis_response(response, round_time=round_time)


def get_pvlib_ready_from_horizon(response: PVGISHorizonResponseSchema):
    """Process a horizon response through the pipeline."""
    return process_pvgis_response(response)