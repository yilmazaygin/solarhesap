# ./backend/app/schemas/location_schema.py
"""This file contains the LocationSchema class which defines the schema for location data."""

import datetime
from pydantic import BaseModel, Field, ConfigDict

class LocationSchema(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees. Positive is north of the equator.")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees. Positive is east of the prime meridian.")
    # http://en.wikipedia.org/wiki/List_of_tz_database_time_zones for all valid timezones list.
    tz: str | int | float | datetime.timezone | datetime.tzinfo | None = Field(default=None, description="(default 'UTC') IANA timezone string or UTC offset in hours. Defaults to UTC in pvlib.")
    altitude: float | None = Field(default=None, ge=-450, le=8850, description="(default 0) Altitude from sea level in meters. Defaults to 0 in pvlib.")
    name: str | None = Field(default=None, description="(Optional) Sets the name attribute of the Location object.")

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "latitude": 38.42,
                "longitude": 27.14,
                "name": "Izmir City Center"
            }
        }
    )
