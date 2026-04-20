# ./backend/app/api/v1/solar_tools_routes.py
"""FastAPI routes for standalone solar calculation tools.

Each endpoint is a thin wrapper that validates input via Pydantic schemas
and delegates to ``app.services.solar_tools_service``.

Error handling is performed by the centralised exception-handler middleware —
no try/except blocks needed here.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.solar_tools_schemas import (
    JulianDayRequest,
    SolarPositionRequest,
    SunriseSunsetRequest,
    AirmassRequest,
    ExtraterrestrialRequest,
    DewPointRequest,
    StationPressureRequest,
    ISAPressureRequest,
    AngleOfIncidenceRequest,
    OptimalTiltRequest,
    InstantBirdRequest,
    SolarDeclinationRequest,
    LinkeTurbidityRequest,
    ErbsDecompositionRequest,
    POAIrradianceRequest,
)
from app.services import solar_tools_service

router = APIRouter(prefix="/solar-tools", tags=["Solar Calculation Tools"])


# --- Date / Time ---

@router.post("/julian-day", summary="Julian Day Number")
def get_julian_day(request: JulianDayRequest):
    """Compute the Julian Day Number from a calendar date or ISO string."""
    return solar_tools_service.calc_julian_day(request)


# --- Solar Position ---

@router.post("/solar-position", summary="Solar Position")
def get_solar_position(request: SolarPositionRequest):
    """Compute zenith, elevation, azimuth, declination, hour angle,
    equation of time, and earth-sun distance for a given location
    and timestamp."""
    return solar_tools_service.calc_solar_position(request)


@router.post("/sunrise-sunset", summary="Sunrise / Sunset / Day Length")
def get_sunrise_sunset(request: SunriseSunsetRequest):
    """Calculate sunrise, sunset, solar noon (UTC), and day length.
    Handles polar day and polar night conditions."""
    return solar_tools_service.calc_sunrise_sunset(request)


@router.post("/solar-declination", summary="Solar Declination")
def get_solar_declination(request: SolarDeclinationRequest):
    """Calculate solar declination angle for a given date
    using Spencer's Fourier series."""
    return solar_tools_service.calc_solar_declination(request)


# --- Atmosphere ---

@router.post("/airmass", summary="Optical Air Mass")
def get_airmass(request: AirmassRequest):
    """Calculate relative optical air mass from zenith angle.
    Models: Kasten-Young (default), Kasten, Simple (1/cos)."""
    return solar_tools_service.calc_airmass(request)


@router.post("/dew-point-to-pw", summary="Dew Point → Precipitable Water")
def get_dew_point_to_pw(request: DewPointRequest):
    """Convert dew point temperature (°C) to precipitable water (cm)
    using the Leckner (1978) formula."""
    return solar_tools_service.calc_dew_point_to_pw(request)


@router.post("/station-pressure", summary="Station Pressure from Elevation")
def get_station_pressure(request: StationPressureRequest):
    """Estimate station-level atmospheric pressure from elevation
    and sea-level pressure using the barometric formula."""
    return solar_tools_service.calc_station_pressure(request)


@router.post("/isa-pressure", summary="ISA Standard Atmosphere Pressure")
def get_isa_pressure(request: ISAPressureRequest):
    """Calculate pressure and temperature at elevation using the
    International Standard Atmosphere model (troposphere only)."""
    return solar_tools_service.calc_isa_pressure(request)


@router.post("/linke-turbidity", summary="Linke Turbidity Estimate")
def get_linke_turbidity(request: LinkeTurbidityRequest):
    """Estimate Linke turbidity factor from precipitable water
    and aerosol optical depth at 700 nm."""
    return solar_tools_service.calc_linke_turbidity(request)


# --- Irradiance ---

@router.post("/extraterrestrial", summary="Extraterrestrial Irradiance")
def get_extraterrestrial(request: ExtraterrestrialRequest):
    """Calculate extraterrestrial normal irradiance (ETR) for a given
    date, accounting for Earth-Sun distance variation."""
    return solar_tools_service.calc_extraterrestrial(request)


@router.post("/instant-bird", summary="Instant Bird Clearsky")
def get_instant_bird(request: InstantBirdRequest):
    """Single-point INSTESRE Bird clearsky calculation.
    Returns GHI, DNI, DHI plus solar position for a single instant."""
    return solar_tools_service.calc_instant_bird(request)


@router.post("/erbs-decomposition", summary="Erbs GHI Decomposition")
def get_erbs_decomposition(request: ErbsDecompositionRequest):
    """Decompose measured GHI into DNI and DHI using the Erbs (1982)
    model.  Returns clearness index and diffuse fraction."""
    return solar_tools_service.calc_erbs_decomposition(request)


# --- Geometry ---

@router.post("/angle-of-incidence", summary="Angle of Incidence")
def get_angle_of_incidence(request: AngleOfIncidenceRequest):
    """Calculate the angle of incidence of sunlight on a tilted panel."""
    return solar_tools_service.calc_angle_of_incidence(request)


@router.post("/optimal-tilt", summary="Optimal Panel Tilt Estimate")
def get_optimal_tilt(request: OptimalTiltRequest):
    """Estimate optimal fixed panel tilt angles (annual, summer, winter)
    from latitude using empirical correlations."""
    return solar_tools_service.calc_optimal_tilt(request)


@router.post("/poa-irradiance", summary="POA Irradiance (Isotropic)")
def get_poa_irradiance(request: POAIrradianceRequest):
    """Calculate plane-of-array irradiance on a tilted surface using
    the isotropic sky model (Liu & Jordan)."""
    return solar_tools_service.calc_poa_irradiance(request)
