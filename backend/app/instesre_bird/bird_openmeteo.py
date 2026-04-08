# ./backend/app/instesre_bird/bird_openmeteo.py
"""Combines the Bird Clear Sky Model with Open-Meteo historical weather data.

Fetches atmospheric parameters (surface pressure, dew point temperature,
air temperature, wind speed) from the Open-Meteo Historical Weather API in a
single request and uses them to drive the Bird Clear Sky Model, producing a
DataFrame of clear-sky irradiance values over a specified time range.

Air temperature and wind speed are included for pvlib ModelChain compatibility
(cell temperature modelling).

Parameters that cannot be obtained from Open-Meteo (ozone column thickness,
aerosol optical depths, surface albedo) are accepted as user-configurable
inputs with sensible defaults from Bird & Hulstrom (1981).

References
----------
Bird, R. E. and Hulstrom, R. L. (1981). "A Simplified Clear Sky Model for
Direct and Diffuse Insolation on Horizontal Surfaces".
Technical Report SERI/TR-642-761, Solar Energy Research Institute.
"""

import numpy as np
import pandas as pd
from datetime import date

from app.instesre_bird.bird_calculator import (
    get_julian_date,
    solar_zenith_angle,
    bird_model,
)
from app.outer_apis.openmeteo.fetch_openmeteo import fetch_open_meteo
from app.schemas.openmeteo_schemas import OpenMeteoRequestSchema
from app.core.logger import alogger


# ---------------------------------------------------------------------------
# Helper: dew-point → precipitable water
# ---------------------------------------------------------------------------

def _dew_point_to_precipitable_water(dew_point_celsius: np.ndarray | float) -> np.ndarray | float:
    """Convert dew-point temperature to precipitable water content.

    Uses the empirical relationship from Bird & Hulstrom (1981):

        w = exp(0.07 * T_d - 0.075)

    where *T_d* is the dew-point temperature in °C and *w* is the total
    precipitable water column in cm.  This is the same formula adopted by
    pvlib and is standard in solar-radiation modelling.

    Parameters
    ----------
    dew_point_celsius : float or array-like
        Dew-point temperature in degrees Celsius.

    Returns
    -------
    float or array-like
        Precipitable water content in cm.
    """
    return np.exp(0.07 * dew_point_celsius - 0.075)


# ---------------------------------------------------------------------------
# Helper: BIRD DataFrame → pvlib ModelChain weather format
# ---------------------------------------------------------------------------

def to_pvlib_weather(bird_df: pd.DataFrame) -> pd.DataFrame:
    """Convert a BIRD output DataFrame to pvlib ModelChain weather format.

    The pvlib ``ModelChain.run_model()`` expects a DataFrame with a
    ``DatetimeIndex`` and at minimum the columns ``ghi``, ``dni``, ``dhi``.
    This helper selects and renames the relevant columns and sets the
    datetime as the index.

    Parameters
    ----------
    bird_df : pd.DataFrame
        DataFrame produced by :func:`create_bird_df`.

    Returns
    -------
    pd.DataFrame
        DataFrame with ``DatetimeIndex`` and columns:

        ============ ===========================================
        Column       Description
        ============ ===========================================
        ghi          Global horizontal irradiance (W/m²)
        dni          Direct normal irradiance (W/m²)
        dhi          Diffuse horizontal irradiance (W/m²)
        temp_air     Air temperature at 2 m (°C)
        wind_speed   Wind speed at 10 m (m/s)
        ============ ===========================================

    Raises
    ------
    KeyError
        If the input DataFrame is missing required columns.
    """
    required = {"datetime", "ghi", "dni", "dhi"}
    missing = required - set(bird_df.columns)
    if missing:
        raise KeyError(
            f"BIRD DataFrame is missing columns required for pvlib: {missing}"
        )

    cols = ["datetime", "ghi", "dni", "dhi"]
    rename_map = {}

    if "temperature_2m" in bird_df.columns:
        cols.append("temperature_2m")
        rename_map["temperature_2m"] = "temp_air"
    if "wind_speed_10m" in bird_df.columns:
        cols.append("wind_speed_10m")
        rename_map["wind_speed_10m"] = "wind_speed"

    weather = bird_df[cols].copy()
    weather = weather.set_index("datetime")
    weather = weather.rename(columns=rename_map)
    weather.index = pd.DatetimeIndex(weather.index)
    weather.index.name = None  # pvlib convention

    alogger.debug(
        "Converted BIRD DataFrame to pvlib weather format — shape: %s, columns: %s",
        weather.shape, list(weather.columns),
    )

    return weather


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def create_bird_df(
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
    solar_constant: float = 1367.0,
    timezone: str = "UTC",
    pvlib_format: bool = False,
) -> pd.DataFrame:
    """Compute the Bird Clear Sky Model using atmospheric data from Open-Meteo.

    A single Open-Meteo API call fetches ``surface_pressure``,
    ``dew_point_2m``, ``temperature_2m``, and ``wind_speed_10m`` for the
    entire date range.  Surface pressure is fed directly into the Bird
    model (more accurate than the empirical sea-level → station-pressure
    conversion).  Dew-point temperature is converted to precipitable water
    via the Bird & Hulstrom (1981) formula.  Air temperature and wind speed
    are included for pvlib ModelChain cell-temperature modelling.

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees (-90 to 90).
    lon : float
        Longitude in decimal degrees (-180 to 180).
    elevation : float
        Site elevation in metres above sea level.  Stored as metadata in
        the output; the pressure input to the Bird model comes directly
        from Open-Meteo ``surface_pressure``.
    start_date : date or str
        First day of the calculation range (YYYY-MM-DD).
    end_date : date or str
        Last day of the calculation range (YYYY-MM-DD), inclusive.
    freq_minutes : int, optional
        Time step in minutes (default 60).  If less than 60, Open-Meteo
        hourly data is linearly interpolated to the requested frequency.
    ozone : float, optional
        Atmospheric ozone column thickness in atm-cm (default 0.3).
        Not available from Open-Meteo.  Typical range 0.25–0.35 cm;
        effect on GHI is ~1-2 %.
    aod500 : float, optional
        Aerosol optical depth at 500 nm (default 0.1).
        Not available from Open-Meteo.  Rural ≈ 0.1, urban ≈ 0.16.
    aod380 : float, optional
        Aerosol optical depth at 380 nm (default 0.15).
        Not available from Open-Meteo.  Rural ≈ 0.15, urban ≈ 0.22.
    albedo : float, optional
        Surface albedo (default 0.2).
        Not available from Open-Meteo.  Grass/soil ≈ 0.2, snow ≈ 0.8.
    solar_constant : float, optional
        Extra-terrestrial solar irradiance in W/m² (default 1367.0).
    timezone : str, optional
        Timezone for Open-Meteo request timestamps (default ``"UTC"``).
    pvlib_format : bool, optional
        If ``True``, returns a DataFrame formatted for direct use with
        ``pvlib.modelchain.ModelChain.run_model()`` — i.e. a DatetimeIndex
        and only the ``ghi``, ``dni``, ``dhi`` columns (default ``False``).

    Returns
    -------
    pd.DataFrame
        DataFrame indexed by datetime with columns:

        ==================== ============================================
        Column               Description
        ==================== ============================================
        datetime             Timestamp
        julian_date          Julian date
        surface_pressure_hpa Surface pressure from Open-Meteo (hPa)
        dew_point_2m         Dew-point temperature (°C)
        precipitable_water_cm Derived precipitable water (cm)
        temperature_2m       Air temperature at 2 m (°C)
        wind_speed_10m       Wind speed at 10 m (m/s)
        earth_sun_distance   Earth–Sun distance (AU)
        zenith_deg           Solar zenith angle (°)
        airmass              Relative air mass
        solar_corrected      Distance-corrected solar constant (W/m²)
        direct_horizontal    Direct beam on horizontal (W/m²)
        dhi                  Diffuse horizontal irradiance (W/m²)
        ghi                  Global horizontal irradiance (W/m²)
        dni                  Direct normal irradiance (W/m²)
        ==================== ============================================

    Raises
    ------
    RuntimeError
        If Open-Meteo returns no hourly data for the given location/range.
    """

    # --- Normalise date inputs ------------------------------------------------
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)
    if isinstance(end_date, str):
        end_date = date.fromisoformat(end_date)

    # --- Fetch atmospheric data from Open-Meteo (single API call) -------------
    alogger.info(
        "Fetching Open-Meteo data for BIRD model: (%.4f, %.4f) from %s to %s",
        lat, lon, start_date, end_date,
    )

    request = OpenMeteoRequestSchema(
        latitude=lat,
        longitude=lon,
        start_date=start_date,
        end_date=end_date,
        hourly=["surface_pressure", "dew_point_2m", "temperature_2m", "wind_speed_10m"],
        timezone=timezone,
        wind_speed_unit="ms",  # pvlib expects m/s
    )

    meteo_result = fetch_open_meteo(request)
    hourly_df: pd.DataFrame | None = meteo_result["hourly_dataframe"]

    if hourly_df is None or hourly_df.empty:
        raise RuntimeError(
            f"Open-Meteo returned no hourly data for ({lat}, {lon}) "
            f"from {start_date} to {end_date}"
        )

    alogger.info("Open-Meteo hourly data retrieved — shape: %s", hourly_df.shape)

    # --- Build target datetime index ------------------------------------------
    target_index = pd.date_range(
        start=pd.Timestamp(start_date),
        end=pd.Timestamp(end_date) + pd.Timedelta(hours=23),
        freq=f"{freq_minutes}min",
    )

    # --- Interpolate Open-Meteo data to target frequency ----------------------
    # Open-Meteo provides hourly data.  For sub-hourly frequencies we create a
    # union of the original hourly index and the target index, linearly
    # interpolate through time, then select only the target timestamps.
    # Edge values are forward/backward filled to avoid NaN at boundaries.
    meteo_interp = (
        hourly_df
        .reindex(hourly_df.index.union(target_index))
        .interpolate(method="time")
        .ffill()
        .bfill()
        .reindex(target_index)
    )

    # --- Vectorised solar-position calculation --------------------------------
    # Pre-compute Julian dates and solar zenith angles for every target timestamp
    # using the existing bird_calculator functions (scalar interface, looped).
    n = len(target_index)
    jd_arr = np.empty(n)
    zenith_arr = np.empty(n)
    earth_sun_arr = np.empty(n)

    for i, dt in enumerate(target_index):
        jd_arr[i] = get_julian_date(dt.month, dt.day, dt.year, dt.hour, dt.minute, dt.second)
        zenith_arr[i], earth_sun_arr[i] = solar_zenith_angle(jd_arr[i], lat, lon)

    # --- Extract atmospheric arrays and derive precipitable water -------------
    surface_pressure_arr = meteo_interp["surface_pressure"].values
    dew_point_arr = meteo_interp["dew_point_2m"].values
    water_arr = _dew_point_to_precipitable_water(dew_point_arr)
    temperature_arr = meteo_interp["temperature_2m"].values
    wind_speed_arr = meteo_interp["wind_speed_10m"].values

    # --- Run Bird model for each timestep -------------------------------------
    records = []

    for i in range(n):
        result = bird_model(
            zenith_deg=zenith_arr[i],
            pressure_mbar=surface_pressure_arr[i],   # hPa == mbar
            ozone_cm=ozone,
            water_cm=water_arr[i],
            aod500=aod500,
            aod380=aod380,
            albedo=albedo,
            solar_constant=solar_constant,
            earth_sun_distance=earth_sun_arr[i],
        )

        records.append({
            "datetime": target_index[i],
            "julian_date": jd_arr[i],
            "surface_pressure_hpa": surface_pressure_arr[i],
            "dew_point_2m": dew_point_arr[i],
            "precipitable_water_cm": water_arr[i],
            "temperature_2m": temperature_arr[i],
            "wind_speed_10m": wind_speed_arr[i],
            "earth_sun_distance": earth_sun_arr[i],
            "zenith_deg": zenith_arr[i],
            "airmass": result["airmass"],
            "solar_corrected": result["solar_corrected"],
            "direct_horizontal": result["direct_horizontal"],
            "dhi": result["dhi"],
            "ghi": result["ghi"],
            "dni": result["dni"],
        })

    df = pd.DataFrame(records)

    alogger.info(
        "BIRD+OpenMeteo computation complete: %d rows, %s → %s",
        len(df), df["datetime"].iloc[0], df["datetime"].iloc[-1],
    )

    if pvlib_format:
        return to_pvlib_weather(df)

    return df
