# ./backend/app/api/v1/clearsky_routes.py
"""Thin FastAPI route layer for clearsky endpoints.

All business logic lives in ``app.services.clearsky_service`` and
``app.services.deep_comparison``.  Routes only validate input, delegate
to services, and handle HTTP error mapping.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.clearsky_api_schemas import (
    InstestreBirdRequest,
    PvlibIneichenRequest,
    SimplifiedSolisRequest,
    PvlibBirdRequest,
    PvgisTmyRequest,
    PvgisPOARequest,
    DeepComparisonRequest,
)
from app.services import clearsky_service
from app.services.deep_comparison import run_deep_comparison

router = APIRouter(prefix="/clearsky", tags=["Clearsky Models"])


# ===========================================================================
# Individual model endpoints
# ===========================================================================

@router.post("/instesre-bird", summary="INSTESRE Bird Clear Sky")
def instesre_bird(request: InstestreBirdRequest):
    """Compute INSTESRE Bird clearsky irradiance with OpenMeteo atmospheric
    data, then apply the selected average-year strategy(ies)."""
    try:
        return clearsky_service.run_instesre_bird(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/pvlib-ineichen", summary="pvlib Ineichen/Perez Clear Sky")
def pvlib_ineichen(request: PvlibIneichenRequest):
    """Compute Ineichen/Perez clearsky irradiance with auto-loaded Linke
    turbidity and OpenMeteo atmospheric data."""
    try:
        return clearsky_service.run_ineichen(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/pvlib-solis", summary="pvlib Simplified Solis Clear Sky")
def pvlib_simplified_solis(request: SimplifiedSolisRequest):
    """Compute Simplified Solis clearsky irradiance with OpenMeteo
    atmospheric data."""
    try:
        return clearsky_service.run_simplified_solis(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/pvlib-bird", summary="pvlib Bird Clear Sky")
def pvlib_bird(request: PvlibBirdRequest):
    """Compute pvlib Bird clearsky irradiance with OpenMeteo atmospheric
    data.  Same model as INSTESRE, pvlib implementation."""
    try:
        return clearsky_service.run_pvlib_bird(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/pvgis-tmy", summary="PVGIS Typical Meteorological Year")
def pvgis_tmy(request: PvgisTmyRequest):
    """Fetch the PVGIS TMY for the given location.  Already a representative
    year — no average-year processing is applied."""
    try:
        return clearsky_service.run_pvgis_tmy(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/pvgis-poa", summary="PVGIS Hourly POA Irradiance")
def pvgis_poa(request: PvgisPOARequest):
    """Fetch multi-year PVGIS hourly POA data and apply average-year
    strategy(ies).  SARAH2 data available 2005–2023."""
    try:
        return clearsky_service.run_pvgis_poa(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ===========================================================================
# Deep comparison
# ===========================================================================

@router.post("/deep-comparison", summary="Deep Model Comparison")
def deep_comparison(request: DeepComparisonRequest):
    """Run all selected clearsky models with all selected avg-year
    strategies and return a comparison matrix."""
    try:
        return run_deep_comparison(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
