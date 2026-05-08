# ./backend/app/services/basic_electric_service.py
"""Basic Electric Production Estimate.

Engineering design decisions:
  - Panel count: floor(area × packing_factor / panel_footprint), rounded down to
    whole strings.  No panel count reduction for inverter rounding.
  - Inverter count: round(DC_kW / (dc_ac_ratio × inverter_kW)), minimum 1.
    Using round (not ceil) keeps DC/AC near the target ratio.
  - Simulation: n_inverters modelled as ONE scaled unit (Paco × n) with all
    strings attached.  This is equivalent to n parallel identical inverters and
    correctly models clipping at total AC capacity.
  - Temperature: SAPM dynamic model (Sandia) — uses actual hourly POA irradiance,
    ambient temperature, and wind speed from PVGIS TMY.  No fixed STC assumption.
  - System losses: configurable in presets YAML (default 14 %, matching PVGIS).
    Covers soiling, DC/AC wiring, mismatch, degradation, availability.
  - Capacity factor: annual_kwh / (nominal_AC_kW × 8760), where nominal AC =
    n_inverters × rated_paco.  NOT based on simulated peak output.
  - Weather: PVGIS TMY derived from 19 years (2005-2023) SARAH3 satellite +
    ERA5 reanalysis — equivalent to long-term harmonised dataset.
"""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
import yaml
from pvlib.location import Location
from pvlib.modelchain import ModelChain
from pvlib.pvsystem import PVSystem, retrieve_sam
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

from app.core.logger import alogger
from app.schemas.basic_electric_schemas import BasicElectricRequest

_PRESETS_FILE = Path(__file__).parent.parent / "config" / "basic_electric_presets.yaml"
_PACKING_FACTOR  = 0.85   # fraction of gross area usable after walkways / gaps
_AREA_TOLERANCE  = 0.10   # allow actual panel footprint to exceed input area by up to 10 %
_DC_AC_WARN_LOW  = 0.90   # warn if DC/AC ratio below this
_DC_AC_WARN_HIGH = 1.45   # warn if DC/AC ratio above this

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


# ===========================================================================
# Config loader
# ===========================================================================

@lru_cache(maxsize=1)
def _load_presets() -> dict[str, Any]:
    with open(_PRESETS_FILE) as fh:
        return yaml.safe_load(fh)["presets"]


# ===========================================================================
# System layout
# ===========================================================================

def _calculate_layout(total_area: float, preset: dict) -> dict[str, Any]:
    """Panel count, string config, and inverter count.

    String rounding policy: keep whole strings (n_strings × mps) to preserve
    valid string voltage.  Inverter count uses round() so DC/AC stays near target.

    Area tolerance: actual panel footprint may exceed the raw input area by up to
    _AREA_TOLERANCE (10 %).  Beyond that, strings are dropped one by one; if even
    a single full string overflows, the string is shortened to however many panels
    fit within the tolerance band.  This prevents the minimum-1-string guarantee
    from silently placing panels on non-existent roof space.
    """
    panel_area = preset["module_length_m"] * preset["module_width_m"]
    mps: int = preset["modules_per_string"]

    n_max = int((total_area * _PACKING_FACTOR) / panel_area)
    n_strings = max(1, n_max // mps)
    actual_panels = n_strings * mps

    # ── Area overflow check ───────────────────────────────────────────────
    # Maximum panels whose combined footprint fits within input area + tolerance.
    max_by_area = max(1, int(total_area * (1 + _AREA_TOLERANCE) / panel_area))
    if actual_panels > max_by_area:
        # Try reducing whole strings first.
        n_strings = max(1, max_by_area // mps)
        actual_panels = n_strings * mps
        # If even a single full string is still too large, shorten to individual panels.
        if actual_panels > max_by_area:
            actual_panels = max_by_area
            mps = actual_panels   # one partial string
            n_strings = 1

    total_dc_w = actual_panels * preset["module_stc_w"]

    # Inverter count: target DC/AC ratio, use round (not ceil) to stay in range
    paco_ref = preset["inverter_paco_w"]
    target_ac_w = total_dc_w / preset["dc_ac_ratio"]
    n_inverters = max(1, round(target_ac_w / paco_ref))
    total_ac_w = n_inverters * paco_ref
    dc_ac_actual = total_dc_w / total_ac_w

    dc_ac_warning: str | None = None
    if dc_ac_actual < _DC_AC_WARN_LOW:
        dc_ac_warning = (
            f"DC/AC ratio is {dc_ac_actual:.2f} (below {_DC_AC_WARN_LOW}). "
            "System is significantly under-invertered. "
            "Consider a smaller inverter for this system size."
        )
    elif dc_ac_actual > _DC_AC_WARN_HIGH:
        dc_ac_warning = (
            f"DC/AC ratio is {dc_ac_actual:.2f} (above {_DC_AC_WARN_HIGH}). "
            "Significant clipping expected during peak hours."
        )

    return {
        "n_panels": actual_panels,
        "modules_per_string": mps,
        "n_strings": n_strings,
        "n_inverters": n_inverters,
        "total_dc_w": total_dc_w,
        "total_ac_w": total_ac_w,
        "dc_ac_actual": round(dc_ac_actual, 3),
        "dc_ac_warning": dc_ac_warning,
        "panel_area_m2": panel_area,
        "total_panel_area_m2": actual_panels * panel_area,
    }


# ===========================================================================
# Inverter scaling helper
# ===========================================================================

def _scale_inverter(params: Any, n: int) -> dict:
    """Return a copy of Sandia inverter params scaled for n parallel units.

    Only the power-level parameters (Paco, Pdco, Pso, Pnt) scale linearly.
    Voltage parameters (Vdco, Mppt_low, Mppt_high) and efficiency coefficients
    (C0–C3) do NOT scale — they are intensive properties of the inverter design.
    """
    scaled = dict(params)
    for key in ("Paco", "Pdco", "Pso", "Pnt"):
        if key in scaled and scaled[key] is not None:
            scaled[key] = float(scaled[key]) * n
    return scaled


# ===========================================================================
# Public entry point
# ===========================================================================

def run_basic_electric(req: BasicElectricRequest) -> dict[str, Any]:
    """Run the basic electric production estimate."""
    presets = _load_presets()
    preset = presets[req.efficiency_tier]

    total_area = (
        req.area_m2 if req.area_m2 is not None
        else req.area_a * req.area_b  # type: ignore[operator]
    )
    layout = _calculate_layout(total_area, preset)

    alogger.info(
        "BasicElectric: tier=%s  area=%.1f m²  panels=%d  strings=%d  "
        "inverters=%d  DC=%.2f kW  AC=%.2f kW  DC/AC=%.2f",
        req.efficiency_tier, total_area,
        layout["n_panels"], layout["n_strings"], layout["n_inverters"],
        layout["total_dc_w"] / 1000, layout["total_ac_w"] / 1000,
        layout["dc_ac_actual"],
    )
    if layout["dc_ac_warning"]:
        alogger.warning("BasicElectric DC/AC: %s", layout["dc_ac_warning"])

    # ── Fetch TMY ──────────────────────────────────────────────────────
    from app.schemas.pvgis_request_schemas import PVGISTMYRequestSchema
    from app.services.pvgis_service import get_tmy_data

    pvgis_req = PVGISTMYRequestSchema(latitude=req.latitude, longitude=req.longitude)
    tmy_df, meta = get_tmy_data(pvgis_req, round_time=True)

    # ── pvlib Location (UTC — TMY index is UTC) ────────────────────────
    location = Location(
        latitude=req.latitude,
        longitude=req.longitude,
        altitude=req.elevation,
        tz="UTC",
    )

    # ── Load SAM components ────────────────────────────────────────────
    mod_db = retrieve_sam(preset["module_db"])
    module_params = mod_db[preset["module_name"]]

    inv_db = retrieve_sam(preset["inverter_db"])
    inv_params_raw = inv_db[preset["inverter_name"]]

    temp_params = dict(
        TEMPERATURE_MODEL_PARAMETERS[preset["temperature_model"]][preset["temperature_config"]]
    )

    # ── Surface orientation (user override or auto from latitude) ─────
    surface_tilt = req.surface_tilt if req.surface_tilt is not None else min(abs(req.latitude), 60.0)
    surface_azimuth = req.surface_azimuth if req.surface_azimuth is not None else (180.0 if req.latitude >= 0 else 0.0)

    # ── PVSystem: all strings on one scaled inverter bank ──────────────
    # Scaling n inverters as one unit: Paco/Pdco/Pso × n_inverters.
    # strings_per_inverter = n_strings so pvlib sees total DC power.
    # The Sandia model then clips at the scaled Paco = n_inverters × paco_ref.
    n_inv = layout["n_inverters"]
    scaled_inv = _scale_inverter(inv_params_raw, n_inv)

    system = PVSystem(
        surface_tilt=surface_tilt,
        surface_azimuth=surface_azimuth,
        module_parameters=module_params,
        inverter_parameters=scaled_inv,
        temperature_model_parameters=temp_params,
        modules_per_string=layout["modules_per_string"],
        strings_per_inverter=layout["n_strings"],   # all strings → scaled inverter
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
    mc.run_model(tmy_df)

    # Clip nighttime negatives; no n_inverters scaling needed (already scaled)
    ac_kw_raw: pd.Series = mc.results.ac.clip(lower=0.0) / 1000.0

    # Apply real-world system losses (soiling, wiring, mismatch, degradation).
    loss_pct: float = float(preset.get("system_loss_pct", 14.0))
    ac_kw: pd.Series = ac_kw_raw * (1.0 - loss_pct / 100.0)

    # ── Aggregations ───────────────────────────────────────────────────
    monthly_kwh = ac_kw.resample("ME").sum()
    annual_kwh = float(ac_kw.sum())

    total_dc_kw = layout["total_dc_w"] / 1000.0
    total_ac_kw = layout["total_ac_w"] / 1000.0            # nominal AC (inverter rated)
    specific_yield = round(annual_kwh / total_dc_kw, 1) if total_dc_kw > 0 else 0.0

    # Capacity factor = annual_kWh / (nominal_AC_kW × 8760)
    # Nominal AC = n_inverters × inverter rated paco — NOT simulated peak
    capacity_factor_pct = round(annual_kwh / (total_ac_kw * 8760) * 100, 1) if total_ac_kw > 0 else 0.0

    # ── Build response ─────────────────────────────────────────────────
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
        "location": {
            "latitude": req.latitude,
            "longitude": req.longitude,
            "elevation": req.elevation,
        },
        "system_info": {
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
            "weather_source": "PVGIS TMY (SARAH3 2005-2023 + ERA5)",
            "temperature_model": "SAPM dynamic (hourly POA + T_amb + wind)",
            "months_selected": meta.get("months_selected", []),
            "note": "Year-1 estimate. Apply 0.5-0.7 %/yr panel degradation for multi-year projections.",
        },
    }
