# ./backend/app/instesre_bird/create_bird_df.py
"""Compute BIRD Clear Sky Model over a datetime range into a DataFrame."""

import pandas as pd
from datetime import datetime, timedelta

from app.instesre_bird.bird_calculator import compute_bird_from_datetime


def compute_bird_over_range_df(
    start_datetime: datetime,
    end_datetime: datetime,
    freq_minutes: int,
    solar_constant,
    lat,
    lon,
    elevation,
    pressure_sea_level,
    ozone,
    water,
    aod500,
    aod380,
    albedo,
) -> pd.DataFrame:
    """Compute BIRD irradiance at regular intervals and return a DataFrame."""
    records = []
    current_time = start_datetime

    while current_time <= end_datetime:
        result = compute_bird_from_datetime(
            solar_constant=solar_constant,
            lat=lat,
            lon=lon,
            elevation=elevation,
            year=current_time.year,
            month=current_time.month,
            day=current_time.day,
            hour=current_time.hour,
            minute=current_time.minute,
            second=current_time.second,
            pressure_sea_level=pressure_sea_level,
            ozone=ozone,
            water=water,
            aod500=aod500,
            aod380=aod380,
            albedo=albedo,
        )

        record = {
            "datetime": current_time,
            "julian_date": result["julian_date"],
            "pressure_mbar": result["pressure"],
            "earth_sun_distance": result["earth_sun_distance"],
            "zenith_deg": result["zenith"],
            "airmass": result["airmass"],
            "solar_corrected": result["solar_corrected"],
            "direct_horizontal": result["direct_horizontal"],
            "dhi": result["dhi"],
            "ghi": result["ghi"],
            "dni": result["dni"],
        }
        records.append(record)

        current_time += timedelta(minutes=freq_minutes)

    df = pd.DataFrame(records)
    return df