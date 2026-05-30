# ./backend/app/instesre_bird/bird_calculator.py
"""BIRD Clear Sky Model (Bird & Hulstrom, 1981).

Reference: Bird, R.E. and Hulstrom, R.L. (1981). "A Simplified Clear Sky
Model for Direct and Diffuse Insolation on Horizontal Surfaces".
Technical Report SERI/TR-642-761, Solar Energy Research Institute.
Based on: https://instesre.org/Solar/BirdModelNew.htm
"""

import numpy as np


# ---- Helper functions -------------------------------------------------------

def station_pressure(p_sea_level_mbar: float, elevation_m: float) -> float:
    """Convert sea-level pressure to station pressure (empirical)."""
    H = elevation_m / 1000.0
    return p_sea_level_mbar * np.exp(-0.119 * H - 0.0013 * H * H)


def get_julian_date(month, day, year, hour, minute, second):
    """Compute Julian Date using the Meeus algorithm."""
    m = float(month)
    d = float(day)
    y = float(year)

    if m < 3:
        y -= 1
        m += 12

    A = np.floor(y / 100)
    B = 2 - A + np.floor(A / 4)

    JD = (
        np.floor(365.25 * (y + 4716))
        + np.floor(30.6001 * (m + 1))
        + d + B - 1524.5
    )

    return JD + hour / 24.0 + minute / 1440.0 + second / 86400.0


# ---- Solar position ---------------------------------------------------------

def solar_zenith_angle(jd, lat_deg, lon_deg):
    """Compute solar zenith angle and earth-sun distance from Julian Date."""
    dr = np.pi / 180.0

    T = (jd - 2451545.0) / 36525.0  # Julian century

    # Mean longitude and mean anomaly (Meeus)
    L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T * T
    M = 357.52910 + 35999.05030 * T - 0.0001559 * T * T - 0.00000048 * T**3

    M_rad = M * dr

    # Eccentricity
    e = 0.016708617 - 0.000042037 * T - 0.0000001236 * T * T

    # Equation of center
    C = (
        (1.914600 - 0.004817 * T - 0.000014 * T * T) * np.sin(M_rad)
        + (0.019993 - 0.000101 * T) * np.sin(2 * M_rad)
        + 0.000290 * np.sin(3 * M_rad)
    )

    L_true = (L0 + C) % 360.0  # True longitude
    f = M_rad + C * dr  # True anomaly (radians)

    # Earth-sun distance (AU)
    R = 1.000001018 * (1 - e * e) / (1 + e * np.cos(f))

    # Greenwich mean sidereal time
    Sidereal = (
        280.46061837
        + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * T * T
        - T**3 / 38710000.0
    ) % 360.0

    # Mean obliquity of ecliptic
    Obliq = (
        23.0
        + 26.0 / 60.0
        + 21.448 / 3600.0
        - 46.8150 / 3600.0 * T
        - 0.00059 / 3600.0 * T * T
        + 0.001813 / 3600.0 * T**3
    )

    # Right ascension and declination
    RA = np.arctan2(
        np.sin(L_true * dr) * np.cos(Obliq * dr),
        np.cos(L_true * dr),
    )
    Decl = np.arcsin(np.sin(Obliq * dr) * np.sin(L_true * dr))

    # Hour angle and elevation
    HA = Sidereal + lon_deg - (RA / dr)
    Elev = np.arcsin(
        np.sin(lat_deg * dr) * np.sin(Decl)
        + np.cos(lat_deg * dr) * np.cos(Decl) * np.cos(HA * dr)
    ) / dr

    zenith = 90.0 - Elev
    return zenith, R


# ---- BIRD model -------------------------------------------------------------

def bird_model(
    zenith_deg,
    pressure_mbar,
    ozone_cm,
    water_cm,
    aod500,
    aod380,
    albedo,
    solar_constant=1367.0,
    earth_sun_distance=1.0,
):
    """Compute BIRD clear-sky irradiance components.

    Returns dict with keys: airmass, dni, direct_horizontal, dhi, ghi,
    solar_corrected.
    """
    dr = np.pi / 180.0
    Z = zenith_deg

    # Sun below horizon — return zeros
    if Z >= 90:
        return {
            "airmass": np.nan,
            "dni": 0.0,
            "direct_horizontal": 0.0,
            "dhi": 0.0,
            "ghi": 0.0,
            "solar_corrected": 0.0,
        }

    # Relative air mass — Kasten (1965) formula
    AM = 1.0 / (np.cos(Z * dr) + 0.15 * (93.885 - Z) ** -1.25)

    # Pressure-corrected air mass
    AMp = AM * pressure_mbar / 1013.0

    # Rayleigh scattering transmittance
    Tr = np.exp(-0.0903 * AMp**0.84 * (1 + AMp - AMp**1.01))

    # Ozone absorption transmittance
    Ozm = ozone_cm * AM
    Toz = (
        1.0
        - 0.1611 * Ozm * (1 + 139.48 * Ozm) ** -0.3035
        - 0.002715 * Ozm / (1 + 0.044 * Ozm + 0.0003 * Ozm**2)
    )

    # Mixed gas transmittance
    Tm = np.exp(-0.0127 * AMp**0.26)

    # Water vapour transmittance
    Wm = AM * water_cm
    Tw = 1.0 - 2.4959 * Wm / ((1 + (79.034 * Wm) ** 0.6828) + 6.385 * Wm)

    # Aerosol transmittance (broadband from AOD at 380 & 500 nm)
    Tau = 0.2758 * aod380 + 0.35 * aod500
    Ta = np.exp(-Tau**0.873 * (1 + Tau - Tau**0.7088) * AM**0.9108)

    # Aerosol absorptance and scattering transmittance
    TAA = 1.0 - 0.1 * (1 - AM + AM**1.06) * (1 - Ta)
    TAs = Ta / TAA

    # Sky reflectance (aerosol component)
    Rs = 0.0685 + (1 - 0.84) * (1 - TAs)

    # Earth-sun distance correction factor
    Rsq = 1.0 / (earth_sun_distance**2)

    # Direct normal irradiance (DNI)
    Id = Rsq * solar_constant * 0.9662 * Tr * Toz * Tm * Tw * Ta

    # Direct irradiance on horizontal surface
    Idh = Id * np.cos(Z * dr)

    # Diffuse irradiance (sky component)
    # NOTE: The INSTESRE reference does NOT apply Rsq to the diffuse term.
    # pvlib's Bird implementation does include it. We keep the original
    # formulation here for fidelity to the INSTESRE source.
    Ias = (
        0.79 * solar_constant * np.cos(Z * dr)
        * Toz * Tm * Tw * TAA
    )
    Ias = Ias * (
        0.5 * (1 - Tr) + 0.85 * (1 - TAs)
    ) / (1 - AM + AM**1.02)

    # Global horizontal irradiance (GHI) with ground-sky multiple reflections
    Itot = (Idh + Ias) / (1 - albedo * Rs)

    # Diffuse horizontal irradiance (DHI)
    Idif = Itot - Idh

    # Clamp to zero (floating-point can produce tiny negatives at twilight)
    Itot = max(0.0, float(Itot))
    Idif = max(0.0, float(Idif))
    Idh = max(0.0, float(Idh))
    Id = max(0.0, float(Id))

    return {
        "airmass": AM,
        "dni": Id,
        "direct_horizontal": Idh,
        "dhi": Idif,
        "ghi": Itot,
        "solar_corrected": Rsq * solar_constant,
    }


# ---- Full pipeline ----------------------------------------------------------

def compute_bird_from_datetime(
    solar_constant,
    lat,
    lon,
    elevation,
    year,
    month,
    day,
    hour,
    minute,
    second,
    pressure_sea_level,
    ozone,
    water,
    aod500,
    aod380,
    albedo,
):
    """Run the full BIRD pipeline for a single datetime."""
    jd = get_julian_date(month, day, year, hour, minute, second)
    pressure = station_pressure(pressure_sea_level, elevation)
    zenith, R = solar_zenith_angle(jd, lat, lon)

    result = bird_model(
        solar_constant=solar_constant,
        zenith_deg=zenith,
        pressure_mbar=pressure,
        ozone_cm=ozone,
        water_cm=water,
        aod500=aod500,
        aod380=aod380,
        albedo=albedo,
        earth_sun_distance=R,
    )

    result.update({
        "zenith": zenith,
        "earth_sun_distance": R,
        "pressure": pressure,
        "julian_date": jd,
    })

    return result