# ./backend/app/pvlib_tools/create_location.py
"""Create a pvlib Location object from a validated schema."""

from pvlib.location import Location

from app.core.logger import alogger
from app.schemas.location_schema import LocationSchema


def create_location(location_schema: LocationSchema) -> Location:
    """Construct a pvlib Location from a LocationSchema instance."""
    alogger.debug("Creating Location object from schema: %s", location_schema)
    location_data = location_schema.model_dump(exclude_none=True)
    alogger.debug("Location data (nones excluded): %s", location_data)

    return Location(**location_data)