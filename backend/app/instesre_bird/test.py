"""Test script for average year strategies.

Generates synthetic multi-year data to test all 4 strategies quickly,
then runs a real-world test with INSTESRE Bird (3 years).
"""

import numpy as np
import pandas as pd
from app.average_year.create_average_year import create_average_year, AverageYearStrategy


# ======================================================================
# Part 1: Synthetic data test (no API calls)
# ======================================================================
print("=" * 60)
print("Part 1: Synthetic multi-year data test")
print("=" * 60)

# Create 5 years of synthetic hourly data (including 2024 = leap year)
years = [2020, 2021, 2022, 2023, 2024]
frames = []
for y in years:
    start = pd.Timestamp(f"{y}-01-01")
    end = pd.Timestamp(f"{y}-12-31 23:00:00")
    idx = pd.date_range(start, end, freq="h")

    # Synthetic GHI: sinusoidal daily pattern + year-to-year variation + noise
    day_frac = idx.hour / 24.0
    day_of_year = idx.dayofyear / 365.0

    # Base: solar-like pattern (zero at night, peak at noon)
    ghi_base = np.maximum(0, 800 * np.sin(np.pi * day_frac) * np.sin(np.pi * day_of_year))

    # Year trend: slight increase over time (mimics climate trend)
    year_factor = 1.0 + 0.02 * (y - 2020)

    # Random noise
    noise = np.random.normal(0, 20, len(idx))

    ghi = np.maximum(0, ghi_base * year_factor + noise)
    dni = ghi * 0.7  # simplified
    dhi = ghi * 0.3
    temp = 15 + 10 * np.sin(np.pi * day_of_year) + np.random.normal(0, 2, len(idx))
    wind = 3 + np.random.normal(0, 1, len(idx))

    frame = pd.DataFrame({
        "datetime": idx,
        "ghi": ghi,
        "dni": dni,
        "dhi": dhi,
        "temp_air": temp,
        "wind_speed": np.maximum(0, wind),
    })
    frames.append(frame)

multi_year_df = pd.concat(frames, ignore_index=True)
print(f"Multi-year data: {len(multi_year_df)} rows, years: {years}")

# Check leap day presence
feb29 = multi_year_df[
    (pd.to_datetime(multi_year_df.datetime).dt.month == 2) &
    (pd.to_datetime(multi_year_df.datetime).dt.day == 29)
]
print(f"Feb 29 rows: {len(feb29)} (from {len([y for y in years if y % 4 == 0])} leap years)")
print()

# Test all 4 strategies
for strategy in AverageYearStrategy:
    avg = create_average_year(
        multi_year_df,
        strategy=strategy,
        decay=0.90,
    )
    print(f"\n--- {strategy.value} ---")
    print(f"  Shape: {avg.shape}")
    print(f"  Index: {avg.index[0]} → {avg.index[-1]}")
    print(f"  Feb 28 12:00 GHI: {avg.loc['2023-02-28 12:00:00', 'ghi']:.1f} W/m²")
    print(f"  Jun 21 12:00 GHI: {avg.loc['2023-06-21 12:00:00', 'ghi']:.1f} W/m²")
    print(f"  Annual GHI sum: {avg['ghi'].sum():.0f} Wh/m²")

print()

# ======================================================================
# Part 2: Show exponential weighting effect
# ======================================================================
print("=" * 60)
print("Part 2: Exponential weighting effect")
print("=" * 60)

# Compare simple_mean vs exponential_weighted at June 21 noon
avg_simple = create_average_year(multi_year_df, strategy="simple_mean")
avg_exp085 = create_average_year(multi_year_df, strategy="exponential_weighted", decay=0.85)
avg_exp095 = create_average_year(multi_year_df, strategy="exponential_weighted", decay=0.95)

comparison = pd.DataFrame({
    "Simple Mean": avg_simple.loc["2023-06-21 12:00:00", ["ghi", "dni", "dhi", "temp_air"]],
    "Exp. (λ=0.85)": avg_exp085.loc["2023-06-21 12:00:00", ["ghi", "dni", "dhi", "temp_air"]],
    "Exp. (λ=0.95)": avg_exp095.loc["2023-06-21 12:00:00", ["ghi", "dni", "dhi", "temp_air"]],
})
print("Values at June 21 12:00 (data has +2%/year trend, so weighted should be higher):")
print(comparison.round(2))
print()

# ======================================================================
# Part 3: Real data test (3 years, fewer API calls)
# ======================================================================
print("=" * 60)
print("Part 3: Real INSTESRE Bird data (3 years)")
print("=" * 60)

from app.instesre_bird.bird_openmeteo import create_bird_df

df_real = create_bird_df(
    lat=38.42, lon=27.14, elevation=25,
    start_date="2022-01-01", end_date="2024-12-31",
    pvlib_format=True,
)
print(f"Real data: {len(df_real)} rows, {df_real.index[0]} → {df_real.index[-1]}")

# Reset index to have datetime as column
df_real_with_dt = df_real.copy()
df_real_with_dt["datetime"] = df_real_with_dt.index
df_real_with_dt = df_real_with_dt.reset_index(drop=True)

avg_real = create_average_year(df_real_with_dt, strategy="combined")
print(f"Average year: {len(avg_real)} rows")
print(f"Summer noon GHI: {avg_real.loc['2023-06-21 12:00:00', 'ghi']:.1f} W/m²")
print(f"Winter noon GHI: {avg_real.loc['2023-12-21 12:00:00', 'ghi']:.1f} W/m²")
print(f"Annual GHI sum: {avg_real['ghi'].sum():.0f} Wh/m²")
print()
print("Sample summer day:")
print(avg_real.loc["2023-06-21 04:00:00":"2023-06-21 18:00:00", ["ghi", "dni", "dhi", "temp_air", "wind_speed"]].round(1))
