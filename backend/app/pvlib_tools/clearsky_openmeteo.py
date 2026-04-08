# ./backend/app/pvlib_tools/clearsky_openmeteo.py
"""pvlib clear-sky models enriched with Open-Meteo atmospheric data.

Provides functions to compute clear-sky irradiance using pvlib's Ineichen,
Simplified Solis, and Bird models, with real atmospheric parameters
(surface pressure, precipitable water, air temperature, wind speed) fetched
from the Open-Meteo Historical Weather API.

Each function returns a DataFrame that can optionally be formatted for
direct use with ``pvlib.modelchain.ModelChain.run_model()``.

Using real surface pressure (instead of altitude-based estimates) and
real dew-point-derived precipitable water yields more accurate results
than pvlib's default climatological assumptions.
"""

import numpy as np
import pandas as pd
from datetime import date

from pvlib.location import Location
from pvlib import clearsky, atmosphere, irradiance

from app.outer_apis.openmeteo.fetch_openmeteo import fetch_open_meteo
from app.schemas.openmeteo_schemas import OpenMeteoRequestSchema
from app.core.logger import alogger


# ===========================================================================
# Shared helpers
# ===========================================================================

def _dew_point_to_precipitable_water(dew_point_celsius):
    """Convert dew-point temperature (°C) to precipitable water (cm).

    Uses the Bird & Hulstrom (1981) empirical formula:
        w = exp(0.07 * Td - 0.075)
    """
    return np.exp(0.07 * dew_point_celsius - 0.075)


def _ensure_date(value):
    """Coerce str or date to date."""
    if isinstance(value, str):
        return date.fromisoformat(value)
    return value


def _fetch_openmeteo_atmospheric(lat, lon, start_date, end_date, timezone="UTC"):
    """Fetch atmospheric data from Open-Meteo in a single API call.

    Returns
    -------
    pd.DataFrame
        Hourly DataFrame with columns: surface_pressure (hPa),
        dew_point_2m (°C), temperature_2m (°C), wind_speed_10m (m/s).
    """
    request = OpenMeteoRequestSchema(
        latitude=lat,
        longitude=lon,
        start_date=start_date,
        end_date=end_date,
        hourly=["surface_pressure", "dew_point_2m", "temperature_2m", "wind_speed_10m"],
        timezone=timezone,
        wind_speed_unit="ms",  # pvlib expects m/s
    )

    alogger.info(
        "Fetching Open-Meteo atmospheric data: (%.4f, %.4f) %s → %s",
        lat, lon, start_date, end_date,
    )

    result = fetch_open_meteo(request)
    hourly_df = result["hourly_dataframe"]

    if hourly_df is None or hourly_df.empty:
        raise RuntimeError(
            f"Open-Meteo returned no hourly data for ({lat}, {lon}) "
            f"from {start_date} to {end_date}"
        )

    alogger.info("Open-Meteo atmospheric data retrieved — shape: %s", hourly_df.shape)
    return hourly_df


def _interpolate_to_target(hourly_df, target_index):
    """Interpolate hourly Open-Meteo data to an arbitrary target index.

    Uses linear time-based interpolation with forward/backward fill at edges.
    """
    return (
        hourly_df
        .reindex(hourly_df.index.union(target_index))
        .interpolate(method="time")
        .ffill()
        .bfill()
        .reindex(target_index)
    )


def _build_target_index(start_date, end_date, freq_minutes):
    """Build a DatetimeIndex from start to end at the given frequency."""
    return pd.date_range(
        start=pd.Timestamp(start_date),
        end=pd.Timestamp(end_date) + pd.Timedelta(hours=23),
        freq=f"{freq_minutes}min",
    )


def _to_pvlib_weather(df):
    """Convert a clearsky output DataFrame to pvlib ModelChain weather format.

    Returns a DataFrame with DatetimeIndex and columns:
    ghi, dni, dhi, temp_air, wind_speed.
    """
    cols = ["datetime", "ghi", "dni", "dhi"]
    rename_map = {}

    if "temp_air" in df.columns:
        cols.append("temp_air")
    if "wind_speed" in df.columns:
        cols.append("wind_speed")

    weather = df[cols].copy()
    weather = weather.set_index("datetime")
    weather.index = pd.DatetimeIndex(weather.index)
    weather.index.name = None

    alogger.debug(
        "Converted clearsky DataFrame to pvlib weather — shape: %s, columns: %s",
        weather.shape, list(weather.columns),
    )
    return weather


# ===========================================================================
# Ineichen / Perez Clear Sky Model
# ===========================================================================

def create_ineichen_df(
    lat: float,
    lon: float,
    elevation: float,
    start_date: date | str,
    end_date: date | str,
    freq_minutes: int = 60,
    timezone: str = "UTC",
    pvlib_format: bool = False,
) -> pd.DataFrame:
    """Compute Ineichen/Perez clear-sky irradiance with Open-Meteo atmospheric data.

    Uses pvlib's ``clearsky.ineichen`` with:
    - **Linke turbidity** from pvlib's built-in SoDa climatological database
      (monthly, interpolated to the target dates).
    - **Absolute airmass** computed with real ``surface_pressure`` from
      Open-Meteo (more accurate than altitude-based pressure estimate).
    - **Solar position** from pvlib's ``Location.get_solarposition()``.

    Parameters
    ----------
    lat, lon : float
        Coordinates in decimal degrees.
    elevation : float
        Site elevation in metres above sea level.
    start_date, end_date : date or str
        Date range (inclusive).
    freq_minutes : int, optional
        Time step in minutes (default 60).
    timezone : str, optional
        Timezone for timestamps (default ``"UTC"``).
    pvlib_format : bool, optional
        If True, return pvlib ModelChain–compatible DataFrame.

    Returns
    -------
    pd.DataFrame
        Clear-sky irradiance with diagnostic columns, or pvlib weather format.
    """
    start_date, end_date = _ensure_date(start_date), _ensure_date(end_date)

    # --- Fetch atmospheric data -----------------------------------------------
    hourly_df = _fetch_openmeteo_atmospheric(lat, lon, start_date, end_date, timezone)
    target_index = _build_target_index(start_date, end_date, freq_minutes)
    meteo = _interpolate_to_target(hourly_df, target_index)

    # --- Solar position -------------------------------------------------------
    location = Location(lat, lon, altitude=elevation)
    solpos = location.get_solarposition(target_index)

    # --- Airmass with real surface pressure -----------------------------------
    pressure_pa = meteo["surface_pressure"].values * 100.0  # hPa → Pa
    airmass_rel = atmosphere.get_relative_airmass(solpos["apparent_zenith"])
    airmass_abs = atmosphere.get_absolute_airmass(airmass_rel, pressure_pa)

    # --- Linke turbidity (climatological, monthly interpolated) ----------------
    linke = clearsky.lookup_linke_turbidity(target_index, lat, lon)

    # --- Extra-terrestrial irradiance -----------------------------------------
    dni_extra = irradiance.get_extra_radiation(target_index)

    # --- Ineichen model -------------------------------------------------------
    alogger.info("Running Ineichen/Perez clearsky model")
    cs = clearsky.ineichen(
        solpos["apparent_zenith"],
        airmass_abs,
        linke,
        altitude=elevation,
        dni_extra=dni_extra,
    )

    # --- Build output ---------------------------------------------------------
    df = pd.DataFrame({
        "datetime": target_index,
        "ghi": cs["ghi"].values,
        "dni": cs["dni"].values,
        "dhi": cs["dhi"].values,
        "temp_air": meteo["temperature_2m"].values,
        "wind_speed": meteo["wind_speed_10m"].values,
        "apparent_zenith": solpos["apparent_zenith"].values,
        "airmass_absolute": airmass_abs.values if hasattr(airmass_abs, 'values') else airmass_abs,
        "linke_turbidity": linke.values if hasattr(linke, 'values') else linke,
        "surface_pressure_hpa": meteo["surface_pressure"].values,
        "dni_extra": dni_extra.values if hasattr(dni_extra, 'values') else dni_extra,
    })

    alogger.info(
        "Ineichen clearsky complete: %d rows, %s → %s",
        len(df), df["datetime"].iloc[0], df["datetime"].iloc[-1],
    )

    if pvlib_format:
        return _to_pvlib_weather(df)
    return df


# ===========================================================================
# Simplified Solis Clear Sky Model
# ===========================================================================

def create_simplified_solis_df(
    lat: float,
    lon: float,
    elevation: float,
    start_date: date | str,
    end_date: date | str,
    freq_minutes: int = 60,
    aod700: float = 0.1,
    timezone: str = "UTC",
    pvlib_format: bool = False,
) -> pd.DataFrame:
    """Compute Simplified Solis clear-sky irradiance with Open-Meteo data.

    Uses pvlib's ``clearsky.simplified_solis`` with:
    - **Precipitable water** derived from Open-Meteo ``dew_point_2m``
      via the Bird & Hulstrom (1981) formula.
    - **Pressure** from Open-Meteo ``surface_pressure`` (converted to Pa).
    - **Solar position** from pvlib's ``Location.get_solarposition()``.

    Parameters
    ----------
    lat, lon : float
        Coordinates in decimal degrees.
    elevation : float
        Site elevation in metres above sea level.
    start_date, end_date : date or str
        Date range (inclusive).
    freq_minutes : int, optional
        Time step in minutes (default 60).
    aod700 : float, optional
        Aerosol optical depth at 700 nm (default 0.1).
        Not available from Open-Meteo. Valid range: 0–0.45.
    timezone : str, optional
        Timezone for timestamps (default ``"UTC"``).
    pvlib_format : bool, optional
        If True, return pvlib ModelChain–compatible DataFrame.

    Returns
    -------
    pd.DataFrame
        Clear-sky irradiance with diagnostic columns, or pvlib weather format.
    """
    start_date, end_date = _ensure_date(start_date), _ensure_date(end_date)

    # --- Fetch atmospheric data -----------------------------------------------
    hourly_df = _fetch_openmeteo_atmospheric(lat, lon, start_date, end_date, timezone)
    target_index = _build_target_index(start_date, end_date, freq_minutes)
    meteo = _interpolate_to_target(hourly_df, target_index)

    # --- Solar position -------------------------------------------------------
    location = Location(lat, lon, altitude=elevation)
    solpos = location.get_solarposition(target_index)

    # --- Derived atmospheric parameters ---------------------------------------
    pressure_pa = meteo["surface_pressure"].values * 100.0  # hPa → Pa
    precipitable_water = _dew_point_to_precipitable_water(meteo["dew_point_2m"].values)
    apparent_elevation = 90.0 - solpos["apparent_zenith"].values

    # --- Extra-terrestrial irradiance -----------------------------------------
    dni_extra = irradiance.get_extra_radiation(target_index)

    # --- Simplified Solis model -----------------------------------------------
    alogger.info("Running Simplified Solis clearsky model (aod700=%.3f)", aod700)
    cs = clearsky.simplified_solis(
        apparent_elevation,
        aod700=aod700,
        precipitable_water=precipitable_water,
        pressure=pressure_pa,
        dni_extra=dni_extra,
    )

    # --- Build output ---------------------------------------------------------
    # simplified_solis returns OrderedDict when input is ndarray
    ghi = cs["ghi"] if isinstance(cs, dict) else cs["ghi"].values
    dni = cs["dni"] if isinstance(cs, dict) else cs["dni"].values
    dhi = cs["dhi"] if isinstance(cs, dict) else cs["dhi"].values

    df = pd.DataFrame({
        "datetime": target_index,
        "ghi": ghi,
        "dni": dni,
        "dhi": dhi,
        "temp_air": meteo["temperature_2m"].values,
        "wind_speed": meteo["wind_speed_10m"].values,
        "apparent_zenith": solpos["apparent_zenith"].values,
        "precipitable_water_cm": precipitable_water,
        "surface_pressure_hpa": meteo["surface_pressure"].values,
        "dew_point_2m": meteo["dew_point_2m"].values,
        "aod700": aod700,
    })

    alogger.info(
        "Simplified Solis clearsky complete: %d rows, %s → %s",
        len(df), df["datetime"].iloc[0], df["datetime"].iloc[-1],
    )

    if pvlib_format:
        return _to_pvlib_weather(df)
    return df


# ===========================================================================
# pvlib Bird Clear Sky Model
# ===========================================================================

def create_pvlib_bird_df(
    lat: float,
    lon: float,
    elevation: float,
    start_date: date | str,
    end_date: date | str,
    freq_minutes: int = 60,
    ozone: float = 0.3,
    aod500: float = 0.1,
    aod380: float = 0.15,
    albedo: float = 0.2,
    asymmetry: float = 0.85,
    timezone: str = "UTC",
    pvlib_format: bool = False,
) -> pd.DataFrame:
    """Compute pvlib Bird clear-sky irradiance with Open-Meteo atmospheric data.

    Uses pvlib's ``clearsky.bird`` with:
    - **Precipitable water** derived from Open-Meteo ``dew_point_2m``.
    - **Pressure** from Open-Meteo ``surface_pressure`` (converted to Pa).
    - **Relative airmass** computed from apparent zenith angle.
    - **Solar position** from pvlib's ``Location.get_solarposition()``.

    This is pvlib's own implementation of the same Bird & Hulstrom (1981)
    model used in the INSTESRE version (``instesre_bird``), with the addition
    of the ``asymmetry`` parameter and pvlib's solar position calculation.

    Parameters
    ----------
    lat, lon : float
        Coordinates in decimal degrees.
    elevation : float
        Site elevation in metres above sea level.
    start_date, end_date : date or str
        Date range (inclusive).
    freq_minutes : int, optional
        Time step in minutes (default 60).
    ozone : float, optional
        Atmospheric ozone column in atm-cm (default 0.3).
    aod500 : float, optional
        Aerosol optical depth at 500 nm (default 0.1).
    aod380 : float, optional
        Aerosol optical depth at 380 nm (default 0.15).
    albedo : float, optional
        Surface albedo (default 0.2).
    asymmetry : float, optional
        Aerosol asymmetry factor (default 0.85). Not present in INSTESRE impl.
    timezone : str, optional
        Timezone for timestamps (default ``"UTC"``).
    pvlib_format : bool, optional
        If True, return pvlib ModelChain–compatible DataFrame.

    Returns
    -------
    pd.DataFrame
        Clear-sky irradiance with diagnostic columns, or pvlib weather format.
    """
    start_date, end_date = _ensure_date(start_date), _ensure_date(end_date)

    # --- Fetch atmospheric data -----------------------------------------------
    hourly_df = _fetch_openmeteo_atmospheric(lat, lon, start_date, end_date, timezone)
    target_index = _build_target_index(start_date, end_date, freq_minutes)
    meteo = _interpolate_to_target(hourly_df, target_index)

    # --- Solar position -------------------------------------------------------
    location = Location(lat, lon, altitude=elevation)
    solpos = location.get_solarposition(target_index)

    # --- Derived atmospheric parameters ---------------------------------------
    pressure_pa = meteo["surface_pressure"].values * 100.0  # hPa → Pa
    precipitable_water = _dew_point_to_precipitable_water(meteo["dew_point_2m"].values)
    airmass_rel = atmosphere.get_relative_airmass(solpos["apparent_zenith"])

    # --- Extra-terrestrial irradiance -----------------------------------------
    dni_extra = irradiance.get_extra_radiation(target_index)

    # --- pvlib Bird model -----------------------------------------------------
    # pvlib.clearsky.bird uses solar zenith (not apparent), see pvlib docs.
    alogger.info(
        "Running pvlib Bird clearsky model (ozone=%.2f, aod380=%.3f, aod500=%.3f, albedo=%.2f, asymmetry=%.2f)",
        ozone, aod380, aod500, albedo, asymmetry,
    )
    cs = clearsky.bird(
        zenith=solpos["zenith"],
        airmass_relative=airmass_rel,
        aod380=aod380,
        aod500=aod500,
        precipitable_water=precipitable_water,
        ozone=ozone,
        pressure=pressure_pa,
        dni_extra=dni_extra,
        asymmetry=asymmetry,
        albedo=albedo,
    )

    # --- Build output ---------------------------------------------------------
    ghi = cs["ghi"] if isinstance(cs, dict) else cs["ghi"].values
    dni = cs["dni"] if isinstance(cs, dict) else cs["dni"].values
    dhi = cs["dhi"] if isinstance(cs, dict) else cs["dhi"].values

    df = pd.DataFrame({
        "datetime": target_index,
        "ghi": ghi,
        "dni": dni,
        "dhi": dhi,
        "temp_air": meteo["temperature_2m"].values,
        "wind_speed": meteo["wind_speed_10m"].values,
        "zenith": solpos["zenith"].values,
        "apparent_zenith": solpos["apparent_zenith"].values,
        "airmass_relative": airmass_rel.values if hasattr(airmass_rel, 'values') else airmass_rel,
        "precipitable_water_cm": precipitable_water,
        "surface_pressure_hpa": meteo["surface_pressure"].values,
        "dew_point_2m": meteo["dew_point_2m"].values,
        "dni_extra": dni_extra.values if hasattr(dni_extra, 'values') else dni_extra,
    })

    alogger.info(
        "pvlib Bird clearsky complete: %d rows, %s → %s",
        len(df), df["datetime"].iloc[0], df["datetime"].iloc[-1],
    )

    if pvlib_format:
        return _to_pvlib_weather(df)
    return df
