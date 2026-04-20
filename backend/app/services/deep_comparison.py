# ./backend/app/services/deep_comparison.py
"""Deep comparison service: every model × every avg-year strategy.

Produces a matrix of results that allows side-by-side comparison of all
solar simulation models and averaging strategies for the same location and period.
"""

from __future__ import annotations

from typing import Any

from app.core.logger import alogger
from app.schemas.clearsky_api_schemas import (
    DeepComparisonRequest,
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisTmyRequest,
    PvgisPOARequest,
)
from app.services import clearsky_service


def run_deep_comparison(request: DeepComparisonRequest) -> dict[str, Any]:
    """Run every requested model with every requested avg-year strategy.

    Returns
    -------
    dict
        ``comparison`` maps model names to their ``run_*`` result dicts.
        ``summary_matrix`` provides a quick overview table of annual GHI
        for each (model, strategy) combination.
    """
    alogger.info(
        "Deep comparison: models=%s, strategies=%s, range=%d–%d",
        request.models, request.avg_year_strategies,
        request.start_year, request.end_year,
    )

    comparison: dict[str, Any] = {}
    summary_matrix: dict[str, dict[str, float | None]] = {}

    # --- OpenMeteo-based clearsky models ---
    model_runners = {
        "instesre_bird": (
            clearsky_service.run_instesre_bird,
            InstestreBirdRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
                avg_year_strategies=request.avg_year_strategies,
                decay=request.decay,
                lower_percentile=request.lower_percentile,
                upper_percentile=request.upper_percentile,
                reference_year=request.reference_year,
                ozone=request.ozone, aod500=request.aod500,
                aod380=request.aod380, albedo=request.albedo,
                solar_constant=request.solar_constant,
            ),
        ),
        "ineichen": (
            clearsky_service.run_ineichen,
            PvlibIneichenRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
                avg_year_strategies=request.avg_year_strategies,
                decay=request.decay,
                lower_percentile=request.lower_percentile,
                upper_percentile=request.upper_percentile,
                reference_year=request.reference_year,
            ),
        ),
        "simplified_solis": (
            clearsky_service.run_simplified_solis,
            SimplifiedSolisRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
                avg_year_strategies=request.avg_year_strategies,
                decay=request.decay,
                lower_percentile=request.lower_percentile,
                upper_percentile=request.upper_percentile,
                reference_year=request.reference_year,
                aod700=request.aod700,
            ),
        ),
        "pvlib_bird": (
            clearsky_service.run_pvlib_bird,
            PvlibBirdRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
                avg_year_strategies=request.avg_year_strategies,
                decay=request.decay,
                lower_percentile=request.lower_percentile,
                upper_percentile=request.upper_percentile,
                reference_year=request.reference_year,
                ozone=request.ozone, aod500=request.aod500,
                aod380=request.aod380, albedo=request.albedo,
                asymmetry=request.asymmetry,
            ),
        ),
    }

    for model_name in request.models:
        if model_name not in model_runners:
            alogger.warning("Unknown model in deep comparison: %s (skipping)", model_name)
            continue

        runner_func, model_request = model_runners[model_name]
        alogger.info("Deep comparison: running %s", model_name)

        try:
            result = runner_func(model_request)
            comparison[model_name] = result

            # Extract annual GHI for summary matrix
            summary_matrix[model_name] = {}
            for strat_name, strat_data in result.get("results", {}).items():
                ghi_val = strat_data.get("summary", {}).get("annual_ghi_kwh_m2")
                summary_matrix[model_name][strat_name] = ghi_val

        except Exception as exc:
            alogger.error("Deep comparison: %s failed — %s", model_name, exc)
            comparison[model_name] = {"error": str(exc)}
            summary_matrix[model_name] = {"error": str(exc)}

    # --- PVGIS TMY (optional) ---
    if request.include_pvgis_tmy:
        alogger.info("Deep comparison: running PVGIS TMY")
        try:
            tmy_request = PvgisTmyRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
            )
            tmy_result = clearsky_service.run_pvgis_tmy(tmy_request)
            comparison["pvgis_tmy"] = tmy_result

            tmy_ghi = tmy_result.get("results", {}).get("tmy", {}).get("summary", {}).get("annual_ghi_kwh_m2")
            summary_matrix["pvgis_tmy"] = {"tmy": tmy_ghi}

        except Exception as exc:
            alogger.error("Deep comparison: PVGIS TMY failed — %s", exc)
            comparison["pvgis_tmy"] = {"error": str(exc)}
            summary_matrix["pvgis_tmy"] = {"error": str(exc)}

    # --- PVGIS POA (optional) ---
    if request.include_pvgis_poa:
        alogger.info("Deep comparison: running PVGIS POA")
        try:
            poa_end = min(request.end_year, 2023)  # SARAH2 limit
            poa_request = PvgisPOARequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=poa_end,
                timezone=request.timezone,
                avg_year_strategies=request.avg_year_strategies,
                decay=request.decay,
                lower_percentile=request.lower_percentile,
                upper_percentile=request.upper_percentile,
                reference_year=request.reference_year,
                surface_tilt=request.surface_tilt,
                surface_azimuth=request.surface_azimuth,
            )
            poa_result = clearsky_service.run_pvgis_poa(poa_request)
            comparison["pvgis_poa"] = poa_result

            summary_matrix["pvgis_poa"] = {}
            for strat_name, strat_data in poa_result.get("results", {}).items():
                poa_val = strat_data.get("summary", {}).get("annual_poa_global_kwh_m2")
                summary_matrix["pvgis_poa"][strat_name] = poa_val

        except Exception as exc:
            alogger.error("Deep comparison: PVGIS POA failed — %s", exc)
            comparison["pvgis_poa"] = {"error": str(exc)}
            summary_matrix["pvgis_poa"] = {"error": str(exc)}

    alogger.info("Deep comparison complete: %d models evaluated", len(comparison))

    return {
        "location": {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "elevation": request.elevation,
        },
        "year_range": {
            "start_year": request.start_year,
            "end_year": request.end_year,
        },
        "summary_matrix": summary_matrix,
        "comparison": comparison,
    }
