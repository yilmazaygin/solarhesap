# ./backend/app/services/historical_service.py
"""Historical solar production simulation service.

Uses PVGIS hourly POA data for a specific calendar year rather than TMY.
The POA irradiance is fetched for the panel's actual orientation, so ModelChain
can call run_model_from_poa() directly — no GHI→POA decomposition needed.

Engineering notes:
  - PVGIS hourly data includes horizon shading and actual met conditions for
    the chosen year (SARAH-2/SARAH-3 + ERA5).
  - run_model_from_poa() bypasses the irradiance decomposition step but still
    uses the aoi_model to compute effective irradiance from POA components.
    We use aoi_model='no_loss' (same as basic_electric) because CEC module
    entries lack IAM parameters.
  - System losses (14 %) from presets cover soiling, wiring, mismatch,
    degradation — same as basic_electric.
  - Temperature is modelled dynamically by SAPM using hourly temp_air and
    wind_speed from PVGIS.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import pandas as pd
from pvlib.location import Location
from pvlib.modelchain import ModelChain
from pvlib.pvsystem import PVSystem, retrieve_sam
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

from app.core.logger import alogger
from app.schemas.historical_schemas import HistoricalBasicRequest, HistoricalAdvancedRequest
from app.services.basic_electric_service import (
    _load_presets,
    _calculate_layout,
    _scale_inverter,
    MONTH_NAMES,
)

_PACKING_FACTOR = 0.85


# ===========================================================================
# Shared PVGIS POA fetch
# ===========================================================================

def _fetch_pvgis_poa(
    lat: float,
    lng: float,
    year: int,
    surface_tilt: float,
    surface_azimuth: float,
) -> pd.DataFrame:
    """Fetch PVGIS hourly POA data for a specific calendar year.

    Returns a DataFrame with (at least) poa_global, temp_air, wind_speed.
    """
    from app.schemas.pvgis_request_schemas import PVGISHourlyRequestSchema
    from app.services.pvgis_service import get_hourly_data

    req = PVGISHourlyRequestSchema(
        latitude=lat,
        longitude=lng,
        start=year,
        end=year,
        surface_tilt=surface_tilt,
        surface_azimuth=surface_azimuth,
        components=True,
        usehorizon=True,
        map_variables=True,
    )
    df, _ = get_hourly_data(req, round_time=True)
    return df


def _poa_weather(df: pd.DataFrame) -> pd.DataFrame:
    """Extract and complete the columns needed by run_model_from_poa.

    PVGIS hourly returns poa_direct + poa_diffuse but not poa_global.
    pvlib requires all three, so we derive poa_global = poa_direct + poa_diffuse.
    """
    out = df.copy()
    if "poa_global" not in out.columns:
        direct = out.get("poa_direct", pd.Series(0.0, index=out.index))
        diffuse = out.get("poa_diffuse", pd.Series(0.0, index=out.index))
        out["poa_global"] = direct + diffuse
    want = ["poa_global", "poa_direct", "poa_diffuse", "temp_air", "wind_speed"]
    cols = [c for c in want if c in out.columns]
    return out[cols]


# ===========================================================================
# Shared result formatter
# ===========================================================================

def _format_result(
    year: int,
    lat: float,
    lng: float,
    elevation: float,
    ac_kw: pd.Series,
    system_info: dict[str, Any],
    loss_pct: float,
    weather_note: str,
) -> dict[str, Any]:
    monthly_kwh = ac_kw.resample("ME").sum()
    annual_kwh = float(ac_kw.sum())

    total_dc_kw: float = system_info.get("total_dc_kw", 0.0)
    total_ac_kw: float = system_info.get("total_ac_kw", 0.0)
    specific_yield = round(annual_kwh / total_dc_kw, 1) if total_dc_kw > 0 else 0.0
    capacity_factor_pct = (
        round(annual_kwh / (total_ac_kw * 8760) * 100, 1) if total_ac_kw > 0 else 0.0
    )

    hourly_records = [
        {"datetime": dt.strftime("%Y-%m-%dT%H:%M:%S"), "ac_kw": round(float(v), 4)}
        for dt, v in ac_kw.items()
    ]
    monthly_records = [
        {
            "month": int(dt.month),
            "month_name": MONTH_NAMES[dt.month - 1],
            "energy_kwh": round(float(v), 2),
        }
        for dt, v in monthly_kwh.items()
    ]

    return {
        "year": year,
        "location": {"latitude": lat, "longitude": lng, "elevation": elevation},
        "system_info": {
            **system_info,
            "surface_azimuth_deg": system_info.get("surface_azimuth_deg"),
            "surface_tilt_deg": system_info.get("surface_tilt_deg"),
        },
        "summary": {
            "annual_energy_kwh": round(annual_kwh, 1),
            "specific_yield_kwh_kwp": specific_yield,
            "capacity_factor_pct": capacity_factor_pct,
            "system_loss_pct": loss_pct,
        },
        "monthly": monthly_records,
        "hourly": hourly_records,
        "metadata": {
            "weather_source": f"PVGIS hourly (SARAH, year {year})",
            "temperature_model": "SAPM dynamic (hourly POA + T_amb + wind)",
            "note": (
                f"Historical year {year}. PVGIS POA includes horizon shading "
                "and actual meteorological conditions. "
                "Apply 0.5–0.7 %/yr panel degradation for age-adjusted estimates."
            ),
            "weather_note": weather_note,
        },
    }


# ===========================================================================
# Basic mode
# ===========================================================================

def run_historical_basic(req: HistoricalBasicRequest) -> dict[str, Any]:
    """Run historical basic simulation (preset-based) using PVGIS POA for a specific year."""
    presets = _load_presets()
    preset = presets[req.efficiency_tier]

    total_area = (
        req.area_m2 if req.area_m2 is not None
        else req.area_a * req.area_b  # type: ignore[operator]
    )
    layout = _calculate_layout(total_area, preset)

    surface_tilt = min(abs(req.latitude), 60.0)
    surface_azimuth = 180.0 if req.latitude >= 0 else 0.0

    alogger.info(
        "Historical Basic: year=%d  tier=%s  area=%.1f m²  tilt=%.1f°  az=%.0f°",
        req.year, req.efficiency_tier, total_area, surface_tilt, surface_azimuth,
    )

    hourly_df = _fetch_pvgis_poa(
        req.latitude, req.longitude, req.year, surface_tilt, surface_azimuth,
    )
    weather_df = _poa_weather(hourly_df)

    location = Location(
        latitude=req.latitude,
        longitude=req.longitude,
        altitude=req.elevation,
        tz="UTC",
    )

    mod_db = retrieve_sam(preset["module_db"])
    module_params = mod_db[preset["module_name"]]
    inv_db = retrieve_sam(preset["inverter_db"])
    inv_params_raw = inv_db[preset["inverter_name"]]
    temp_params = dict(
        TEMPERATURE_MODEL_PARAMETERS[preset["temperature_model"]][preset["temperature_config"]]
    )

    n_inv = layout["n_inverters"]
    scaled_inv = _scale_inverter(inv_params_raw, n_inv)

    system = PVSystem(
        surface_tilt=surface_tilt,
        surface_azimuth=surface_azimuth,
        module_parameters=module_params,
        inverter_parameters=scaled_inv,
        temperature_model_parameters=temp_params,
        modules_per_string=layout["modules_per_string"],
        strings_per_inverter=layout["n_strings"],
        racking_model="open_rack",
    )

    mc = ModelChain(
        system=system,
        location=location,
        dc_model="cec",
        ac_model="sandia",
        aoi_model="no_loss",
        spectral_model="no_loss",
    )
    mc.run_model_from_poa(weather_df)

    loss_pct = float(preset.get("system_loss_pct", 14.0))
    ac_kw = mc.results.ac.clip(lower=0.0) / 1000.0 * (1.0 - loss_pct / 100.0)

    total_dc_kw = layout["total_dc_w"] / 1000.0
    total_ac_kw = layout["total_ac_w"] / 1000.0

    system_info = {
        "efficiency_tier": req.efficiency_tier,
        "tier_label": preset["label_en"],
        "module_name": preset["module_name"],
        "module_stc_w": preset["module_stc_w"],
        "module_efficiency_pct": preset["efficiency_pct"],
        "module_dimensions_m": f"{preset['module_length_m']:.3f} × {preset['module_width_m']:.3f}",
        "inverter_name": preset["inverter_name"],
        "inverter_paco_kw": round(preset["inverter_paco_w"] / 1000.0, 1),
        "n_panels": layout["n_panels"],
        "modules_per_string": layout["modules_per_string"],
        "n_strings": layout["n_strings"],
        "n_inverters": n_inv,
        "total_dc_kw": round(total_dc_kw, 2),
        "total_ac_kw": round(total_ac_kw, 2),
        "dc_ac_ratio": layout["dc_ac_actual"],
        "dc_ac_warning": layout["dc_ac_warning"],
        "panel_area_m2": round(layout["panel_area_m2"], 3),
        "total_panel_area_m2": round(layout["total_panel_area_m2"], 2),
        "input_area_m2": round(total_area, 2),
        "surface_tilt_deg": round(surface_tilt, 1),
        "surface_azimuth_deg": surface_azimuth,
    }

    return _format_result(
        year=req.year,
        lat=req.latitude,
        lng=req.longitude,
        elevation=req.elevation,
        ac_kw=ac_kw,
        system_info=system_info,
        loss_pct=loss_pct,
        weather_note=f"PVGIS SARAH hourly POA for year {req.year}",
    )


# ===========================================================================
# Advanced mode
# ===========================================================================

def run_historical_advanced(req: HistoricalAdvancedRequest) -> dict[str, Any]:
    """Run historical advanced simulation (custom ModelChain) using PVGIS POA for a specific year."""
    from app.schemas.location_schema import LocationSchema
    from app.schemas.advanced_modelchain_schemas import RunModelChainAdvancedRequest
    from app.pvlib_tools.create_location import create_location
    from app.pvlib_tools.create_pvsystem_advanced import create_pvsystem_advanced

    # Determine orientation for PVGIS POA fetch
    if not req.use_arrays:
        surface_tilt = req.flat_system.surface_tilt       # type: ignore[union-attr]
        surface_azimuth = req.flat_system.surface_azimuth # type: ignore[union-attr]
    else:
        surface_tilt = req.arrays[0].surface_tilt         # type: ignore[index]
        surface_azimuth = req.arrays[0].surface_azimuth   # type: ignore[index]

    alogger.info(
        "Historical Advanced: year=%d  lat=%.4f  lon=%.4f  tilt=%.1f°  az=%.0f°",
        req.year, req.latitude, req.longitude, surface_tilt, surface_azimuth,
    )

    hourly_df = _fetch_pvgis_poa(
        req.latitude, req.longitude, req.year, surface_tilt, surface_azimuth,
    )
    weather_df = _poa_weather(hourly_df)

    location_schema = LocationSchema(
        latitude=req.latitude,
        longitude=req.longitude,
        altitude=req.elevation,
        tz="UTC",
    )
    location = create_location(location_schema)

    # Build a RunModelChainAdvancedRequest purely for system construction
    adv_req = RunModelChainAdvancedRequest(
        location=location_schema,
        use_arrays=req.use_arrays,
        flat_system=req.flat_system,
        arrays=req.arrays,
        inverter=req.inverter,
        modelchain_config=req.modelchain_config,
        # Weather fields — not used for system construction but required by schema
        weather_source="pvgis_poa",
        start_year=req.year,
        end_year=req.year,
        pvgis_startyear=req.year,
        pvgis_endyear=req.year,
        pvgis_surface_tilt=surface_tilt,
        pvgis_surface_azimuth=surface_azimuth,
    )
    system = create_pvsystem_advanced(adv_req)

    mc_kwargs: dict = {}
    if req.modelchain_config is not None:
        mc_kwargs = req.modelchain_config.model_dump(exclude_none=True)

    mc = ModelChain(system=system, location=location, **mc_kwargs)

    if not isinstance(weather_df.index, pd.DatetimeIndex):
        weather_df.index = pd.DatetimeIndex(weather_df.index)

    mc.run_model_from_poa(weather_df)

    ac_kw = mc.results.ac.clip(lower=0.0) / 1000.0

    # For advanced mode we don't have presets — report raw simulation output
    # (no additional loss factor; user configures losses via ModelChain if needed)
    system_info = {
        "surface_tilt_deg": round(surface_tilt, 1),
        "surface_azimuth_deg": surface_azimuth,
        "use_arrays": req.use_arrays,
        # dc/ac capacity estimates from the inverter config if available
        "total_dc_kw": None,
        "total_ac_kw": None,
    }

    return _format_result(
        year=req.year,
        lat=req.latitude,
        lng=req.longitude,
        elevation=req.elevation,
        ac_kw=ac_kw,
        system_info=system_info,
        loss_pct=0.0,
        weather_note=f"PVGIS SARAH hourly POA for year {req.year}",
    )
