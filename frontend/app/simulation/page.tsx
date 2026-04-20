"use client";

import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sun,
  Layers,
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";

import GlassCard from "@/components/shared/GlassCard";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import WarningBanner from "@/components/shared/WarningBanner";
import MapPicker from "@/components/simulation/MapPicker";
import ResultsPanel from "@/components/simulation/ResultsPanel";
import DrillDownChart from "@/components/charts/DrillDownChart";
import ComparisonChart from "@/components/charts/ComparisonChart";
import ModelChainChart from "@/components/charts/ModelChainChart";

import {
  SOLAR_MODELS,
  DEEP_COMPARISON_MODELS,
  AVG_YEAR_STRATEGIES,
  DC_MODELS,
  AC_MODELS,
  AOI_MODELS,
  SPECTRAL_MODELS,
  TEMPERATURE_MODELS,
  LOSSES_MODELS,
  RACKING_MODELS,
  MODULE_TYPES,
  TIMEZONES,
  DEFAULTS,
} from "@/lib/constants";

import * as api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

/* ─── Main Page Component ──────────────────────────────── */

export default function SimulationPage() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("individual");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const TABS = [
    { id: "individual", label: t("simulation.tabs.individual"), icon: Sun },
    { id: "comparison", label: t("simulation.tabs.comparison"), icon: Layers },
    { id: "modelchain", label: t("simulation.tabs.modelchain"), icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-mesh">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            {language === "tr" ? "Güneş" : "Solar"} <span className="text-gradient-solar">{language === "tr" ? "Simülasyonu" : "Simulation"}</span>
          </h1>
          <p className="text-slate-400 max-w-2xl">
            {t("simulation.subtitle")}
          </p>
        </div>

        {/* Tabs */}
        <div className="tab-list mb-8 animate-slide-up">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setResults(null);
                  setError(null);
                }}
                id={`tab-${tab.id}`}
              >
                <Icon className="h-4 w-4 inline mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <LoadingOverlay visible={loading} message={loadingMsg} />

        {/* Tab Content */}
        {activeTab === "individual" && (
          <IndividualTab
            setLoading={setLoading}
            setLoadingMsg={setLoadingMsg}
            setResults={setResults}
            setError={setError}
            results={results}
            error={error}
          />
        )}
        {activeTab === "comparison" && (
          <ComparisonTab
            setLoading={setLoading}
            setLoadingMsg={setLoadingMsg}
            setResults={setResults}
            setError={setError}
            results={results}
            error={error}
          />
        )}
        {activeTab === "modelchain" && (
          <ModelChainTab
            setLoading={setLoading}
            setLoadingMsg={setLoadingMsg}
            setResults={setResults}
            setError={setError}
            results={results}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Tab Components ───────────────────────────────────── */

interface TabProps {
  setLoading: (l: boolean) => void;
  setLoadingMsg: (m: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setResults: (r: Record<string, any> | null) => void;
  setError: (e: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: Record<string, any> | null;
  error: string | null;
}

/* ═══════════════════════════════════════════════════════
   TAB 1: Individual Model
   ═══════════════════════════════════════════════════════ */

function IndividualTab(props: TabProps) {
  const { t, language } = useLanguage();
  const { setLoading, setLoadingMsg, setResults, setError, results, error } = props;
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Zod schemas remain the same (logic doesn't change)
  const individualSchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    elevation: z.coerce.number().min(-450).max(8850).default(0),
    model: z.string().default("ineichen"),
    start_year: z.coerce.number().int().min(2005).max(2025),
    end_year: z.coerce.number().int().min(2005).max(2025),
    timezone: z.string().default("UTC"),
    avg_year_strategies: z.array(z.string()).min(1),
    decay: z.coerce.number().gt(0).lt(1),
    lower_percentile: z.coerce.number().min(0).max(50),
    upper_percentile: z.coerce.number().min(50).max(100),
    ozone: z.coerce.number().min(0).max(1),
    aod500: z.coerce.number().min(0).max(2),
    aod380: z.coerce.number().min(0).max(2),
    aod700: z.coerce.number().min(0).max(0.45),
    albedo: z.coerce.number().min(0).max(1),
    asymmetry: z.coerce.number().min(0).max(1),
    solar_constant: z.coerce.number().positive(),
    surface_tilt: z.coerce.number().min(0).max(90),
    surface_azimuth: z.coerce.number().min(0).max(360),
    usehorizon: z.boolean(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(individualSchema),
    defaultValues: {
      latitude: 38.42,
      longitude: 27.14,
      elevation: DEFAULTS.elevation,
      model: "ineichen",
      start_year: DEFAULTS.start_year,
      end_year: DEFAULTS.end_year,
      timezone: DEFAULTS.timezone,
      avg_year_strategies: ["combined"],
      decay: DEFAULTS.decay,
      lower_percentile: DEFAULTS.lower_percentile,
      upper_percentile: DEFAULTS.upper_percentile,
      ozone: DEFAULTS.ozone,
      aod500: DEFAULTS.aod500,
      aod380: DEFAULTS.aod380,
      aod700: DEFAULTS.aod700,
      albedo: DEFAULTS.albedo,
      asymmetry: DEFAULTS.asymmetry,
      solar_constant: DEFAULTS.solar_constant,
      surface_tilt: DEFAULTS.surface_tilt,
      surface_azimuth: DEFAULTS.surface_azimuth,
      usehorizon: true,
    },
  });

  const lat = watch("latitude");
  const lng = watch("longitude");
  const model = watch("model");
  const strategies = watch("avg_year_strategies");

  const handleMapChange = useCallback(
    (newLat: number, newLng: number) => {
      setValue("latitude", newLat, { shouldValidate: true });
      setValue("longitude", newLng, { shouldValidate: true });
    },
    [setValue]
  );

  const handleStrategyToggle = (strategy: string) => {
    if (strategy === "all") {
      setValue("avg_year_strategies", strategies?.includes("all") ? [] : ["all"], { shouldValidate: true });
    } else {
      if (strategies?.includes("all")) {
        setValue("avg_year_strategies", [strategy], { shouldValidate: true });
      } else {
        const current = strategies || [];
        setValue(
          "avg_year_strategies",
          current.includes(strategy) ? current.filter((s) => s !== strategy) : [...current, strategy],
          { shouldValidate: true }
        );
      }
    }
  };

  const isPvgis = model === "pvgis_tmy" || model === "pvgis_poa";
  const showCombinedWarning = strategies?.includes("combined") || strategies?.includes("all");

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    setResults(null);
    const modelLabel = (t(`constants.models.${data.model}.label` as any) || data.model);
    setLoadingMsg(`${t("common.loading")} (${modelLabel})...`);

    try {
      const { model: selectedModel, ...payload } = data;
      if (selectedModel === "pvgis_tmy") {
        payload.avg_year_strategies = [];
      }
      const apiMap: Record<string, (d: typeof payload) => Promise<unknown>> = {
        instesre_bird: api.runInstesreBird,
        ineichen: api.runIneichen,
        simplified_solis: api.runSimplifiedSolis,
        pvlib_bird: api.runPvlibBird,
        pvgis_tmy: api.runPvgisTmy,
        pvgis_poa: api.runPvgisPoa,
      };

      const fn = apiMap[selectedModel];
      const result = await fn(payload) as Record<string, any>;
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-slide-up">
      {/* Map & Location */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">📍 {t("simulation.common.location")}</h2>
        <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="input-label">{t("simulation.common.lat")}</label>
            <input {...register("latitude")} type="number" step="any" className="input-field" id="ind-lat" />
            {errors.latitude && <p className="text-xs text-red-100 mt-1">{errors.latitude.message as string}</p>}
          </div>
          <div>
            <label className="input-label">{t("simulation.common.lng")}</label>
            <input {...register("longitude")} type="number" step="any" className="input-field" id="ind-lng" />
            {errors.longitude && <p className="text-xs text-red-100 mt-1">{errors.longitude.message as string}</p>}
          </div>
          <div>
            <label className="input-label">{t("simulation.common.elev")}</label>
            <input {...register("elevation")} type="number" step="any" className="input-field" id="ind-elev" />
          </div>
        </div>
      </GlassCard>

      {/* Model Selection */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">⚡ {t("simulation.individual.title")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="input-label">{t("simulation.individual.solarModel")}</label>
            <select {...register("model")} className="select-field" id="ind-model">
              {SOLAR_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{t(`constants.models.${m.value}.label` as any)}</option>
              ))}
            </select>
          </div>
          {!isPvgis && (
            <>
              <div>
                <label className="input-label">{t("simulation.individual.startYear")}</label>
                <input {...register("start_year")} type="number" className="input-field" id="ind-start" />
                {errors.start_year && <p className="text-xs text-red-100 mt-1">{errors.start_year.message as string}</p>}
              </div>
              <div>
                <label className="input-label">{t("simulation.individual.endYear")}</label>
                <input {...register("end_year")} type="number" className="input-field" id="ind-end" />
                {errors.end_year && <p className="text-xs text-red-100 mt-1">{errors.end_year.message as string}</p>}
              </div>
              <div>
                <label className="input-label">{t("simulation.individual.timezone")}</label>
                <select {...register("timezone")} className="select-field" id="ind-tz">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </GlassCard>

      {/* Avg Year Strategies */}
      {!isPvgis && (
        <GlassCard>
          <h2 className="section-heading text-lg mb-4">📊 {t("simulation.individual.strategiesTitle")}</h2>
          {showCombinedWarning && (
            <WarningBanner
              type="warning"
              message={t("simulation.individual.strategyWarning")}
              className="mb-4"
            />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AVG_YEAR_STRATEGIES.map((s) => (
              <label
                key={s.value}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                  strategies?.includes(s.value)
                    ? "border-amber-400/30 bg-amber-400/[0.06]"
                    : "border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={strategies?.includes(s.value)}
                  onChange={() => handleStrategyToggle(s.value)}
                  className="accent-amber-400 w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-slate-200">{t(`constants.strategies.${s.value}.label` as any)}</p>
                  <p className="text-xs text-slate-500">{t(`constants.strategies.${s.value}.desc` as any)}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="input-label">{language === "tr" ? "Azalma Faktörü" : "Decay Factor"}</label>
              <input {...register("decay")} type="number" step="0.01" className="input-field" />
            </div>
            <div>
              <label className="input-label">{language === "tr" ? "Alt Yüzdelik (%)" : "Lower Percentile (%)"}</label>
              <input {...register("lower_percentile")} type="number" className="input-field" />
            </div>
            <div>
              <label className="input-label">{language === "tr" ? "Üst Yüzdelik (%)" : "Upper Percentile (%)"}</label>
              <input {...register("upper_percentile")} type="number" className="input-field" />
            </div>
          </div>
        </GlassCard>
      )}

      {/* Advanced Atmospheric Params (collapsible) */}
      {!isPvgis && (
        <GlassCard>
          <button
            type="button"
            className="flex items-center justify-between w-full"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <h2 className="section-heading text-lg">🌍 {t("simulation.individual.atmosphereTitle")}</h2>
            {showAdvanced ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4 animate-fade-in">
              <div>
                <label className="input-label">{language === "tr" ? "Ozon (atm-cm)" : "Ozone (atm-cm)"}</label>
                <input {...register("ozone")} type="number" step="0.01" className="input-field" />
              </div>
              <div><label className="input-label">AOD 500nm</label><input {...register("aod500")} type="number" step="0.01" className="input-field" /></div>
              <div><label className="input-label">AOD 380nm</label><input {...register("aod380")} type="number" step="0.01" className="input-field" /></div>
              <div><label className="input-label">AOD 700nm</label><input {...register("aod700")} type="number" step="0.01" className="input-field" /></div>
              <div><label className="input-label">{language === "tr" ? "Albedo (Yansıtma)" : "Albedo"}</label><input {...register("albedo")} type="number" step="0.01" className="input-field" /></div>
              <div><label className="input-label">{language === "tr" ? "Asimetri" : "Asymmetry"}</label><input {...register("asymmetry")} type="number" step="0.01" className="input-field" /></div>
              <div><label className="input-label">{language === "tr" ? "Güneş Sabiti" : "Solar Constant"} (W/m²)</label><input {...register("solar_constant")} type="number" step="0.1" className="input-field" /></div>
            </div>
          )}
        </GlassCard>
      )}

      {/* PVGIS POA specific */}
      {model === "pvgis_poa" && (
        <GlassCard>
          <h2 className="section-heading text-lg mb-4">📐 {t("simulation.individual.pvgisTitle")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="input-label">{t("simulation.common.tilt")}</label>
              <input {...register("surface_tilt")} type="number" className="input-field" />
            </div>
            <div>
              <label className="input-label">{t("simulation.common.azimuth")}</label>
              <input {...register("surface_azimuth")} type="number" className="input-field" />
            </div>
            <div className="col-span-2 flex items-center gap-4 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input {...register("usehorizon")} type="checkbox" className="accent-amber-400 w-4 h-4" />
                <span className="text-sm text-slate-300">{t("simulation.common.horizon")}</span>
              </label>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary text-base px-8 py-3.5" id="run-individual-btn">
          <Play className="h-4 w-4" />
          {t("simulation.individual.run")}
        </button>
      </div>

      {/* Charts */}
      {results?.results && (
        <IndividualChartSection results={results} />
      )}

      {/* Raw Results */}
      <ResultsPanel data={results} error={error} isLoading={false} />
    </form>
  );
}

/* Strategy-switchable chart wrapper */
function IndividualChartSection({ results }: { results: Record<string, any> }) {
  const { t, language } = useLanguage();
  const strategyKeys = Object.keys(results.results || {});
  const [activeStrategies, setActiveStrategies] = useState<Set<string>>(
    new Set(strategyKeys.length > 0 ? [strategyKeys[0]] : [])
  );

  const toggleStrategy = (s: string) => {
    setActiveStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(s) && next.size > 1) {
        next.delete(s);
      } else if (!next.has(s)) {
        next.add(s);
      }
      return next;
    });
  };

  if (!strategyKeys.length || activeStrategies.size === 0) return null;

  let chartContent = null;
  
  if (activeStrategies.size === 1) {
    const activeStrategy = Array.from(activeStrategies)[0];
    const hourly = results.results?.[activeStrategy]?.hourly;
    if (hourly?.length) {
      chartContent = (
        <DrillDownChart
          hourlyData={hourly}
          title={`${results.model || "Model"} — ${t(`constants.strategies.${activeStrategy}.label` as any) || activeStrategy}`}
        />
      );
    }
  } else {
    const fakeComparisonData: Record<string, any> = {};
    activeStrategies.forEach((strat) => {
      if (results.results[strat]?.hourly) {
        fakeComparisonData[strat] = {
          results: { "hourly": results.results[strat].hourly }
        };
      }
    });

    chartContent = (
      <ComparisonChart
        comparisonData={fakeComparisonData}
        defaultMode="timeseries"
      />
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {strategyKeys.length > 1 && (
        <GlassCard>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">📊 {t("simulation.individual.selectStrategies")}</h3>
            {activeStrategies.size > 1 && (
              <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
                {language === "tr" ? "HIZLI KARŞILAŞTIRMA MODU AKTİF" : "Multi-Strategy Comparison Mode Active"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {strategyKeys.map((s) => {
              const isActive = activeStrategies.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStrategy(s); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                    isActive
                      ? "border-amber-400/40 bg-amber-400/15 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                      : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.15] hover:text-slate-200"
                  }`}
                >
                  {t(`constants.strategies.${s}.label` as any) || s}
                </button>
              );
            })}
          </div>
        </GlassCard>
      )}
      {chartContent}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 2: Deep Comparison
   ═══════════════════════════════════════════════════════ */

function ComparisonTab(props: TabProps) {
  const { t, language } = useLanguage();
  const { setLoading, setLoadingMsg, setResults, setError, results, error } = props;

  // Schema for Comparison
  const comparisonSchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    elevation: z.coerce.number().min(-450).max(8850),
    start_year: z.coerce.number().int().min(2005).max(2025),
    end_year: z.coerce.number().int().min(2005).max(2025),
    timezone: z.string(),
    avg_year_strategies: z.array(z.string()).min(1),
    decay: z.coerce.number().gt(0).lt(1),
    lower_percentile: z.coerce.number().min(0).max(50),
    upper_percentile: z.coerce.number().min(50).max(100),
    models: z.array(z.string()).min(1),
    include_pvgis_tmy: z.boolean(),
    include_pvgis_poa: z.boolean(),
    ozone: z.coerce.number().min(0).max(1),
    aod500: z.coerce.number().min(0).max(2),
    aod380: z.coerce.number().min(0).max(2),
    aod700: z.coerce.number().min(0).max(0.45),
    albedo: z.coerce.number().min(0).max(1),
    asymmetry: z.coerce.number().min(0).max(1),
    solar_constant: z.coerce.number().positive(),
    surface_tilt: z.coerce.number().min(0).max(90),
    surface_azimuth: z.coerce.number().min(0).max(360),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(comparisonSchema),
    defaultValues: {
      latitude: 38.42,
      longitude: 27.14,
      elevation: 0,
      start_year: DEFAULTS.start_year,
      end_year: DEFAULTS.end_year,
      timezone: DEFAULTS.timezone,
      avg_year_strategies: ["combined"],
      decay: DEFAULTS.decay,
      lower_percentile: DEFAULTS.lower_percentile,
      upper_percentile: DEFAULTS.upper_percentile,
      models: ["instesre_bird", "ineichen", "simplified_solis", "pvlib_bird"],
      include_pvgis_tmy: true,
      include_pvgis_poa: false,
      ozone: DEFAULTS.ozone,
      aod500: DEFAULTS.aod500,
      aod380: DEFAULTS.aod380,
      aod700: DEFAULTS.aod700,
      albedo: DEFAULTS.albedo,
      asymmetry: DEFAULTS.asymmetry,
      solar_constant: DEFAULTS.solar_constant,
      surface_tilt: DEFAULTS.surface_tilt,
      surface_azimuth: DEFAULTS.surface_azimuth,
    },
  });

  const lat = watch("latitude");
  const lng = watch("longitude");
  const models = watch("models");
  const strategies = watch("avg_year_strategies");

  const handleMapChange = useCallback(
    (newLat: number, newLng: number) => {
      setValue("latitude", newLat, { shouldValidate: true });
      setValue("longitude", newLng, { shouldValidate: true });
    },
    [setValue]
  );

  const handleModelToggle = (model: string) => {
    const current = models || [];
    if (current.includes(model)) {
      setValue("models", current.filter((m) => m !== model), { shouldValidate: true });
    } else {
      setValue("models", [...current, model], { shouldValidate: true });
    }
  };

  const handleStrategyToggle = (strategy: string) => {
    if (strategy === "all") {
      setValue("avg_year_strategies", strategies?.includes("all") ? [] : ["all"], { shouldValidate: true });
    } else {
      if (strategies?.includes("all")) {
        setValue("avg_year_strategies", [strategy], { shouldValidate: true });
      } else {
        const current = strategies || [];
        setValue(
          "avg_year_strategies",
          current.includes(strategy) ? current.filter((s) => s !== strategy) : [...current, strategy],
          { shouldValidate: true }
        );
      }
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setLoadingMsg(t("simulation.common.loading"));

    try {
      const result = await api.runDeepComparison(data) as Record<string, any>;
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-slide-up">
      <WarningBanner
        type="time"
        message={t("simulation.comparison.warning")}
      />

      {/* Map & Location */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">📍 {t("simulation.common.location")}</h2>
        <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="input-label">{t("simulation.common.lat")}</label>
            <input {...register("latitude")} type="number" step="any" className="input-field" />
            {errors.latitude && <p className="text-xs text-red-100 mt-1">{errors.latitude.message as string}</p>}
          </div>
          <div><label className="input-label">{t("simulation.common.lng")}</label><input {...register("longitude")} type="number" step="any" className="input-field" /></div>
          <div><label className="input-label">{t("simulation.common.elev")}</label><input {...register("elevation")} type="number" step="any" className="input-field" /></div>
        </div>
      </GlassCard>

      {/* Model Selection Matrix */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">⚡ {t("simulation.comparison.modelsTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {DEEP_COMPARISON_MODELS.map((m) => (
            <label
              key={m.value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                models?.includes(m.value)
                  ? "border-amber-400/30 bg-amber-400/[0.06]"
                  : "border-white/[0.06] hover:border-white/[0.12]"
              }`}
            >
              <input
                type="checkbox"
                checked={models?.includes(m.value)}
                onChange={() => handleModelToggle(m.value)}
                className="accent-amber-400 w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-200">{t(`constants.models.${m.value}.label` as any)}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input {...register("include_pvgis_tmy")} type="checkbox" className="accent-amber-400 w-4 h-4" />
            <span className="text-sm text-slate-300">{t("simulation.comparison.includePvgisTmy")}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input {...register("include_pvgis_poa")} type="checkbox" className="accent-amber-400 w-4 h-4" />
            <span className="text-sm text-slate-300">{t("simulation.comparison.includePvgisPoa")}</span>
          </label>
        </div>
      </GlassCard>

      {/* Date Range */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">📅 {t("simulation.individual.title")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div><label className="input-label">{t("simulation.individual.startYear")}</label><input {...register("start_year")} type="number" className="input-field" /></div>
          <div><label className="input-label">{t("simulation.individual.endYear")}</label><input {...register("end_year")} type="number" className="input-field" /></div>
          <div>
            <label className="input-label">{t("simulation.individual.timezone")}</label>
            <select {...register("timezone")} className="select-field">
              {TIMEZONES.map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {AVG_YEAR_STRATEGIES.map((s) => (
            <label
              key={s.value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                strategies?.includes(s.value)
                  ? "border-amber-400/30 bg-amber-400/[0.06]"
                  : "border-white/[0.06] hover:border-white/[0.12]"
              }`}
            >
              <input
                type="checkbox"
                checked={strategies?.includes(s.value)}
                onChange={() => handleStrategyToggle(s.value)}
                className="accent-amber-400 w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-200">{t(`constants.strategies.${s.value}.label` as any)}</span>
            </label>
          ))}
        </div>
      </GlassCard>

      {/* Submit */}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary text-base px-8 py-3.5" id="run-comparison-btn">
          <Layers className="h-4 w-4" />
          {t("simulation.comparison.run")}
        </button>
      </div>

      {/* Comparison Charts */}
      {results?.comparison && (
        <ComparisonChart
          comparisonData={results.comparison}
          summaryMatrix={results.summary_matrix}
        />
      )}

      <ResultsPanel data={results} error={error} isLoading={false} />
    </form>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB 3: ModelChain
   ═══════════════════════════════════════════════════════ */

function ModelChainTab(props: TabProps) {
  const { t, language } = useLanguage();
  const { setLoading, setLoadingMsg, setResults, setError, results, error } = props;
  const [showMCConfig, setShowMCConfig] = useState(false);
  const [showAtmospheric, setShowAtmospheric] = useState(false);

  // Schema for ModelChain
  const modelChainSchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    altitude: z.coerce.number().min(-450).max(8850).optional(),
    tz: z.string().optional(),
    location_name: z.string().optional(),
    surface_tilt: z.coerce.number().min(0).max(90),
    surface_azimuth: z.coerce.number().min(0).max(360),
    module_pdc0: z.coerce.number().positive(),
    module_gamma_pdc: z.coerce.number(),
    inverter_pdc0: z.coerce.number().positive(),
    inverter_eta_inv_nom: z.coerce.number().min(0).max(1),
    temp_a: z.coerce.number(),
    temp_b: z.coerce.number(),
    temp_deltaT: z.coerce.number(),
    modules_per_string: z.coerce.number().int().positive(),
    strings_per_inverter: z.coerce.number().int().positive(),
    racking_model: z.string(),
    module_type: z.string(),
    dc_model: z.string().optional(),
    ac_model: z.string().optional(),
    aoi_model: z.string().optional(),
    spectral_model: z.string().optional(),
    temperature_model: z.string().optional(),
    losses_model: z.string().optional(),
    weather_source: z.string(),
    start_year: z.coerce.number().int().min(2005).max(2025),
    end_year: z.coerce.number().int().min(2005).max(2025),
    timezone: z.string(),
    avg_year_strategies: z.array(z.string()).min(1),
    decay: z.coerce.number().gt(0).lt(1),
    lower_percentile: z.coerce.number().min(0).max(50),
    upper_percentile: z.coerce.number().min(50).max(100),
    ozone: z.coerce.number().min(0).max(1),
    aod500: z.coerce.number().min(0).max(2),
    aod380: z.coerce.number().min(0).max(2),
    aod700: z.coerce.number().min(0).max(0.45),
    albedo: z.coerce.number().min(0).max(1),
    asymmetry: z.coerce.number().min(0).max(1),
    solar_constant: z.coerce.number().positive(),
    usehorizon: z.boolean(),
    arrays: z
      .array(
        z.object({
          module_type: z.string(),
          pdc0: z.coerce.number().positive().optional(),
          gamma_pdc: z.coerce.number().optional(),
          temp_a: z.coerce.number().optional(),
          temp_b: z.coerce.number().optional(),
          temp_deltaT: z.coerce.number().optional(),
          modules_per_string: z.coerce.number().int().positive(),
          strings: z.coerce.number().int().positive(),
          name: z.string().optional(),
        })
      )
      .optional(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(modelChainSchema),
    defaultValues: {
      latitude: 38.42,
      longitude: 27.14,
      altitude: 0,
      tz: "UTC",
      location_name: "",
      surface_tilt: 30,
      surface_azimuth: 180,
      module_pdc0: 250,
      module_gamma_pdc: -0.004,
      inverter_pdc0: 5000,
      inverter_eta_inv_nom: 0.96,
      temp_a: -3.56,
      temp_b: -0.075,
      temp_deltaT: 3,
      modules_per_string: DEFAULTS.modules_per_string,
      strings_per_inverter: DEFAULTS.strings_per_inverter,
      racking_model: "open_rack",
      module_type: "glass_polymer",
      dc_model: "pvwatts",
      ac_model: "pvwatts",
      aoi_model: "no_loss",
      spectral_model: "no_loss",
      temperature_model: "",
      losses_model: "no_loss",
      weather_source: "ineichen",
      start_year: DEFAULTS.start_year,
      end_year: DEFAULTS.end_year,
      timezone: DEFAULTS.timezone,
      avg_year_strategies: ["combined"],
      decay: DEFAULTS.decay,
      lower_percentile: DEFAULTS.lower_percentile,
      upper_percentile: DEFAULTS.upper_percentile,
      ozone: DEFAULTS.ozone,
      aod500: DEFAULTS.aod500,
      aod380: DEFAULTS.aod380,
      aod700: DEFAULTS.aod700,
      albedo: DEFAULTS.albedo,
      asymmetry: DEFAULTS.asymmetry,
      solar_constant: DEFAULTS.solar_constant,
      usehorizon: true,
      arrays: [] as any[],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "arrays" });

  const lat = watch("latitude");
  const lng = watch("longitude");
  const strategies = watch("avg_year_strategies");
  const weatherSource = watch("weather_source");

  const handleMapChange = useCallback((newLat: number, newLng: number) => {
    setValue("latitude", newLat, { shouldValidate: true });
    setValue("longitude", newLng, { shouldValidate: true });
  }, [setValue]);

  const handleStrategyToggle = (strategy: string) => {
    if (strategy === "all") {
      setValue("avg_year_strategies", strategies?.includes("all") ? [] : ["all"], { shouldValidate: true });
    } else {
      if (strategies?.includes("all")) {
        setValue("avg_year_strategies", [strategy], { shouldValidate: true });
      } else {
        const current = strategies || [];
        setValue(
          "avg_year_strategies",
          current.includes(strategy) ? current.filter((s) => s !== strategy) : [...current, strategy],
          { shouldValidate: true }
        );
      }
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setLoadingMsg("Running ModelChain simulation...");

    try {
      // Re-map to API payload logic... (same as original)
      const payload = {
        location: {
          latitude: data.latitude, longitude: data.longitude, tz: data.tz || undefined, altitude: data.altitude || undefined, name: data.location_name || undefined,
        },
        pvsystem: {
          surface_tilt: data.surface_tilt, surface_azimuth: data.surface_azimuth,
          module_parameters: { pdc0: data.module_pdc0, gamma_pdc: data.module_gamma_pdc },
          inverter_parameters: { pdc0: data.inverter_pdc0, eta_inv_nom: data.inverter_eta_inv_nom },
          temperature_model_parameters: { a: data.temp_a, b: data.temp_b, deltaT: data.temp_deltaT },
          modules_per_string: data.modules_per_string, strings_per_inverter: data.strings_per_inverter,
          racking_model: data.racking_model, module_type: data.module_type,
          arrays: data.arrays && data.arrays.length > 0 ? data.arrays.map((arr: any) => ({
            module_type: arr.module_type,
            module_parameters: arr.pdc0 ? { pdc0: arr.pdc0, gamma_pdc: arr.gamma_pdc } : undefined,
            temperature_model_parameters: arr.temp_a != null ? { a: arr.temp_a, b: arr.temp_b, deltaT: arr.temp_deltaT } : undefined,
            modules_per_string: arr.modules_per_string, strings: arr.strings, name: arr.name || undefined,
          })) : undefined,
        },
        modelchain_config: {
          dc_model: data.dc_model || undefined, ac_model: data.ac_model || undefined, aoi_model: data.aoi_model || undefined,
          spectral_model: data.spectral_model || undefined, temperature_model: data.temperature_model || undefined, losses_model: data.losses_model || undefined,
        },
        weather_source: data.weather_source, start_year: data.start_year, end_year: data.end_year, timezone: data.timezone,
        avg_year_strategies: data.weather_source === "pvgis_tmy" ? [] : data.avg_year_strategies,
        decay: data.decay, lower_percentile: data.lower_percentile, upper_percentile: data.upper_percentile,
        ozone: data.ozone, aod500: data.aod500, aod380: data.aod380, aod700: data.aod700, albedo: data.albedo, asymmetry: data.asymmetry, solar_constant: data.solar_constant, usehorizon: data.usehorizon,
      };

      const result = await api.runModelChain(payload) as Record<string, any>;
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-slide-up">
      <WarningBanner
        type="time"
        message={language === "tr" ? "Tam ModelChain simülasyonu — yapılandırmaya ve verisine göre 10–60 saniye sürebilir." : "Full ModelChain simulation — may take 10–60 seconds depending on configuration."}
      />

      {/* Location */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">📍 {t("simulation.common.location")}</h2>
        <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div><label className="input-label">{t("simulation.common.lat")}</label><input {...register("latitude")} type="number" step="any" className="input-field" /></div>
          <div><label className="input-label">{t("simulation.common.lng")}</label><input {...register("longitude")} type="number" step="any" className="input-field" /></div>
          <div><label className="input-label">{t("simulation.common.elev")}</label><input {...register("altitude")} type="number" step="any" className="input-field" /></div>
          <div><label className="input-label">{language === "tr" ? "Saha Adı" : "Site Name"}</label><input {...register("location_name")} type="text" className="input-field" /></div>
        </div>
      </GlassCard>

      {/* PV System Configuration */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">🔋 {t("simulation.modelchain.panelConfig")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div><label className="input-label">{t("simulation.common.tilt")}</label><input {...register("surface_tilt")} type="number" className="input-field" /></div>
          <div><label className="input-label">{t("simulation.common.azimuth")}</label><input {...register("surface_azimuth")} type="number" className="input-field" /></div>
          <div>
            <label className="input-label">{t("simulation.modelchain.rackingModel")}</label>
            <select {...register("racking_model")} className="select-field">
              {RACKING_MODELS.map((r) => (<option key={r.value} value={r.value}>{t(`constants.racking.${r.value}` as any)}</option>))}
            </select>
          </div>
          <div>
            <label className="input-label">{t("simulation.modelchain.moduleType")}</label>
            <select {...register("module_type")} className="select-field">
              {MODULE_TYPES.map((m) => (<option key={m.value} value={m.value}>{t(`constants.modules.${m.value}` as any)}</option>))}
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">{t("simulation.modelchain.moduleParams")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className="input-label">Pdc0 (W)</label><input {...register("module_pdc0")} type="number" step="any" className="input-field" /></div>
            <div><label className="input-label">Gamma Pdc (1/°C)</label><input {...register("module_gamma_pdc")} type="number" step="any" className="input-field" /></div>
            <div><label className="input-label">{language === "tr" ? "Modül/Dizi" : "Modules/String"}</label><input {...register("modules_per_string")} type="number" className="input-field" /></div>
            <div><label className="input-label">{language === "tr" ? "Dizi/Evirici" : "Strings/Inverter"}</label><input {...register("strings_per_inverter")} type="number" className="input-field" /></div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">{t("simulation.modelchain.invParams")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="input-label">Pdc0 (W)</label><input {...register("inverter_pdc0")} type="number" step="any" className="input-field" /></div>
            <div><label className="input-label">η Nominal</label><input {...register("inverter_eta_inv_nom")} type="number" step="0.01" className="input-field" /></div>
          </div>
        </div>
      </GlassCard>

      {/* Dynamic Arrays */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-heading text-lg">📐 {language === "tr" ? "PV Dizileri" : "PV Arrays"}</h2>
          <button type="button" className="btn-secondary text-xs" onClick={() => append({ module_type: "glass_polymer", modules_per_string: 1, strings: 1 })}>
            <Plus className="h-3 w-3" /> {t("simulation.modelchain.addArray")}
          </button>
        </div>
        {fields.length === 0 && <p className="text-sm text-slate-500">{t("simulation.modelchain.noArrays")}</p>}
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] relative">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-amber-400">{t("simulation.modelchain.arrayHeading")}{index + 1}</h4>
                <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-400/10"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="input-label">{t("simulation.modelchain.moduleType")}</label>
                  <select {...register(`arrays.${index}.module_type`)} className="select-field">
                    {MODULE_TYPES.map((m) => (<option key={m.value} value={m.value}>{t(`constants.modules.${m.value}` as any)}</option>))}
                  </select>
                </div>
                <div><label className="input-label">Pdc0 (W)</label><input {...register(`arrays.${index}.pdc0`)} type="number" className="input-field" /></div>
                <div><label className="input-label">{language === "tr" ? "Modül/Dizi" : "Modules/String"}</label><input {...register(`arrays.${index}.modules_per_string`)} type="number" className="input-field" /></div>
                <div><label className="input-label">{language === "tr" ? "Dizi Sayısı" : "Strings"}</label><input {...register(`arrays.${index}.strings`)} type="number" className="input-field" /></div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ModelChain Config */}
      <GlassCard>
        <button type="button" className="flex items-center justify-between w-full" onClick={() => setShowMCConfig(!showMCConfig)}>
          <h2 className="section-heading text-lg">⚙️ {t("simulation.modelchain.advancedConfig")}</h2>
          {showMCConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {showMCConfig && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 animate-fade-in">
            <div><label className="input-label">{t("simulation.modelchain.dcModel")}</label><select {...register("dc_model")} className="select-field"><option value="">Auto</option>{DC_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}</select></div>
            <div><label className="input-label">{t("simulation.modelchain.acModel")}</label><select {...register("ac_model")} className="select-field"><option value="">Auto</option>{AC_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}</select></div>
            <div><label className="input-label">{t("simulation.modelchain.aoiModel")}</label><select {...register("aoi_model")} className="select-field"><option value="">Auto</option>{AOI_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}</select></div>
            <div><label className="input-label">{t("simulation.modelchain.spectralModel")}</label><select {...register("spectral_model")} className="select-field"><option value="">Auto</option>{SPECTRAL_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}</select></div>
            <div><label className="input-label">{t("simulation.modelchain.tempModel")}</label><select {...register("temperature_model")} className="select-field"><option value="">Auto</option>{TEMPERATURE_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}</select></div>
            <div><label className="input-label">{t("simulation.modelchain.lossesModel")}</label><select {...register("losses_model")} className="select-field"><option value="">Auto</option>{LOSSES_MODELS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}</select></div>
          </div>
        )}
      </GlassCard>

      {/* Weather Source */}
      <GlassCard>
        <h2 className="section-heading text-lg mb-4">🌤️ {t("simulation.modelchain.weatherSource")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="input-label">{t("simulation.modelchain.weatherSource")}</label>
            <select {...register("weather_source")} className="select-field">
              {SOLAR_MODELS.map((m) => (<option key={m.value} value={m.value}>{t(`constants.models.${m.value}.label` as any)}</option>))}
            </select>
          </div>
          <div><label className="input-label">{t("simulation.individual.startYear")}</label><input {...register("start_year")} type="number" className="input-field" /></div>
          <div><label className="input-label">{t("simulation.individual.endYear")}</label><input {...register("end_year")} type="number" className="input-field" /></div>
          <div><label className="input-label">{t("simulation.individual.timezone")}</label>
            <select {...register("timezone")} className="select-field">
              {TIMEZONES.map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Submit */}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary text-base px-8 py-3.5" id="run-modelchain-btn">
          <Zap className="h-4 w-4" /> {t("simulation.modelchain.run")}
        </button>
      </div>

      {results?.simulation_results && <ModelChainChartSection results={results} />}
      <ResultsPanel data={results} error={error} isLoading={false} />
    </form>
  );
}
