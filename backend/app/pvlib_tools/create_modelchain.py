# ./backend/app/pvlib_tools/create_modelchain.py
"""Create a pvlib ModelChain instance from validated data."""

from pvlib.modelchain import ModelChain

from app.schemas.modelchain_schema import ModelChainSchema
from app.core.logger import alogger


def create_modelchain(modelchain_data: ModelChainSchema) -> ModelChain:
    """Construct a pvlib ModelChain from a ModelChainSchema."""
    alogger.debug("Creating ModelChain with the following data: %s", modelchain_data)
    data = modelchain_data.model_dump()
    alogger.debug("ModelChain data after validation and parsing: %s", data)
    modelchain = ModelChain(**data)
    alogger.debug("ModelChain created successfully: %s", modelchain)

    return modelchain