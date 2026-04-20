# ./backend/app/api/v1/solar_simulation_routes.py
"""Thin FastAPI route layer for solar simulation endpoints.

All business logic lives in ``app.services.clearsky_service``,
``app.services.modelchain_service``, and ``app.services.deep_comparison``.

Routes only validate input and delegate to services.  Error handling is
performed by the centralised exception-handler middleware registered in
``app.core.error_handlers`` — no try/except blocks needed here.

Heavy endpoints (run-modelchain, deep-comparison) use ``asyncio.to_thread``
to run CPU-bound service code in a separate thread, keeping the FastAPI
event loop non-blocking for concurrent requests.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter

from app.schemas.clearsky_api_schemas import (
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisTmyRequest,
    PvgisPOARequest,
    DeepComparisonRequest,
    RunModelChainRequest,
)
from app.services import clearsky_service
from app.services.modelchain_service import run_modelchain as _run_modelchain
from app.services.deep_comparison import run_deep_comparison

router = APIRouter(prefix="/solar-simulation", tags=["Solar Simulation Models"])


# ===========================================================================
# Individual model endpoints
# ===========================================================================

@router.post("/instesre-bird", summary="INSTESRE Bird Clear Sky")
def instesre_bird(request: InstestreBirdRequest):
    """Compute INSTESRE Bird clearsky irradiance with OpenMeteo atmospheric
    data, then apply the selected average-year strategy(ies)."""
    return clearsky_service.run_instesre_bird(request)


@router.post("/pvlib-ineichen", summary="pvlib Ineichen/Perez Clear Sky")
def pvlib_ineichen(request: PvlibIneichenRequest):
    """Compute Ineichen/Perez clearsky irradiance with auto-loaded Linke
    turbidity and OpenMeteo atmospheric data."""
    return clearsky_service.run_ineichen(request)


@router.post("/pvlib-solis", summary="pvlib Simplified Solis Clear Sky")
def pvlib_simplified_solis(request: SimplifiedSolisRequest):
    """Compute Simplified Solis clearsky irradiance with OpenMeteo
    atmospheric data."""
    return clearsky_service.run_simplified_solis(request)


@router.post("/pvlib-bird", summary="pvlib Bird Clear Sky")
def pvlib_bird(request: PvlibBirdRequest):
    """Compute pvlib Bird clearsky irradiance with OpenMeteo atmospheric
    data.  Same model as INSTESRE, pvlib implementation."""
    return clearsky_service.run_pvlib_bird(request)


@router.post("/pvgis-tmy", summary="PVGIS Typical Meteorological Year")
def pvgis_tmy(request: PvgisTmyRequest):
    """Fetch the PVGIS TMY for the given location.  Already a representative
    year — no average-year processing is applied."""
    return clearsky_service.run_pvgis_tmy(request)


@router.post("/pvgis-poa", summary="PVGIS Hourly POA Irradiance")
def pvgis_poa(request: PvgisPOARequest):
    """Fetch multi-year PVGIS hourly POA data and apply average-year
    strategy(ies).  SARAH2 data available 2005–2023."""
    return clearsky_service.run_pvgis_poa(request)


# ===========================================================================
# Deep comparison (async — CPU-heavy)
# ===========================================================================

@router.post("/deep-comparison", summary="Deep Model Comparison")
async def deep_comparison(request: DeepComparisonRequest):
    """Run all selected solar simulation models with all selected avg-year
    strategies and return a comparison matrix.

    Uses ``asyncio.to_thread`` to avoid blocking the event loop.
    """
    return await asyncio.to_thread(run_deep_comparison, request)


# ===========================================================================
# PVLib ModelChain simulation (async — CPU-heavy)
# ===========================================================================

@router.post("/run-modelchain", summary="Run PVLib ModelChain Simulation")
async def run_modelchain(request: RunModelChainRequest):
    """Run a full PVLib ModelChain simulation.

    Generates clearsky weather data using the selected model, applies
    avg-year strategies, then runs a PV system simulation with the
    provided location, module, inverter, and system configuration.

    Returns both irradiance results and PV simulation output (AC/DC power).

    Uses ``asyncio.to_thread`` to avoid blocking the event loop.
    """
    return await asyncio.to_thread(_run_modelchain, request)
