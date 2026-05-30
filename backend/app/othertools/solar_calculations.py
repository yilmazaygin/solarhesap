# ./backend/app/othertools/solar_calculations.py
"""Standalone solar calculation utilities.

A collection of pure-function solar calculation tools that work with
scalar inputs (no DataFrames, no API calls).  Each function is a
self-contained calculation unit suitable for single-point or real-time use.

References
----------
- Meeus, J. (1991). *Astronomical Algorithms*. Willmann-Bell.
- Duffie, J. & Beckman, W. (2013). *Solar Engineering of Thermal Processes*.
- Bird, R.E. & Hulstrom, R.L. (1981). SERI/TR-642-761.
- pvlib: https://pvlib-python.readthedocs.io/
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import numpy as np


# ===========================================================================
# 1. Julian Day / Date Conversions
# ===========================================================================

def julian_day(year: int, month: int, day: int,
               hour: int = 0, minute: int = 0, second: int = 0) -> float:
    """Compute the Julian Day Number for a given date/time.

    Uses the algorithm from Meeus (1991) Chapter 7.

    Parameters
    ----------
    year, month, day : int
        Calendar date.
    hour, minute, second : int
        Time of day (UTC).

    Returns
    -------
    float
        Julian Day Number.
    """
    y = float(year)
    m = float(month)
    d = float(day)

    if m < 3:
        y -= 1
        m += 12

    A = math.floor(y / 100)
    B = 2 - A + math.floor(A / 4)

    jd = (
        math.floor(365.25 * (y + 4716))
        + math.floor(30.6001 * (m + 1))
        + d + B - 1524.5
    )

    return jd + hour / 24.0 + minute / 1440.0 + second / 86400.0


def julian_day_from_iso(iso_string: str) -> float:
    """Compute Julian Day from an ISO 8601 datetime string.

    Example: ``"2024-06-15T12:30:00"``
    """
    dt = datetime.fromisoformat(iso_string)
    return julian_day(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)


def day_of_year(year: int, month: int, day: int) -> int:
    """Return the day-of-year (1–366) for a given calendar date."""
    return datetime(year, month, day).timetuple().tm_yday


# ===========================================================================
# 2. Solar Position
# ===========================================================================

def solar_position(latitude: float, longitude: float,
                   year: int, month: int, day: int,
                   hour: int = 12, minute: int = 0, second: int = 0) -> dict[str, float]:
    """Compute solar position for a given location and time.

    Returns zenith angle, elevation, azimuth, declination, hour angle,
    equation of time, and earth-sun distance.

    All angles are in **degrees**.

    Parameters
    ----------
    latitude, longitude : float
        Geographic coordinates (degrees).
    year, month, day, hour, minute, second : int
        Date and time (UTC).

    Returns
    -------
    dict with keys:
        zenith, elevation, azimuth, declination, hour_angle,
        equation_of_time_min, earth_sun_distance_au, julian_day
    """
    dr = math.pi / 180.0

    jd = julian_day(year, month, day, hour, minute, second)
    T = (jd - 2451545.0) / 36525.0  # Julian century

    # Mean longitude & mean anomaly
    L0 = (280.46645 + 36000.76983 * T + 0.0003032 * T * T) % 360.0
    M = (357.52910 + 35999.05030 * T - 0.0001559 * T * T) % 360.0
    M_rad = M * dr

    # Eccentricity
    e = 0.016708617 - 0.000042037 * T

    # Equation of center
    C = (
        (1.914600 - 0.004817 * T) * math.sin(M_rad)
        + (0.019993 - 0.000101 * T) * math.sin(2 * M_rad)
        + 0.000290 * math.sin(3 * M_rad)
    )

    # True longitude & true anomaly
    L_true = (L0 + C) % 360.0
    f = M_rad + C * dr

    # Earth-sun distance (AU)
    R = 1.000001018 * (1 - e * e) / (1 + e * math.cos(f))

    # Obliquity of ecliptic
    obliquity = (
        23.0 + 26.0 / 60.0 + 21.448 / 3600.0
        - 46.8150 / 3600.0 * T
    )

    # Right ascension and declination
    RA = math.atan2(
        math.sin(L_true * dr) * math.cos(obliquity * dr),
        math.cos(L_true * dr),
    )
    declination = math.asin(math.sin(obliquity * dr) * math.sin(L_true * dr))
    decl_deg = declination / dr

    # Greenwich sidereal time
    GMST = (
        280.46061837
        + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * T * T
    ) % 360.0

    # Hour angle
    HA = (GMST + longitude - RA / dr) % 360.0
    if HA > 180:
        HA -= 360.0

    # Elevation and zenith
    sin_elev = (
        math.sin(latitude * dr) * math.sin(declination)
        + math.cos(latitude * dr) * math.cos(declination) * math.cos(HA * dr)
    )
    elevation = math.asin(max(-1.0, min(1.0, sin_elev))) / dr
    zenith = 90.0 - elevation

    # Azimuth (measured clockwise from North)
    cos_az = (
        (math.sin(declination) - math.sin(elevation * dr) * math.sin(latitude * dr))
        / (math.cos(elevation * dr) * math.cos(latitude * dr))
    )
    cos_az = max(-1.0, min(1.0, cos_az))
    azimuth = math.acos(cos_az) / dr
    if HA > 0:
        azimuth = 360.0 - azimuth

    # Equation of time (minutes)
    # Approximate using: EoT ≈ -7.655*sin(f) + 9.873*sin(2L + 3.5932)
    eot = -7.655 * math.sin(M_rad) + 9.873 * math.sin(2 * L0 * dr + 3.5932)

    return {
        "julian_day": round(jd, 6),
        "zenith": round(zenith, 4),
        "elevation": round(elevation, 4),
        "azimuth": round(azimuth, 4),
        "declination": round(decl_deg, 4),
        "hour_angle": round(HA, 4),
        "equation_of_time_min": round(eot, 4),
        "earth_sun_distance_au": round(R, 6),
    }


# ===========================================================================
# 3. Sunrise / Sunset / Day Length
# ===========================================================================

def sunrise_sunset(latitude: float, longitude: float,
                   year: int, month: int, day: int) -> dict[str, Any]:
    """Calculate sunrise, sunset, and day length for a given location and date.

    Uses the solar declination at noon UTC and the standard sunrise
    equation (zenith = 90.833° for atmospheric refraction correction).

    Parameters
    ----------
    latitude, longitude : float
        Geographic coordinates (degrees).
    year, month, day : int
        Calendar date.

    Returns
    -------
    dict with keys:
        sunrise_utc (str HH:MM), sunset_utc (str HH:MM),
        day_length_hours (float), solar_noon_utc (str HH:MM),
        is_polar_day (bool), is_polar_night (bool)
    """
    dr = math.pi / 180.0

    # Day of year
    doy = day_of_year(year, month, day)

    # Solar declination (Spencer formula)
    gamma = 2 * math.pi * (doy - 1) / 365.0
    decl = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )

    # Equation of time (minutes)
    eot = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.04089 * math.sin(2 * gamma)
    )

    # Solar noon (UTC)
    solar_noon_min = 720.0 - 4.0 * longitude - eot  # minutes from midnight UTC

    # Hour angle for sunrise/sunset
    cos_omega = (
        math.cos(90.833 * dr) / (math.cos(latitude * dr) * math.cos(decl))
        - math.tan(latitude * dr) * math.tan(decl)
    )

    if cos_omega > 1.0:
        # Polar night
        return {
            "sunrise_utc": None,
            "sunset_utc": None,
            "day_length_hours": 0.0,
            "solar_noon_utc": _min_to_hhmm(solar_noon_min),
            "is_polar_day": False,
            "is_polar_night": True,
        }
    elif cos_omega < -1.0:
        # Polar day (midnight sun)
        return {
            "sunrise_utc": None,
            "sunset_utc": None,
            "day_length_hours": 24.0,
            "solar_noon_utc": _min_to_hhmm(solar_noon_min),
            "is_polar_day": True,
            "is_polar_night": False,
        }

    omega = math.acos(cos_omega) / dr  # degrees
    sunrise_min = solar_noon_min - 4.0 * omega
    sunset_min = solar_noon_min + 4.0 * omega
    day_length_h = 8.0 * omega / 60.0

    return {
        "sunrise_utc": _min_to_hhmm(sunrise_min),
        "sunset_utc": _min_to_hhmm(sunset_min),
        "day_length_hours": round(day_length_h, 4),
        "solar_noon_utc": _min_to_hhmm(solar_noon_min),
        "is_polar_day": False,
        "is_polar_night": False,
    }


def _min_to_hhmm(minutes: float) -> str:
    """Convert minutes from midnight to HH:MM string."""
    minutes = minutes % 1440
    h = int(minutes // 60)
    m = int(minutes % 60)
    return f"{h:02d}:{m:02d}"


# ===========================================================================
# 4. Air Mass
# ===========================================================================

def airmass(zenith_deg: float, model: str = "kastenyoung") -> dict[str, float]:
    """Calculate relative and absolute optical air mass.

    Parameters
    ----------
    zenith_deg : float
        Solar zenith angle (degrees).
    model : str
        Air mass model. Options: ``'kastenyoung'`` (default, most accurate),
        ``'kasten'``, ``'simple'`` (1/cos).

    Returns
    -------
    dict with keys: airmass_relative, airmass_absolute_1013
    """
    if zenith_deg >= 90:
        return {"airmass_relative": float("inf"), "airmass_absolute_1013": float("inf")}

    z_rad = math.radians(zenith_deg)

    if model == "simple":
        am = 1.0 / math.cos(z_rad)
    elif model == "kasten":
        am = 1.0 / (math.cos(z_rad) + 0.15 * (93.885 - zenith_deg) ** -1.25)
    elif model == "kastenyoung":
        am = 1.0 / (
            math.cos(z_rad)
            + 0.50572 * (96.07995 - zenith_deg) ** -1.6364
        )
    else:
        raise ValueError(f"Unknown airmass model: {model}")

    return {
        "airmass_relative": round(am, 6),
        "airmass_absolute_1013": round(am * 1013.0 / 1013.25, 6),
    }


# ===========================================================================
# 5. Extraterrestrial Radiation
# ===========================================================================

def extraterrestrial_irradiance(year: int, month: int, day: int,
                                 solar_constant: float = 1367.0) -> dict[str, float]:
    """Calculate extraterrestrial normal irradiance (ETR) for a given date.

    Uses the earth-sun distance correction.

    Returns
    -------
    dict with keys: etr_w_m2, earth_sun_distance_au, day_of_year
    """
    doy = day_of_year(year, month, day)
    # Spencer's formula for earth-sun distance factor
    gamma = 2 * math.pi * (doy - 1) / 365.0
    e0 = (
        1.000110
        + 0.034221 * math.cos(gamma)
        + 0.001280 * math.sin(gamma)
        + 0.000719 * math.cos(2 * gamma)
        + 0.000077 * math.sin(2 * gamma)
    )

    R_AU = 1.0 / math.sqrt(e0)

    return {
        "etr_w_m2": round(solar_constant * e0, 4),
        "earth_sun_distance_au": round(R_AU, 6),
        "day_of_year": doy,
    }


# ===========================================================================
# 6. Atmospheric Conversions
# ===========================================================================

def dew_point_to_precipitable_water(dew_point_c: float) -> dict[str, float]:
    """Convert dew point temperature to precipitable water (cm).

    Uses the Leckner (1978) empirical formula.

    Parameters
    ----------
    dew_point_c : float
        Dew point temperature (°C).

    Returns
    -------
    dict with keys: precipitable_water_cm, dew_point_c
    """
    pw = math.exp(0.07 * dew_point_c - 0.075)
    return {
        "precipitable_water_cm": round(pw, 6),
        "dew_point_c": dew_point_c,
    }


def station_pressure_from_elevation(elevation_m: float,
                                     sea_level_pressure_hpa: float = 1013.25) -> dict[str, float]:
    """Estimate station-level atmospheric pressure from elevation.

    Uses the barometric formula with temperature lapse rate.

    Parameters
    ----------
    elevation_m : float
        Station elevation (metres above sea level).
    sea_level_pressure_hpa : float
        Sea-level pressure (hPa / mbar).

    Returns
    -------
    dict with keys: station_pressure_hpa, elevation_m,
                    sea_level_pressure_hpa
    """
    H = elevation_m / 1000.0
    p = sea_level_pressure_hpa * math.exp(-0.119 * H - 0.0013 * H * H)
    return {
        "station_pressure_hpa": round(p, 4),
        "elevation_m": elevation_m,
        "sea_level_pressure_hpa": sea_level_pressure_hpa,
    }


def altitude_pressure_isa(elevation_m: float) -> dict[str, float]:
    """ISA (International Standard Atmosphere) pressure at elevation.

    Uses the barometric formula for the troposphere (< 11 km).
    """
    T0 = 288.15   # K
    P0 = 1013.25   # hPa
    g = 9.80665    # m/s²
    M = 0.0289644  # kg/mol
    R = 8.31447    # J/(mol·K)
    L = 0.0065     # K/m (lapse rate)

    if elevation_m < 0:
        elevation_m = 0

    T = T0 - L * elevation_m
    p = P0 * (T / T0) ** (g * M / (R * L))

    return {
        "pressure_hpa": round(p, 4),
        "temperature_k": round(T, 2),
        "elevation_m": elevation_m,
    }


# ===========================================================================
# 7. Angle of Incidence
# ===========================================================================

def angle_of_incidence(
    surface_tilt: float,
    surface_azimuth: float,
    solar_zenith: float,
    solar_azimuth: float,
) -> dict[str, float]:
    """Calculate the angle of incidence of sunlight on a tilted surface.

    All angles in **degrees**.

    Parameters
    ----------
    surface_tilt : float
        Panel tilt from horizontal (0 = horizontal, 90 = vertical).
    surface_azimuth : float
        Panel azimuth (0 = N, 90 = E, 180 = S, 270 = W).
    solar_zenith : float
        Solar zenith angle.
    solar_azimuth : float
        Solar azimuth angle.

    Returns
    -------
    dict with keys: aoi_deg, cos_aoi
    """
    dr = math.pi / 180.0
    cos_aoi = (
        math.sin(solar_zenith * dr) * math.sin(surface_tilt * dr)
        * math.cos((solar_azimuth - surface_azimuth) * dr)
        + math.cos(solar_zenith * dr) * math.cos(surface_tilt * dr)
    )
    cos_aoi = max(-1.0, min(1.0, cos_aoi))
    aoi = math.acos(cos_aoi) / dr

    return {
        "aoi_deg": round(aoi, 4),
        "cos_aoi": round(cos_aoi, 6),
    }


# ===========================================================================
# 8. Optimal Tilt Estimate
# ===========================================================================

def optimal_tilt_estimate(latitude: float) -> dict[str, float]:
    """Estimate optimal fixed panel tilt angle for annual energy.

    Uses common rule-of-thumb correlations.

    Returns
    -------
    dict with keys:
        tilt_annual (year-round optimal),
        tilt_summer (Apr-Sep), tilt_winter (Oct-Mar)
    """
    abs_lat = abs(latitude)
    # Common empirical rules
    annual = abs_lat * 0.76 + 3.1  # Jacobson correlation
    summer = max(0, abs_lat - 15)
    winter = min(90, abs_lat + 15)

    return {
        "tilt_annual_deg": round(annual, 2),
        "tilt_summer_deg": round(summer, 2),
        "tilt_winter_deg": round(winter, 2),
        "latitude": latitude,
        "hemisphere": "north" if latitude >= 0 else "south",
        "optimal_azimuth_deg": 180.0 if latitude >= 0 else 0.0,
    }


# ===========================================================================
# 9. Instant BIRD clearsky (wrapper)
# ===========================================================================

def instant_bird_clearsky(
    latitude: float,
    longitude: float,
    elevation: float,
    year: int, month: int, day: int,
    hour: int = 12, minute: int = 0, second: int = 0,
    pressure_sea_level: float = 1013.25,
    ozone: float = 0.3,
    precipitable_water: float = 1.42,
    aod500: float = 0.1,
    aod380: float = 0.15,
    albedo: float = 0.2,
    solar_constant: float = 1367.0,
) -> dict[str, Any]:
    """Single-point INSTESRE Bird clearsky calculation (no DataFrame).

    Computes GHI, DNI, DHI plus solar position for a single instant.
    All atmospheric parameters can be manually specified.

    Returns
    -------
    dict with keys:
        ghi, dni, dhi, direct_horizontal, zenith, elevation, azimuth,
        airmass, earth_sun_distance, julian_day, station_pressure
    """
    from app.instesre_bird.bird_calculator import (
        bird_model,
        station_pressure as calc_station_pressure,
    )

    jd = julian_day(year, month, day, hour, minute, second)

    # Solar position
    pos = solar_position(latitude, longitude, year, month, day, hour, minute, second)

    # Station pressure
    pressure = calc_station_pressure(pressure_sea_level, elevation)

    # Earth-sun distance from solar position
    R = pos["earth_sun_distance_au"]

    # Run Bird model
    result = bird_model(
        zenith_deg=pos["zenith"],
        pressure_mbar=pressure,
        ozone_cm=ozone,
        water_cm=precipitable_water,
        aod500=aod500,
        aod380=aod380,
        albedo=albedo,
        solar_constant=solar_constant,
        earth_sun_distance=R,
    )

    return {
        "ghi": round(float(result["ghi"]), 4),
        "dni": round(float(result["dni"]), 4),
        "dhi": round(float(result["dhi"]), 4),
        "direct_horizontal": round(float(result["direct_horizontal"]), 4),
        "zenith": pos["zenith"],
        "elevation": pos["elevation"],
        "azimuth": pos["azimuth"],
        "declination": pos["declination"],
        "airmass": round(float(result["airmass"]), 6) if not math.isnan(result["airmass"]) else None,
        "earth_sun_distance_au": pos["earth_sun_distance_au"],
        "julian_day": pos["julian_day"],
        "station_pressure_hpa": round(pressure, 4),
    }


# ===========================================================================
# 10. Solar declination (standalone)
# ===========================================================================

def solar_declination(year: int, month: int, day: int) -> dict[str, float]:
    """Calculate solar declination for a given date.

    Uses Spencer's (1971) Fourier series.

    Returns
    -------
    dict with keys: declination_deg, day_of_year
    """
    doy = day_of_year(year, month, day)
    gamma = 2 * math.pi * (doy - 1) / 365.0
    decl_rad = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )
    return {
        "declination_deg": round(math.degrees(decl_rad), 4),
        "day_of_year": doy,
    }


# ===========================================================================
# 11. Linke Turbidity Estimate
# ===========================================================================

def linke_turbidity_estimate(
    elevation_m: float,
    precipitable_water_cm: float = 1.4,
    aod700: float = 0.1,
) -> dict[str, float]:
    """Estimate Linke turbidity factor from atmospheric parameters.

    Approximation from Ineichen & Perez (2002):
    ``TL ≈ 3.91 * exp(0.689 * aod700) * tau_w + 0.376 * ln(pw) + 2``

    This is a simplified estimate — the pvlib ``lookup_linke_turbidity``
    provides climatological values for a given location and time.

    Returns
    -------
    dict with keys: linke_turbidity, precipitable_water_cm, aod700
    """
    # Simplified Ineichen approximation
    TL = 3.91 * math.exp(0.689 * aod700) + 0.376 * math.log(max(0.01, precipitable_water_cm)) + 2
    return {
        "linke_turbidity": round(TL, 4),
        "precipitable_water_cm": precipitable_water_cm,
        "aod700": aod700,
    }


# ===========================================================================
# 12. Irradiance Decomposition (Erbs model)
# ===========================================================================

def erbs_decomposition(ghi: float, zenith_deg: float,
                        day_of_year_val: int,
                        solar_constant: float = 1367.0) -> dict[str, float]:
    """Decompose GHI into DNI and DHI using the Erbs (1982) model.

    Estimates the diffuse fraction from the clearness index (kt).

    Parameters
    ----------
    ghi : float
        Global horizontal irradiance (W/m²).
    zenith_deg : float
        Solar zenith angle (degrees).
    day_of_year_val : int
        Day of year (1–366).
    solar_constant : float
        Solar constant (W/m²).

    Returns
    -------
    dict with keys: ghi, dni, dhi, clearness_index, diffuse_fraction
    """
    if zenith_deg >= 87 or ghi <= 0:
        return {
            "ghi": ghi,
            "dni": 0.0,
            "dhi": ghi if ghi > 0 else 0.0,
            "clearness_index": 0.0,
            "diffuse_fraction": 1.0,
        }

    z_rad = math.radians(zenith_deg)
    cos_z = math.cos(z_rad)

    # Extraterrestrial horizontal irradiance
    gamma = 2 * math.pi * (day_of_year_val - 1) / 365.0
    e0 = (
        1.000110 + 0.034221 * math.cos(gamma)
        + 0.001280 * math.sin(gamma) + 0.000719 * math.cos(2 * gamma)
        + 0.000077 * math.sin(2 * gamma)
    )
    etr_h = solar_constant * e0 * cos_z

    if etr_h <= 0:
        return {"ghi": ghi, "dni": 0.0, "dhi": ghi, "clearness_index": 0.0, "diffuse_fraction": 1.0}

    # Clearness index
    kt = min(ghi / etr_h, 1.0)

    # Erbs correlation for diffuse fraction
    if kt <= 0.22:
        kd = 1.0 - 0.09 * kt
    elif kt <= 0.80:
        kd = 0.9511 - 0.1604 * kt + 4.388 * kt**2 - 16.638 * kt**3 + 12.336 * kt**4
    else:
        kd = 0.165

    dhi = max(0, kd * ghi)
    dni = max(0, (ghi - dhi) / cos_z) if cos_z > 0.05 else 0.0

    return {
        "ghi": round(ghi, 4),
        "dni": round(dni, 4),
        "dhi": round(dhi, 4),
        "clearness_index": round(kt, 6),
        "diffuse_fraction": round(kd, 6),
    }


# ===========================================================================
# 13. POA Irradiance (Isotropic)
# ===========================================================================

def poa_irradiance_isotropic(
    ghi: float,
    dni: float,
    dhi: float,
    surface_tilt: float,
    surface_azimuth: float,
    solar_zenith: float,
    solar_azimuth: float,
    albedo: float = 0.2,
) -> dict[str, float]:
    """Calculate plane-of-array irradiance using the isotropic sky model.

    Parameters
    ----------
    ghi, dni, dhi : float
        Global, direct normal, and diffuse horizontal irradiance (W/m²).
    surface_tilt : float
        Panel tilt (degrees from horizontal).
    surface_azimuth : float
        Panel azimuth (degrees, 0=N, 180=S).
    solar_zenith, solar_azimuth : float
        Solar position (degrees).
    albedo : float
        Ground surface albedo.

    Returns
    -------
    dict with keys: poa_global, poa_direct, poa_diffuse, poa_ground_diffuse
    """
    dr = math.pi / 180.0

    # Angle of incidence
    cos_aoi = (
        math.sin(solar_zenith * dr) * math.sin(surface_tilt * dr)
        * math.cos((solar_azimuth - surface_azimuth) * dr)
        + math.cos(solar_zenith * dr) * math.cos(surface_tilt * dr)
    )
    cos_aoi = max(0.0, cos_aoi)  # No negative beam contribution

    # Beam component
    poa_direct = dni * cos_aoi

    # Isotropic diffuse (Liu & Jordan)
    poa_diffuse = dhi * (1 + math.cos(surface_tilt * dr)) / 2

    # Ground-reflected
    poa_ground = ghi * albedo * (1 - math.cos(surface_tilt * dr)) / 2

    poa_global = poa_direct + poa_diffuse + poa_ground

    return {
        "poa_global": round(poa_global, 4),
        "poa_direct": round(poa_direct, 4),
        "poa_diffuse": round(poa_diffuse, 4),
        "poa_ground_diffuse": round(poa_ground, 4),
    }
