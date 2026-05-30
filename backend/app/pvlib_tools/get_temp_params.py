# ./backend/app/pvlib_tools/get_temp_params.py
"""Retrieve pvlib temperature model parameters by model name and config."""

from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

from app.core.logger import alogger


def get_temp_params(model: str, config: str) -> dict:
    """Look up temperature model parameters for a given model and config."""
    if model not in TEMPERATURE_MODEL_PARAMETERS:
        alogger.error("Invalid temperature model: '%s'", model)
        raise ValueError(f"Invalid temperature model: '{model}'")

    model_configs = TEMPERATURE_MODEL_PARAMETERS[model]

    if config not in model_configs:
        alogger.error("Invalid config '%s' for model '%s'", config, model)
        raise ValueError(f"Invalid config '{config}' for model '{model}'")

    params = dict(model_configs[config])

    alogger.debug(
        "Temperature params retrieved | model=%s, config=%s, params=%s",
        model, config, params,
    )

    return params
