# ./backend/app/services/deep_comparison_yield.py
from __future__ import annotations

from typing import Any

from app.core.logger import alogger
from app.schemas.clearsky_api_schemas import (
    DeepComparisonYieldRequest,
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisPOARequest,
)
from app.services import clearsky_service
from app.services.basic_electric_service import run_electric_simulation_from_df
from app.average_year.create_average_year import create_average_year


def run_deep_comparison_yield(request: DeepComparisonYieldRequest) -> dict[str, Any]:
    """Run every requested model with the first requested avg-year strategy, 
    and simulate AC power yield.

    Returns
    -------
    dict
        ``comparison`` maps model names to their electric simulation results.
        ``summary_matrix`` provides a quick overview table of annual AC energy (kWh).
    """
    alogger.info(
        "Deep comparison yield: models=%s, range=%d–%d, tier=%s",
        request.models, request.start_year, request.end_year, request.efficiency_tier
    )

    comparison: dict[str, Any] = {}
    summary_matrix: dict[str, dict[str, float | None]] = {}

    # Average year strategy to use (fallback to simple_mean)
    strategy = request.avg_year_strategies[0] if request.avg_year_strategies else "simple_mean"

    model_runners = {
        "instesre_bird": (
            clearsky_service._generate_instesre_bird,
            InstestreBirdRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
            ),
        ),
        "ineichen": (
            clearsky_service._generate_ineichen,
            PvlibIneichenRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
            ),
        ),
        "simplified_solis": (
            clearsky_service._generate_simplified_solis,
            SimplifiedSolisRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
                aod700=request.aod700,
            ),
        ),
        "pvlib_bird": (
            clearsky_service._generate_pvlib_bird,
            PvlibBirdRequest(
                latitude=request.latitude, longitude=request.longitude,
                elevation=request.elevation,
                start_year=request.start_year, end_year=request.end_year,
                timezone=request.timezone,
                ozone=request.ozone, aod500=request.aod500,
                aod380=request.aod380, albedo=request.albedo,
                asymmetry=request.asymmetry,
            ),
        ),
    }

    for model_name in request.models:
        if model_name not in model_runners:
            alogger.warning("Unknown model in deep comparison yield: %s", model_name)
            continue

        runner_func, model_request = model_runners[model_name]
        alogger.info("Deep comparison yield: generating weather for %s", model_name)

        try:
            # 1. Generate multi-year dataframe
            multi_year_df = runner_func(model_request)
            
            # 2. Average into 1 year
            avg_df = create_average_year(
                multi_year_df,
                strategy=strategy,
                reference_year=2023,
                decay=0.90,
                lower_percentile=10.0,
                upper_percentile=90.0
            )

            # 3. Simulate AC power
            meta_note = f"Averaged via {strategy} (2023 reference). Simulated AC yield."
            sim_result = run_electric_simulation_from_df(request, avg_df, meta_note)
            
            # Pack results like deep_comparison to keep UI happy
            # Note: We use "tmy" as strategy key so the frontend can easily read it
            # since we removed the strategy dropdown and hardcoded it to "tmy"
            comparison[model_name] = {
                "model": model_name,
                "location": sim_result["location"],
                "results": {
                    strategy: {
                        "strategy": strategy,
                        "summary": sim_result["summary"],
                        "hourly": sim_result["hourly"],
                        "monthly": sim_result["monthly"],
                    }
                }
            }

            # Summary matrix uses strategy as key
            summary_matrix[model_name] = {strategy: sim_result["summary"]["annual_energy_kwh"]}

        except Exception as exc:
            alogger.error("Deep comparison yield: %s failed — %s", model_name, exc)
            comparison[model_name] = {"error": str(exc)}
            summary_matrix[model_name] = {strategy: None}

    # --- PVGIS TMY (optional) ---
    if request.include_pvgis_tmy:
        alogger.info("Deep comparison yield: fetching PVGIS TMY")
        try:
            from app.schemas.pvgis_request_schemas import PVGISTMYRequestSchema
            from app.services.pvgis_service import get_tmy_data
            
            pvgis_req = PVGISTMYRequestSchema(latitude=request.latitude, longitude=request.longitude)
            tmy_df, meta = get_tmy_data(pvgis_req, round_time=True)
            
            meta_note = "Weather: PVGIS TMY."
            sim_result = run_electric_simulation_from_df(request, tmy_df, meta_note)
            
            # We map TMY to "tmy" strategy
            tmy_strategy = "tmy"
            comparison["pvgis_tmy"] = {
                "model": "pvgis_tmy",
                "location": sim_result["location"],
                "results": {
                    tmy_strategy: {
                        "strategy": tmy_strategy,
                        "summary": sim_result["summary"],
                        "hourly": sim_result["hourly"],
                        "monthly": sim_result["monthly"],
                    }
                }
            }
            summary_matrix["pvgis_tmy"] = {tmy_strategy: sim_result["summary"]["annual_energy_kwh"]}

        except Exception as exc:
            alogger.error("Deep comparison yield: PVGIS TMY failed — %s", exc)
            comparison["pvgis_tmy"] = {"error": str(exc)}
            summary_matrix["pvgis_tmy"] = {"tmy": None}

    # --- PVGIS POA (optional) ---
    if request.include_pvgis_poa:
        alogger.info("Deep comparison yield: fetching PVGIS POA")
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
            multi_year_df = clearsky_service._generate_pvgis_poa(poa_request)
            
            # 2. Average into 1 year
            from app.services.response_serializers import POA_VALUE_COLS
            avg_df = create_average_year(
                multi_year_df,
                strategy=strategy,
                reference_year=2023,
                decay=0.90,
                lower_percentile=10.0,
                upper_percentile=90.0,
                value_columns=POA_VALUE_COLS
            )

            # 3. Simulate AC power
            meta_note = f"Averaged via {strategy} (2023 reference). Simulated AC yield from PVGIS POA."
            sim_result = run_electric_simulation_from_df(request, avg_df, meta_note)
            
            pvgis_poa_strategy = "pvgis_poa"
            comparison["pvgis_poa"] = {
                "model": "pvgis_poa",
                "location": sim_result["location"],
                "results": {
                    pvgis_poa_strategy: {
                        "strategy": pvgis_poa_strategy,
                        "summary": sim_result["summary"],
                        "hourly": sim_result["hourly"],
                        "monthly": sim_result["monthly"],
                    }
                }
            }
            summary_matrix["pvgis_poa"] = {pvgis_poa_strategy: sim_result["summary"]["annual_energy_kwh"]}

        except Exception as exc:
            alogger.error("Deep comparison yield: PVGIS POA failed — %s", exc)
            comparison["pvgis_poa"] = {"error": str(exc)}
            summary_matrix["pvgis_poa"] = {"pvgis_poa": None}

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
        "system_info": {
            "efficiency_tier": request.efficiency_tier,
            "area_m2": request.area_m2,
        },
        "summary_matrix": summary_matrix,
        "comparison": comparison,
    }
