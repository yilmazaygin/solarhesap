"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Download,
  Copy,
  Check,
  Calendar,
  Sun,
  Sunrise,
  Compass,
  Wind,
  Droplets,
  Gauge,
  Thermometer,
  Eye,
  Zap,
  Target,
  Triangle,
  Layers,
  ArrowDown,
  Play,
} from "lucide-react";
import type { ZodType } from "zod";

import GlassCard from "@/components/shared/GlassCard";
import * as schemas from "@/lib/schemas";
import * as api from "@/lib/api";
import { AIRMASS_MODELS } from "@/lib/constants";
import { useLanguage } from "@/context/LanguageContext";

/* ═══════════════════════════════════════════════════════
   Tool Definitions — maps each tool to its schema, API, UI
   ═══════════════════════════════════════════════════════ */

interface ToolDef {
  id: string;
  titleKey: string;
  icon: React.ElementType;
  groupKey: "dateTime" | "solarPos" | "atmosphere" | "irradiance" | "geometry";
  schema: ZodType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiFn: (data: any) => Promise<any>;
  fields: FieldDef[];
}

interface FieldDef {
  name: string;
  labelKey: string;
  type: "number" | "select" | "text";
  step?: string;
  defaultValue?: number | string;
  unit?: string;
  options?: { value: string; label: string }[];
}

const TOOLS: ToolDef[] = [
  // --- Date/Time ---
  {
    id: "julian-day",
    titleKey: "julian_day",
    icon: Calendar,
    groupKey: "dateTime",
    schema: schemas.julianDaySchema,
    apiFn: api.calcJulianDay,
    fields: [
      { name: "year", labelKey: "year", type: "number", defaultValue: 2024 },
      { name: "month", labelKey: "month", type: "number", defaultValue: 6 },
      { name: "day", labelKey: "day", type: "number", defaultValue: 21 },
      { name: "hour", labelKey: "hour", type: "number", defaultValue: 12 },
      { name: "minute", labelKey: "minute", type: "number", defaultValue: 0 },
      { name: "second", labelKey: "second", type: "number", defaultValue: 0 },
    ],
  },
  {
    id: "solar-declination",
    titleKey: "solar_declination",
    icon: Compass,
    groupKey: "dateTime",
    schema: schemas.solarDeclinationSchema,
    apiFn: api.calcSolarDeclination,
    fields: [
      { name: "year", labelKey: "year", type: "number", defaultValue: 2024 },
      { name: "month", labelKey: "month", type: "number", defaultValue: 6 },
      { name: "day", labelKey: "day", type: "number", defaultValue: 21 },
    ],
  },
  // --- Solar Position ---
  {
    id: "solar-position",
    titleKey: "solar_position",
    icon: Sun,
    groupKey: "solarPos",
    schema: schemas.solarPositionSchema,
    apiFn: api.calcSolarPosition,
    fields: [
      { name: "latitude", labelKey: "latitude", type: "number", step: "any", defaultValue: 38.42, unit: "°" },
      { name: "longitude", labelKey: "longitude", type: "number", step: "any", defaultValue: 27.14, unit: "°" },
      { name: "year", labelKey: "year", type: "number", defaultValue: 2024 },
      { name: "month", labelKey: "month", type: "number", defaultValue: 6 },
      { name: "day", labelKey: "day", type: "number", defaultValue: 21 },
      { name: "hour", labelKey: "hour", type: "number", defaultValue: 12 },
      { name: "minute", labelKey: "minute", type: "number", defaultValue: 0 },
      { name: "second", labelKey: "second", type: "number", defaultValue: 0 },
    ],
  },
  {
    id: "sunrise-sunset",
    titleKey: "sunrise_sunset",
    icon: Sunrise,
    groupKey: "solarPos",
    schema: schemas.sunriseSunsetSchema,
    apiFn: api.calcSunriseSunset,
    fields: [
      { name: "latitude", labelKey: "latitude", type: "number", step: "any", defaultValue: 38.42, unit: "°" },
      { name: "longitude", labelKey: "longitude", type: "number", step: "any", defaultValue: 27.14, unit: "°" },
      { name: "year", labelKey: "year", type: "number", defaultValue: 2024 },
      { name: "month", labelKey: "month", type: "number", defaultValue: 6 },
      { name: "day", labelKey: "day", type: "number", defaultValue: 21 },
    ],
  },
  // --- Atmosphere ---
  {
    id: "airmass",
    titleKey: "airmass",
    icon: Wind,
    groupKey: "atmosphere",
    schema: schemas.airmassSchema,
    apiFn: api.calcAirmass,
    fields: [
      { name: "zenith_deg", labelKey: "zenith", type: "number", step: "any", defaultValue: 30, unit: "°" },
      {
        name: "model",
        labelKey: "model",
        type: "select",
        defaultValue: "kastenyoung",
        options: [...AIRMASS_MODELS],
      },
    ],
  },
  {
    id: "dew-point",
    titleKey: "dew_point",
    icon: Droplets,
    groupKey: "atmosphere",
    schema: schemas.dewPointSchema,
    apiFn: api.calcDewPointToPw,
    fields: [
      { name: "dew_point_c", labelKey: "dewPoint", type: "number", step: "any", defaultValue: 10, unit: "°C" },
    ],
  },
  {
    id: "station-pressure",
    titleKey: "station_pressure",
    icon: Gauge,
    groupKey: "atmosphere",
    schema: schemas.stationPressureSchema,
    apiFn: api.calcStationPressure,
    fields: [
      { name: "elevation_m", labelKey: "elevation", type: "number", step: "any", defaultValue: 0, unit: "m" },
      { name: "sea_level_pressure_hpa", labelKey: "slp", type: "number", step: "any", defaultValue: 1013.25, unit: "hPa" },
    ],
  },
  {
    id: "isa-pressure",
    titleKey: "isa_pressure",
    icon: Thermometer,
    groupKey: "atmosphere",
    schema: schemas.isaPressureSchema,
    apiFn: api.calcIsaPressure,
    fields: [
      { name: "elevation_m", labelKey: "elevation", type: "number", step: "any", defaultValue: 1000, unit: "m" },
    ],
  },
  {
    id: "linke-turbidity",
    titleKey: "linke_turbidity",
    icon: Eye,
    groupKey: "atmosphere",
    schema: schemas.linkeTurbiditySchema,
    apiFn: api.calcLinkeTurbidity,
    fields: [
      { name: "elevation_m", labelKey: "elevation", type: "number", defaultValue: 0, unit: "m" },
      { name: "precipitable_water_cm", labelKey: "pw", type: "number", step: "any", defaultValue: 1.4, unit: "cm" },
      { name: "aod700", labelKey: "aod700", type: "number", step: "any", defaultValue: 0.1 },
    ],
  },
  // --- Irradiance ---
  {
    id: "extraterrestrial",
    titleKey: "extraterrestrial",
    icon: Zap,
    groupKey: "irradiance",
    schema: schemas.extraterrestrialSchema,
    apiFn: api.calcExtraterrestrial,
    fields: [
      { name: "year", labelKey: "year", type: "number", defaultValue: 2024 },
      { name: "month", labelKey: "month", type: "number", defaultValue: 6 },
      { name: "day", labelKey: "day", type: "number", defaultValue: 21 },
      { name: "solar_constant", labelKey: "solarConstant", type: "number", step: "any", defaultValue: 1367, unit: "W/m²" },
    ],
  },
  {
    id: "instant-bird",
    titleKey: "instant_bird",
    icon: Sun,
    groupKey: "irradiance",
    schema: schemas.instantBirdSchema,
    apiFn: api.calcInstantBird,
    fields: [
      { name: "latitude", labelKey: "latitude", type: "number", step: "any", defaultValue: 38.42, unit: "°" },
      { name: "longitude", labelKey: "longitude", type: "number", step: "any", defaultValue: 27.14, unit: "°" },
      { name: "year", labelKey: "year", type: "number", defaultValue: 2024 },
      { name: "month", labelKey: "month", type: "number", defaultValue: 6 },
      { name: "day", labelKey: "day", type: "number", defaultValue: 21 },
      { name: "hour", labelKey: "hour", type: "number", defaultValue: 12 },
      { name: "minute", labelKey: "minute", type: "number", defaultValue: 0 },
      { name: "second", labelKey: "second", type: "number", defaultValue: 0 },
      { name: "elevation", labelKey: "elevation", type: "number", defaultValue: 0, unit: "m" },
      { name: "pressure_sea_level", labelKey: "slp", type: "number", step: "any", defaultValue: 1013.25, unit: "hPa" },
      { name: "ozone", labelKey: "ozone", type: "number", step: "any", defaultValue: 0.3, unit: "atm-cm" },
      { name: "precipitable_water", labelKey: "pw", type: "number", step: "any", defaultValue: 1.42, unit: "cm" },
      { name: "aod500", labelKey: "aod500", type: "number", step: "any", defaultValue: 0.1 },
      { name: "aod380", labelKey: "aod380", type: "number", step: "any", defaultValue: 0.15 },
      { name: "albedo", labelKey: "albedo", type: "number", step: "any", defaultValue: 0.2 },
      { name: "solar_constant", labelKey: "solarConstant", type: "number", step: "any", defaultValue: 1367, unit: "W/m²" },
    ],
  },
  {
    id: "erbs-decomposition",
    titleKey: "erbs_decomposition",
    icon: ArrowDown,
    groupKey: "irradiance",
    schema: schemas.erbsDecompositionSchema,
    apiFn: api.calcErbsDecomposition,
    fields: [
      { name: "ghi", labelKey: "ghi", type: "number", step: "any", defaultValue: 800, unit: "W/m²" },
      { name: "zenith_deg", labelKey: "zenith", type: "number", step: "any", defaultValue: 30, unit: "°" },
      { name: "day_of_year", labelKey: "daysOfYear", type: "number", defaultValue: 172 },
    ],
  },
  // --- Geometry ---
  {
    id: "angle-of-incidence",
    titleKey: "angle_of_incidence",
    icon: Target,
    groupKey: "geometry",
    schema: schemas.angleOfIncidenceSchema,
    apiFn: api.calcAngleOfIncidence,
    fields: [
      { name: "surface_tilt", labelKey: "tilt", type: "number", step: "any", defaultValue: 30, unit: "°" },
      { name: "surface_azimuth", labelKey: "azimuth", type: "number", step: "any", defaultValue: 180, unit: "°" },
      { name: "solar_zenith", labelKey: "solarZenith", type: "number", step: "any", defaultValue: 30, unit: "°" },
      { name: "solar_azimuth", labelKey: "solarAzimuth", type: "number", step: "any", defaultValue: 180, unit: "°" },
    ],
  },
  {
    id: "optimal-tilt",
    titleKey: "optimal_tilt",
    icon: Triangle,
    groupKey: "geometry",
    schema: schemas.optimalTiltSchema,
    apiFn: api.calcOptimalTilt,
    fields: [
      { name: "latitude", labelKey: "latitude", type: "number", step: "any", defaultValue: 38.42, unit: "°" },
    ],
  },
  {
    id: "poa-irradiance",
    titleKey: "poa_irradiance",
    icon: Layers,
    groupKey: "geometry",
    schema: schemas.poaIrradianceSchema,
    apiFn: api.calcPoaIrradiance,
    fields: [
      { name: "ghi", labelKey: "ghi", type: "number", step: "any", defaultValue: 800, unit: "W/m²" },
      { name: "dni", labelKey: "dni", type: "number", step: "any", defaultValue: 600, unit: "W/m²" },
      { name: "dhi", labelKey: "dhi", type: "number", step: "any", defaultValue: 200, unit: "W/m²" },
      { name: "surface_tilt", labelKey: "tilt", type: "number", step: "any", defaultValue: 30, unit: "°" },
      { name: "surface_azimuth", labelKey: "azimuth", type: "number", step: "any", defaultValue: 180, unit: "°" },
      { name: "solar_zenith", labelKey: "solarZenith", type: "number", step: "any", defaultValue: 30, unit: "°" },
      { name: "solar_azimuth", labelKey: "solarAzimuth", type: "number", step: "any", defaultValue: 180, unit: "°" },
      { name: "albedo", labelKey: "albedo", type: "number", step: "0.01", defaultValue: 0.2 },
    ],
  },
];

/* ═══════════════════════════════════════════════════════
   ToolCard Component
   ═══════════════════════════════════════════════════════ */

function ToolCard({ tool }: { tool: ToolDef }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaults: Record<string, any> = {};
  for (const f of tool.fields) {
    defaults[f.name] = f.defaultValue ?? "";
  }

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm({
    resolver: zodResolver(tool.schema),
    defaultValues: defaults,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await tool.apiFn(data);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solarhesap_${tool.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Icon = tool.icon;

  return (
    <GlassCard id={`tool-${tool.id}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-12 w-full">
        {/* Left / Middle: Input Section */}
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 flex-shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{t(`calculation.tools.${tool.titleKey}.title` as any)}</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t(`calculation.tools.${tool.titleKey}.desc` as any)}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {tool.fields.map((field) => (
                <div key={field.name} className={tool.fields.length === 1 ? "col-span-2" : ""}>
                  <label className="input-label text-[10px]">
                    {t(`calculation.fields.${field.labelKey}` as any) || field.labelKey}
                    {field.unit && <span className="text-slate-600 ml-1">({field.unit})</span>}
                  </label>
                  {field.type === "select" ? (
                    <select {...register(field.name)} className="select-field text-xs py-2 w-full">
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...register(field.name, { valueAsNumber: field.type === "number" })}
                      type={field.type}
                      step={field.step || "any"}
                      className="input-field text-xs py-2 w-full"
                    />
                  )}
                  {formErrors[field.name] && (
                    <p className="text-[10px] text-red-400 mt-0.5">
                      {formErrors[field.name]?.message as string}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading} className="btn-primary text-xs py-2.5 w-full mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
                  {t("common.loading")}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  {t("calculation.calculate")}
                </span>
              )}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Right: Output Section */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-slate-300">{t("calculation.output")}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!result}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300"
              >
                {copied ? (
                  <><Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">{t("calculation.copied")}</span></>
                ) : (
                  <><Copy className="h-3 w-3" />{t("calculation.copyAll")}</>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!result}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300"
              >
                <Download className="h-3 w-3" />{t("calculation.downloadAll")}
              </button>
            </div>
          </div>

          <div className="flex-1 bg-black/20 rounded-xl border border-white/[0.04] p-4 overflow-x-auto">
            {!result ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                {t("calculation.runToSee")}
              </div>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(result).map(([key, value]) => (
                    <tr key={key}>
                      <td className="py-1.5 pr-4 font-mono text-amber-400/80 whitespace-nowrap align-top">
                        {key}
                      </td>
                      <td className="py-1.5 font-mono text-slate-200 break-all">
                        {typeof value === "number"
                          ? Number.isInteger(value) ? value : value.toFixed(6)
                          : typeof value === "object"
                          ? JSON.stringify(value, null, 1)
                          : String(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */

export default function CalculationPage() {
  const { t, language } = useLanguage();
  const [filterGroup, setFilterGroup] = useState<string | null>(null);

  const GROUPS = [
    { id: "dateTime", label: t("calculation.groups.dateTime"), emoji: "📅" },
    { id: "solarPos", label: t("calculation.groups.solarPos"), emoji: "☀️" },
    { id: "atmosphere", label: t("calculation.groups.atmosphere"), emoji: "🌪️" },
    { id: "irradiance", label: t("calculation.groups.irradiance"), emoji: "💡" },
    { id: "geometry", label: t("calculation.groups.geometry"), emoji: "📐" },
  ];

  const filtered = filterGroup
    ? TOOLS.filter((t) => t.groupKey === filterGroup)
    : TOOLS;

  return (
    <div className="min-h-screen bg-mesh">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            {language === "tr" ? "Güneş" : "Solar"} <span className="text-gradient-solar">{t("calculation.title").replace("Solar", "").replace("Güneş", "").trim()}</span>
          </h1>
          <p className="text-slate-400 max-w-2xl">
            {t("calculation.subtitle")}
          </p>
        </div>

        {/* Group Filter */}
        <div className="flex flex-wrap gap-2 mb-8 animate-slide-up">
          <button
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              !filterGroup
                ? "bg-amber-400/15 text-amber-400 border border-amber-400/20"
                : "text-slate-400 border border-white/[0.06] hover:border-white/[0.12]"
            }`}
            onClick={() => setFilterGroup(null)}
          >
            {language === "tr" ? "Hepsi" : "All"} ({TOOLS.length})
          </button>
          {GROUPS.map((g) => {
            const count = TOOLS.filter((tool) => tool.groupKey === g.id).length;
            return (
              <button
                key={g.id}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filterGroup === g.id
                    ? "bg-amber-400/15 text-amber-400 border border-amber-400/20"
                    : "text-slate-400 border border-white/[0.06] hover:border-white/[0.12]"
                }`}
                onClick={() => setFilterGroup(filterGroup === g.id ? null : g.id)}
              >
                {g.emoji} {g.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Tool Stack — vertical, full width */}
        <div className="flex flex-col gap-5 animate-slide-up">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}
