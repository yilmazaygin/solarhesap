# ./backend/app/pvlib_tools/get_component.py
"""Retrieve specific modules and inverters from SAM databases."""

import pandas as pd
from typing import Tuple

from app.core.logger import alogger


def get_component(db: pd.DataFrame, component_name: str) -> pd.Series:
    """Look up a single component (module or inverter) by name."""
    if component_name not in db.columns:
        alogger.error(
            "Component '%s' not found in database (%d models).",
            component_name, len(db.columns),
        )
        raise KeyError(f"Component '{component_name}' not found.")

    component = db[component_name]

    if not isinstance(component, pd.Series):
        alogger.error(
            "Extracted component '%s' is not a pd.Series (type=%s).",
            component_name, type(component),
        )
        raise TypeError(
            f"Extracted component '{component_name}' is not a pd.Series."
        )

    return component


def get_module_and_inverter(
    module_db: pd.DataFrame,
    module_name: str,
    inverter_db: pd.DataFrame,
    inverter_name: str,
) -> Tuple[pd.Series, pd.Series]:
    """Retrieve both module and inverter components in one call."""
    alogger.debug(
        "Fetching PV components: module='%s' from %d models, "
        "inverter='%s' from %d models",
        module_name, len(module_db.columns),
        inverter_name, len(inverter_db.columns),
    )

    module = get_component(module_db, module_name)
    inverter = get_component(inverter_db, inverter_name)

    return module, inverter