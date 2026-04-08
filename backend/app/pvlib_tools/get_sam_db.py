# ./backend/app/pvlib_tools/get_sam_db.py
"""Retrieve a SAM database (modules or inverters) via pvlib."""

import pandas as pd

from pvlib.pvsystem import retrieve_sam

from app.schemas.retrieve_sam_schema import RetrieveSAMSchema
from app.core.logger import alogger


def get_sam_db(retrieve_schema: RetrieveSAMSchema) -> pd.DataFrame:
    """Retrieve a SAM database and return as a DataFrame of models.

    Columns represent individual models (inverters or modules).
    """
    alogger.debug("Retrieving SAM database with schema: %s", retrieve_schema)
    data = retrieve_schema.model_dump(exclude_none=True)
    alogger.debug("Data after excluding None values: %s", data)

    df = retrieve_sam(**data)
    if df is None or df.empty:
        alogger.error(
            "Retrieved SAM database is empty or None for schema: %s",
            retrieve_schema,
        )
        raise ValueError("Retrieved SAM database is empty or None.")

    return df
