/* ============================================================
   Backend Enum Mappings & Default Values
   ============================================================ */

// --- Average Year Strategies ---
export const AVG_YEAR_STRATEGIES = [
  { value: "simple_mean", label: "Simple Mean", description: "Naive mathematical aggregation across all years" },
  { value: "trimmed_mean", label: "Trimmed Mean", description: "Purges statistical outliers using percentile cut-offs" },
  { value: "exponential_weighted", label: "Exponential Weighted", description: "Projects decaying influence, biasing recent climate shifts" },
  { value: "combined", label: "Combined Average Year", description: "Combines all base strategies — may take longer" },
  { value: "super_avg_year", label: "Super Average Year", description: "Consensus across all mathematical permutations" },
  { value: "all", label: "All Strategies", description: "Run all strategies including super average" },
] as const;

export type AvgYearStrategy = (typeof AVG_YEAR_STRATEGIES)[number]["value"];

// --- Solar Simulation Models ---
export const SOLAR_MODELS = [
  { value: "instesre_bird", label: "INSTESRE Bird", description: "Bird & Hulstrom (1981) clear-sky model" },
  { value: "ineichen", label: "Ineichen/Perez", description: "Uses Linke Turbidity factor — auto-looked up" },
  { value: "simplified_solis", label: "Simplified Solis", description: "Atmospheric transmissivity via AOD" },
  { value: "pvlib_bird", label: "pvlib Bird", description: "pvlib implementation of Bird model" },
  { value: "pvgis_tmy", label: "PVGIS TMY", description: "Typical Meteorological Year — no avg-year needed" },
  { value: "pvgis_poa", label: "PVGIS POA", description: "Multi-year hourly POA irradiance (SARAH2)" },
] as const;

export type SolarModel = (typeof SOLAR_MODELS)[number]["value"];

// --- Deep Comparison model checkboxes ---
export const DEEP_COMPARISON_MODELS = [
  { value: "instesre_bird", label: "INSTESRE Bird" },
  { value: "ineichen", label: "Ineichen/Perez" },
  { value: "simplified_solis", label: "Simplified Solis" },
  { value: "pvlib_bird", label: "pvlib Bird" },
] as const;

// --- ModelChain Configuration Enums ---
export const DC_MODELS = [
  { value: "sapm", label: "SAPM" },
  { value: "desoto", label: "De Soto" },
  { value: "cec", label: "CEC" },
  { value: "pvsyst", label: "PVsyst" },
  { value: "pvwatts", label: "PVWatts" },
] as const;

export const AC_MODELS = [
  { value: "sandia", label: "Sandia" },
  { value: "adr", label: "ADR" },
  { value: "pvwatts", label: "PVWatts" },
] as const;

export const AOI_MODELS = [
  { value: "physical", label: "Physical" },
  { value: "ashrae", label: "ASHRAE" },
  { value: "sapm", label: "SAPM" },
  { value: "martin_ruiz", label: "Martin-Ruiz" },
  { value: "interp", label: "Interpolation" },
  { value: "no_loss", label: "No Loss" },
] as const;

export const SPECTRAL_MODELS = [
  { value: "sapm", label: "SAPM" },
  { value: "first_solar", label: "First Solar" },
  { value: "no_loss", label: "No Loss" },
] as const;

export const TEMPERATURE_MODELS = [
  { value: "sapm", label: "SAPM" },
  { value: "pvsyst", label: "PVsyst" },
  { value: "faiman", label: "Faiman" },
  { value: "fuentes", label: "Fuentes" },
  { value: "noct_sam", label: "NOCT SAM" },
] as const;

export const LOSSES_MODELS = [
  { value: "pvwatts", label: "PVWatts" },
  { value: "no_loss", label: "No Loss" },
] as const;

export const RACKING_MODELS = [
  { value: "open_rack", label: "Open Rack" },
  { value: "close_mount", label: "Close Mount" },
  { value: "insulated_back", label: "Insulated Back" },
] as const;

export const MODULE_TYPES = [
  { value: "glass_polymer", label: "Glass/Polymer" },
  { value: "glass_glass", label: "Glass/Glass" },
] as const;

export const AIRMASS_MODELS = [
  { value: "kastenyoung", label: "Kasten-Young" },
  { value: "kasten", label: "Kasten" },
  { value: "simple", label: "Simple (1/cos)" },
] as const;

// --- Common Timezones ---
export const TIMEZONES = [
  "UTC",
  "Europe/Istanbul",
  "Europe/Berlin",
  "Europe/London",
  "US/Eastern",
  "US/Central",
  "US/Pacific",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

// --- Default values matching backend ---
export const DEFAULTS = {
  start_year: 2015,
  end_year: 2020,
  timezone: "UTC",
  decay: 0.9,
  lower_percentile: 10,
  upper_percentile: 90,
  reference_year: 2023,
  elevation: 0,
  ozone: 0.3,
  aod500: 0.1,
  aod380: 0.15,
  aod700: 0.1,
  albedo: 0.2,
  asymmetry: 0.85,
  solar_constant: 1367.0,
  surface_tilt: 0,
  surface_azimuth: 180,
  modules_per_string: 1,
  strings_per_inverter: 1,
} as const;

// --- API Base URL ---
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

// --- SAM Databases ---
export const SAM_MODULE_DBS = [
  { value: "CECMod", label: "CEC Modules (21,500+)", dcModel: "cec", description: "CEC modülü veritabanı — DC model: cec" },
  { value: "SandiaMod", label: "Sandia Modules (523)", dcModel: "sapm", description: "Sandia/SAPM modül veritabanı — DC model: sapm" },
] as const;

export const SAM_INVERTER_DBS = [
  { value: "CECInverter", label: "CEC Inverters (3,264)", acModel: "sandia", description: "CEC evirici veritabanı — AC model: sandia" },
  { value: "SandiaInverter", label: "Sandia Inverters (3,264)", acModel: "sandia", description: "Sandia evirici veritabanı — AC model: sandia" },
  { value: "ADRInverter", label: "ADR Inverters (4,600+)", acModel: "adr", description: "ADR evirici veritabanı — AC model: adr" },
] as const;

// Temperature model configs (mirrors pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS)
export const TEMP_MODEL_CONFIGS: Record<string, { value: string; label: string }[]> = {
  sapm: [
    { value: "open_rack_glass_glass", label: "Open Rack / Glass-Glass" },
    { value: "close_mount_glass_glass", label: "Close Mount / Glass-Glass" },
    { value: "open_rack_glass_polymer", label: "Open Rack / Glass-Polymer" },
    { value: "insulated_back_glass_polymer", label: "Insulated Back / Glass-Polymer" },
  ],
  pvsyst: [
    { value: "freestanding", label: "Freestanding (u_c=29, u_v=0)" },
    { value: "insulated", label: "Insulated (u_c=15, u_v=0)" },
  ],
};

export const TEMP_MODELS = [
  { value: "sapm", label: "SAPM" },
  { value: "pvsyst", label: "PVsyst" },
] as const;

// DC/AC model compatibility hints
export const DC_MODEL_HINTS: Record<string, string> = {
  CECMod: "cec",
  SandiaMod: "sapm",
};

export const AC_MODEL_HINTS: Record<string, string> = {
  CECInverter: "sandia",
  SandiaInverter: "sandia",
  ADRInverter: "adr",
};
