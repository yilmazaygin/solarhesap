import { z } from "zod";

/* ============================================================
   Zod Validation Schemas — mirrors backend Pydantic schemas
   ============================================================ */

// --- Location ---
export const locationSchema = z.object({
  latitude: z
    .number({ required_error: "Latitude is required" })
    .min(-90, "Latitude must be ≥ -90°")
    .max(90, "Latitude must be ≤ 90°"),
  longitude: z
    .number({ required_error: "Longitude is required" })
    .min(-180, "Longitude must be ≥ -180°")
    .max(180, "Longitude must be ≤ 180°"),
  elevation: z.number().min(-450).max(8850).default(0),
});

// --- ModelChain Location (for pvlib) ---
export const pvlibLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tz: z.string().optional(),
  altitude: z.number().min(-450).max(8850).optional(),
  name: z.string().optional(),
});

// --- Date Range ---
export const dateRangeBaseSchema = z.object({
  start_year: z
    .number()
    .int()
    .min(2005, "Start year must be ≥ 2005")
    .max(2025, "Start year must be ≤ 2025"),
  end_year: z
    .number()
    .int()
    .min(2005, "End year must be ≥ 2005")
    .max(2025, "End year must be ≤ 2025"),
});

export const dateRangeSchema = dateRangeBaseSchema
  .refine((d) => d.start_year <= d.end_year, {
    message: "Start year must be ≤ end year",
    path: ["start_year"],
  })
  .refine((d) => d.end_year - d.start_year + 1 <= 20, {
    message: "Maximum range is 20 years",
    path: ["end_year"],
  });

// --- Average Year Config ---
export const avgYearConfigSchema = z.object({
  avg_year_strategies: z
    .array(z.string())
    .min(1, "Select at least one strategy")
    .default(["combined"]),
  decay: z.number().gt(0).lt(1).default(0.9),
  lower_percentile: z.number().min(0).max(50).default(10),
  upper_percentile: z.number().min(50).max(100).default(90),
  reference_year: z.number().int().default(2023),
  timezone: z.string().default("UTC"),
});

// --- Atmospheric Parameters ---
export const atmosphericSchema = z.object({
  ozone: z.number().min(0).max(1).default(0.3),
  aod500: z.number().min(0).max(2).default(0.1),
  aod380: z.number().min(0).max(2).default(0.15),
  aod700: z.number().min(0).max(0.45).default(0.1),
  albedo: z.number().min(0).max(1).default(0.2),
  asymmetry: z.number().min(0).max(1).default(0.85),
  solar_constant: z.number().positive().default(1367.0),
});

// --- PV Array ---
export const pvArraySchema = z.object({
  module_type: z.enum(["glass_polymer", "glass_glass"]).default("glass_polymer"),
  module_parameters: z
    .object({
      pdc0: z.number().positive("pdc0 must be positive"),
      gamma_pdc: z.number(),
    })
    .optional(),
  temperature_model_parameters: z
    .object({
      a: z.number(),
      b: z.number(),
      deltaT: z.number(),
    })
    .optional(),
  modules_per_string: z.number().int().positive().default(1),
  strings: z.number().int().positive().default(1),
  name: z.string().optional(),
});

// --- PV System ---
export const pvSystemSchema = z.object({
  arrays: z.array(pvArraySchema).optional(),
  surface_tilt: z.number().min(0).max(90).default(0),
  surface_azimuth: z.number().min(0).max(360).default(180),
  albedo: z.number().min(0).max(1).optional(),
  module_type: z.enum(["glass_polymer", "glass_glass"]).default("glass_polymer"),
  module_parameters: z
    .object({
      pdc0: z.number().positive(),
      gamma_pdc: z.number(),
    })
    .optional(),
  inverter_parameters: z
    .object({
      pdc0: z.number().positive(),
      eta_inv_nom: z.number().min(0).max(1),
    })
    .optional(),
  temperature_model_parameters: z
    .object({
      a: z.number(),
      b: z.number(),
      deltaT: z.number(),
    })
    .optional(),
  modules_per_string: z.number().int().positive().default(1),
  strings_per_inverter: z.number().int().positive().default(1),
  racking_model: z
    .enum(["open_rack", "close_mount", "insulated_back"])
    .default("open_rack"),
});

// --- ModelChain Config ---
export const modelChainConfigSchema = z.object({
  dc_model: z.string().nullable().optional(),
  ac_model: z.string().nullable().optional(),
  aoi_model: z.string().nullable().optional(),
  spectral_model: z.string().nullable().optional(),
  temperature_model: z.string().nullable().optional(),
  losses_model: z.string().nullable().optional(),
});

// --- Individual Model Requests ---
export const instesreBirdSchema = locationSchema
  .merge(dateRangeBaseSchema)
  .merge(avgYearConfigSchema)
  .merge(
    z.object({
      ozone: z.number().min(0).max(1).default(0.3),
      aod500: z.number().min(0).max(2).default(0.1),
      aod380: z.number().min(0).max(2).default(0.15),
      albedo: z.number().min(0).max(1).default(0.2),
      solar_constant: z.number().positive().default(1367.0),
    })
  );

export const pvgisTmySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation: z.number().min(-450).max(8850).default(0),
  startyear: z.number().int().optional(),
  endyear: z.number().int().optional(),
  usehorizon: z.boolean().default(true),
});

// --- Deep Comparison ---
export const deepComparisonSchema = locationSchema
  .merge(dateRangeBaseSchema)
  .merge(avgYearConfigSchema)
  .merge(atmosphericSchema)
  .merge(
    z.object({
      models: z
        .array(z.string())
        .min(1, "Select at least one model")
        .default(["instesre_bird", "ineichen", "simplified_solis", "pvlib_bird"]),
      include_pvgis_tmy: z.boolean().default(true),
      include_pvgis_poa: z.boolean().default(false),
      surface_tilt: z.number().min(0).max(90).default(0),
      surface_azimuth: z.number().min(0).max(360).default(180),
    })
  );

// --- Run ModelChain ---
export const runModelChainSchema = z.object({
  location: pvlibLocationSchema,
  pvsystem: pvSystemSchema,
  modelchain_config: modelChainConfigSchema.optional(),
  weather_source: z.string().default("ineichen"),
  start_year: z.number().int().min(2005).max(2025).default(2015),
  end_year: z.number().int().min(2005).max(2025).default(2020),
  timezone: z.string().default("UTC"),
  avg_year_strategies: z.array(z.string()).default(["combined"]),
  decay: z.number().gt(0).lt(1).default(0.9),
  lower_percentile: z.number().min(0).max(50).default(10),
  upper_percentile: z.number().min(50).max(100).default(90),
  reference_year: z.number().int().default(2023),
  ozone: z.number().min(0).max(1).default(0.3),
  aod500: z.number().min(0).max(2).default(0.1),
  aod380: z.number().min(0).max(2).default(0.15),
  aod700: z.number().min(0).max(0.45).default(0.1),
  albedo: z.number().min(0).max(1).default(0.2),
  asymmetry: z.number().min(0).max(1).default(0.85),
  solar_constant: z.number().positive().default(1367.0),
  usehorizon: z.boolean().default(true),
});

// --- Solar Tools Schemas ---
export const julianDaySchema = z.object({
  year: z.number().int().min(1).max(9999).optional(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  hour: z.number().int().min(0).max(23).default(0),
  minute: z.number().int().min(0).max(59).default(0),
  second: z.number().int().min(0).max(59).default(0),
  iso_string: z.string().optional(),
});

export const solarPositionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  year: z.number().int().min(1).max(9999),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23).default(12),
  minute: z.number().int().min(0).max(59).default(0),
  second: z.number().int().min(0).max(59).default(0),
});

export const sunriseSunsetSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  year: z.number().int().min(1).max(9999),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const airmassSchema = z.object({
  zenith_deg: z.number().min(0).max(180),
  model: z.enum(["kastenyoung", "kasten", "simple"]).default("kastenyoung"),
});

export const extraterrestrialSchema = z.object({
  year: z.number().int().min(1).max(9999),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  solar_constant: z.number().positive().default(1367.0),
});

export const dewPointSchema = z.object({
  dew_point_c: z.number().min(-80).max(60),
});

export const stationPressureSchema = z.object({
  elevation_m: z.number().min(-450).max(8850),
  sea_level_pressure_hpa: z.number().positive().default(1013.25),
});

export const isaPressureSchema = z.object({
  elevation_m: z.number().min(0).max(11000),
});

export const angleOfIncidenceSchema = z.object({
  surface_tilt: z.number().min(0).max(90),
  surface_azimuth: z.number().min(0).max(360),
  solar_zenith: z.number().min(0).max(180),
  solar_azimuth: z.number().min(0).max(360),
});

export const optimalTiltSchema = z.object({
  latitude: z.number().min(-90).max(90),
});

export const instantBirdSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  year: z.number().int().min(1).max(9999),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23).default(12),
  minute: z.number().int().min(0).max(59).default(0),
  second: z.number().int().min(0).max(59).default(0),
  elevation: z.number().min(-450).max(8850).default(0),
  pressure_sea_level: z.number().positive().default(1013.25),
  ozone: z.number().min(0).max(1).default(0.3),
  precipitable_water: z.number().min(0).max(10).default(1.42),
  aod500: z.number().min(0).max(2).default(0.1),
  aod380: z.number().min(0).max(2).default(0.15),
  albedo: z.number().min(0).max(1).default(0.2),
  solar_constant: z.number().positive().default(1367.0),
});

export const solarDeclinationSchema = z.object({
  year: z.number().int().min(1).max(9999),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const linkeTurbiditySchema = z.object({
  elevation_m: z.number().min(-450).max(8850).default(0),
  precipitable_water_cm: z.number().min(0).max(10).default(1.4),
  aod700: z.number().min(0).max(0.45).default(0.1),
});

export const erbsDecompositionSchema = z.object({
  ghi: z.number().min(0).max(1500),
  zenith_deg: z.number().min(0).max(180),
  day_of_year: z.number().int().min(1).max(366),
  solar_constant: z.number().positive().default(1367.0),
});

export const poaIrradianceSchema = z.object({
  ghi: z.number().min(0).max(1500),
  dni: z.number().min(0).max(1500),
  dhi: z.number().min(0).max(1000),
  surface_tilt: z.number().min(0).max(90),
  surface_azimuth: z.number().min(0).max(360),
  solar_zenith: z.number().min(0).max(180),
  solar_azimuth: z.number().min(0).max(360),
  albedo: z.number().min(0).max(1).default(0.2),
});
