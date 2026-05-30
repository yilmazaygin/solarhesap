# ./backend/app/services/solar_tools_service.py
"""Service layer for solar calculation tools.

Each function maps a validated Pydantic request to the corresponding
calculation in ``app.othertools.solar_calculations`` and returns the result.
"""

from __future__ import annotations

from typing import Any

from app.core.logger import alogger
from app.othertools.solar_calculations import (
    julian_day,
    julian_day_from_iso,
    day_of_year,
    solar_position,
    sunrise_sunset,
    airmass,
    extraterrestrial_irradiance,
    dew_point_to_precipitable_water,
    station_pressure_from_elevation,
    altitude_pressure_isa,
    angle_of_incidence,
    optimal_tilt_estimate,
    instant_bird_clearsky,
    solar_declination,
    linke_turbidity_estimate,
    erbs_decomposition,
    poa_irradiance_isotropic,
)
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


def calc_julian_day(request: JulianDayRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: julian_day")
    if request.iso_string:
        jd = julian_day_from_iso(request.iso_string)
        return {"julian_day": jd, "input": request.iso_string}
    if request.year is None or request.month is None or request.day is None:
        raise ValueError("Provide either iso_string or year/month/day")
    jd = julian_day(request.year, request.month, request.day,
                    request.hour, request.minute, request.second)
    doy = day_of_year(request.year, request.month, request.day)
    return {"julian_day": jd, "day_of_year": doy}


def calc_solar_position(request: SolarPositionRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: solar_position (%.4f, %.4f)", request.latitude, request.longitude)
    return solar_position(
        request.latitude, request.longitude,
        request.year, request.month, request.day,
        request.hour, request.minute, request.second,
    )


def calc_sunrise_sunset(request: SunriseSunsetRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: sunrise_sunset (%.4f, %.4f)", request.latitude, request.longitude)
    return sunrise_sunset(
        request.latitude, request.longitude,
        request.year, request.month, request.day,
    )


def calc_airmass(request: AirmassRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: airmass (zenith=%.2f, model=%s)", request.zenith_deg, request.model)
    return airmass(request.zenith_deg, request.model)


def calc_extraterrestrial(request: ExtraterrestrialRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: extraterrestrial_irradiance")
    return extraterrestrial_irradiance(
        request.year, request.month, request.day, request.solar_constant,
    )


def calc_dew_point_to_pw(request: DewPointRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: dew_point_to_precipitable_water (%.2f°C)", request.dew_point_c)
    return dew_point_to_precipitable_water(request.dew_point_c)


def calc_station_pressure(request: StationPressureRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: station_pressure (elev=%.1fm)", request.elevation_m)
    return station_pressure_from_elevation(request.elevation_m, request.sea_level_pressure_hpa)


def calc_isa_pressure(request: ISAPressureRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: ISA pressure (elev=%.1fm)", request.elevation_m)
    return altitude_pressure_isa(request.elevation_m)


def calc_angle_of_incidence(request: AngleOfIncidenceRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: angle_of_incidence")
    return angle_of_incidence(
        request.surface_tilt, request.surface_azimuth,
        request.solar_zenith, request.solar_azimuth,
    )


def calc_optimal_tilt(request: OptimalTiltRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: optimal_tilt (lat=%.4f)", request.latitude)
    return optimal_tilt_estimate(request.latitude)


def calc_instant_bird(request: InstantBirdRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: instant_bird_clearsky (%.4f, %.4f)", request.latitude, request.longitude)
    return instant_bird_clearsky(
        latitude=request.latitude, longitude=request.longitude,
        elevation=request.elevation,
        year=request.year, month=request.month, day=request.day,
        hour=request.hour, minute=request.minute, second=request.second,
        pressure_sea_level=request.pressure_sea_level,
        ozone=request.ozone, precipitable_water=request.precipitable_water,
        aod500=request.aod500, aod380=request.aod380,
        albedo=request.albedo, solar_constant=request.solar_constant,
    )


def calc_solar_declination(request: SolarDeclinationRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: solar_declination")
    return solar_declination(request.year, request.month, request.day)


def calc_linke_turbidity(request: LinkeTurbidityRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: linke_turbidity_estimate")
    return linke_turbidity_estimate(
        request.elevation_m, request.precipitable_water_cm, request.aod700,
    )


def calc_erbs_decomposition(request: ErbsDecompositionRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: erbs_decomposition (GHI=%.1f)", request.ghi)
    return erbs_decomposition(
        request.ghi, request.zenith_deg, request.day_of_year, request.solar_constant,
    )


def calc_poa_irradiance(request: POAIrradianceRequest) -> dict[str, Any]:
    alogger.debug("Solar tool: poa_irradiance_isotropic")
    return poa_irradiance_isotropic(
        request.ghi, request.dni, request.dhi,
        request.surface_tilt, request.surface_azimuth,
        request.solar_zenith, request.solar_azimuth,
        request.albedo,
    )
