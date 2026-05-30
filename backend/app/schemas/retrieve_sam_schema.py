# ./backend/app/schemas/retrieve_sam_schema.py
"""This file contains the RetrieveSAMSchemas class which defines the schema for retrieving SAM data."""
# ADD ENUM LOGIC LATER

from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.core.logger import alogger

class RetrieveSAMSchema(BaseModel):
    name: str | None = Field(default=None, description=" Use one of the following strings to retrieve a database bundled with pvlib: CECMod, CECInverter, SandiaInverter (CEC is only current inverter db available; tag kept forbackwards compatibility), SandiaMod and ADRInverter.")
    path: str | None = Field(default=None, description="Path to a CSV file or a URL.")
    
    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "name": "CECMod"
            }
        }
    )