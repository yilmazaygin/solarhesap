# ./backend/app/outer_apis/pvgis/pvgis_helpers.py
"""Transform raw pvlib PVGIS results into validated response schemas."""

import pandas as pd

from app.schemas.pvgis_response_schemas import (
    PVGISMonthYear,
    PVGISTMYResponseSchema,
    PVGISHourlyResponseSchema,
    PVGISHorizonResponseSchema,
)
from app.core.logger import alogger


# ---- Response transformers --------------------------------------------------

def transform_tmy(result) -> PVGISTMYResponseSchema:
    """Transform pvlib TMY result tuple into a response schema."""
    data, months_selected, inputs, metadata = result

    alogger.debug(
        "Transforming TMY result with %d records, months_selected: %s",
        len(data), months_selected,
    )
    alogger.debug("TMY inputs: %s", inputs)
    alogger.debug(
        "TMY metadata keys: %s",
        list(metadata.keys()) if isinstance(metadata, dict) else "N/A",
    )

    return PVGISTMYResponseSchema(
        data=_dataframe_to_records(data),
        months_selected=_parse_months_selected(months_selected),
        inputs=inputs if isinstance(inputs, dict) else {},
        metadata=metadata if isinstance(metadata, dict) else {},
    )


def transform_hourly(result) -> PVGISHourlyResponseSchema:
    """Transform pvlib hourly result tuple into a response schema."""
    data, inputs, metadata = result

    alogger.debug("Transforming hourly result with %d records", len(data))
    alogger.debug("Hourly inputs: %s", inputs)
    alogger.debug(
        "Hourly metadata keys: %s",
        list(metadata.keys()) if isinstance(metadata, dict) else "N/A",
    )

    return PVGISHourlyResponseSchema(
        data=_dataframe_to_records(data),
        inputs=inputs if isinstance(inputs, dict) else {},
        metadata=metadata if isinstance(metadata, dict) else {},
    )


def transform_horizon(result) -> PVGISHorizonResponseSchema:
    """Transform pvlib horizon result tuple into a response schema."""
    data, metadata = result

    alogger.debug("Transforming horizon result with %d records", len(data))
    alogger.debug(
        "Horizon metadata keys: %s",
        list(metadata.keys()) if isinstance(metadata, dict) else "N/A",
    )

    return PVGISHorizonResponseSchema(
        data=_prepare_horizon_data(data),
        metadata=metadata if isinstance(metadata, dict) else {},
    )


# ---- Internal helpers -------------------------------------------------------

def _prepare_horizon_data(data: pd.DataFrame | pd.Series) -> dict[float, float]:
    """Convert raw horizon data to {azimuth: elevation} dict."""
    if isinstance(data, pd.DataFrame):
        return dict(zip(
            data.index.astype(float),
            data.iloc[:, 0].astype(float),
        ))

    if isinstance(data, pd.Series):
        return {float(k): float(v) for k, v in data.items()}

    alogger.warning("Unexpected horizon data type: %s", type(data))

    try:
        return dict(data)
    except Exception:
        alogger.warning("Cannot convert horizon data to dict")
        raise ValueError("Invalid horizon data format")


def _dataframe_to_records(
    df: pd.DataFrame,
    copy: bool = False,
) -> list[dict[str, object]]:
    """Convert a DataFrame to a list of record dicts."""
    if copy:
        df = df.copy()

    if df.index.name is None:
        df.index.name = "time"

    return df.reset_index().to_dict(orient="records")


def _parse_months_selected(
    months_selected: pd.DataFrame | list | None,
) -> list[PVGISMonthYear]:
    """Parse PVGIS 'months_selected' into PVGISMonthYear objects."""
    if months_selected is None:
        return []

    result: list[PVGISMonthYear] = []

    if isinstance(months_selected, pd.DataFrame):
        for row in months_selected.itertuples():
            result.append(
                PVGISMonthYear(month=int(row.month), year=int(row.year))
            )

    elif isinstance(months_selected, list):
        for item in months_selected:
            try:
                if isinstance(item, dict):
                    m, y = item["month"], item["year"]
                else:
                    m, y = item

                result.append(PVGISMonthYear(month=int(m), year=int(y)))

            except (TypeError, ValueError):
                alogger.warning(
                    "Skipping invalid months_selected entry: %s", item,
                )

    return result