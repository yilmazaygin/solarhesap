# ./backend/app/pvlib_tools/create_pvsystem.py
"""Create a pvlib PVSystem object from a validated schema."""

from pvlib.pvsystem import PVSystem

from app.schemas.pvsystem_schema import PVSystemSchema
from app.core.logger import alogger


def create_pvsystem(system_data: PVSystemSchema) -> PVSystem:
    """Construct a pvlib PVSystem from validated PVSystemSchema data."""
    alogger.debug("Received PVSystem schema data for creation: %s", system_data)
    pvsystem_data = system_data.model_dump(exclude_none=True)
    alogger.debug("PVSystem data after excluding None values: %s", pvsystem_data)

    return PVSystem(**pvsystem_data)
