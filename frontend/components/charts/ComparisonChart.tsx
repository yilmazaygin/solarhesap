"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { FileDown, BarChart3, TrendingUp, Eye, EyeOff, Activity } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface ComparisonChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comparisonData: Record<string, any>;
  summaryMatrix?: Record<string, Record<string, number | null>>;
  defaultMode?: ChartMode;
}

type ChartMode = "summary" | "timeseries";

const MODEL_COLORS: Record<string, string> = {
  instesre_bird: "#fbbf24",
  ineichen: "#38bdf8",
  simplified_solis: "#a78bfa",
  pvlib_bird: "#34d399",
  pvgis_tmy: "#f87171",
  pvgis_poa: "#fb923c",
};

const FALLBACK_COLORS = ["#fbbf24", "#38bdf8", "#34d399", "#a78bfa", "#f87171", "#f472b6"];
const STROKES = ["10 0", "5 5", "3 3", "8 4"]; // Differentiate overlapping lines

const ALL_METRICS = ["ghi", "dni", "dhi", "poa_global", "poa_direct", "poa_diffuse", "temp_air", "wind_speed"];

/* ═══════════════════════════════════════════════════════
   Tooltip
   ═══════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ComparisonTooltip({ active, payload, label, t }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.1] bg-slate-900/95 backdrop-blur-xl p-3 shadow-xl max-w-xs z-50">
      <p className="text-xs font-semibold text-slate-300 mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => {
        // Many entry.dataKey will be model labels, but some might be strings. 
        // We generally show them as is if they are already translated labels.
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400 truncate">{entry.dataKey}:</span>
            <span className="font-semibold text-white">
              {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(","), ...data.map((row) => keys.map((k) => row[k] ?? "").join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════
   Helper: Extract hourly & Date parsing
   ═══════════════════════════════════════════════════════ */

function safeParseDate(dt: string | number | Date): Date {
  if (dt instanceof Date) return dt;
  const str = String(dt);
  const match = str.match(/^(\d{4})(\d{2})(\d{2}):(\d{2})(\d{2})$/);
  if (match) {
    const [, y, m, d, h, min] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }
  return new Date(dt);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHourlyForModel(modelData: any, strategy: string): any[] | null {
  if (!modelData?.results) return null;
  if (modelData.results[strategy]?.hourly?.length) return modelData.results[strategy].hourly;
  if (modelData.results["tmy"]?.hourly?.length) return modelData.results["tmy"].hourly;
  if (modelData.results.hourly?.length) return modelData.results.hourly;
  for (const strat of Object.keys(modelData.results)) {
    if (modelData.results[strat]?.hourly?.length) return modelData.results[strat].hourly;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════
   ComparisonChart Component
   ═══════════════════════════════════════════════════════ */

export default function ComparisonChart({ comparisonData, summaryMatrix, defaultMode }: ComparisonChartProps) {
  const { t, language } = useLanguage();

  const MONTH_SHORT = useMemo(() => [
    language === "tr" ? "Oca" : "Jan",
    language === "tr" ? "Şub" : "Feb",
    language === "tr" ? "Mar" : "Mar",
    language === "tr" ? "Nis" : "Apr",
    language === "tr" ? "May" : "May",
    language === "tr" ? "Haz" : "Jun",
    language === "tr" ? "Tem" : "Jul",
    language === "tr" ? "Ağu" : "Aug",
    language === "tr" ? "Eyl" : "Sep",
    language === "tr" ? "Eki" : "Oct",
    language === "tr" ? "Kas" : "Nov",
    language === "tr" ? "Ara" : "Dec",
  ], [language]);

  // Chart Display Modes
  const [chartMode, setChartMode] = useState<ChartMode>(defaultMode || (summaryMatrix ? "summary" : "timeseries"));
  const [deltaMode, setDeltaMode] = useState(false);
  const [tsChartType, setTsChartType] = useState<"bar" | "line" | "area">("bar");
  
  // Drill-down State
  const [drillLevel, setDrillLevel] = useState<"annual" | "month" | "day">("annual");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Filters
  const [selectedStrategy, setSelectedStrategy] = useState<string>("combined");
  const [selectedMetric, setSelectedMetric] = useState<string>("ghi");
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set());

  /* ── Available metrics & strats ───────────────────── */
  const modelNames = useMemo(
    () => Object.keys(comparisonData).filter((k) => !comparisonData[k].error && comparisonData[k].results),
    [comparisonData]
  );

  const strategies = useMemo(() => {
    const strats = new Set<string>();
    for (const model of modelNames) {
      const results = comparisonData[model]?.results;
      if (results) {
        for (const s of Object.keys(results)) strats.add(s);
      }
    }
    return strats.size > 0 ? Array.from(strats) : ["combined"];
  }, [comparisonData, modelNames]);

  const availableMetrics = useMemo(() => {
    const metrics = new Set<string>();
    for (const model of modelNames) {
      const hourly = getHourlyForModel(comparisonData[model], strategies[0]);
      if (hourly?.length) {
        for (const key of Object.keys(hourly[0])) {
          if (key !== "datetime" && typeof hourly[0][key] === "number") {
            metrics.add(key);
          }
        }
      }
    }
    return metrics.size > 0 ? Array.from(metrics) : ALL_METRICS.slice(0, 3);
  }, [comparisonData, modelNames, strategies]);

  /* ── Toggle model visibility ─────────────────────── */
  const toggleModel = (model: string) => {
    setHiddenModels((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  const visibleModels = modelNames.filter((m) => !hiddenModels.has(m));

  /* ── Summary Bar Data (Matrix) ──────────────────── */
  const summaryBarData = useMemo(() => {
    if (!summaryMatrix) return [];
    const strats = new Set<string>();
    for (const model of Object.keys(summaryMatrix)) {
      for (const s of Object.keys(summaryMatrix[model])) {
        if (s !== "error") strats.add(s);
      }
    }

    const tmyStrats = ["tmy", "combined", "pvgis_poa"];
    const hasNonTmyStrat = Array.from(strats).some((s) => !tmyStrats.includes(s));
    if (hasNonTmyStrat) {
      tmyStrats.forEach((ts) => strats.delete(ts));
    }

    return Array.from(strats).map((strat) => {
      const entry: Record<string, string | number> = { 
        strategy: t(`constants.strategies.${strat}.label` as any) || strat 
      };
      for (const model of visibleModels) {
        if (summaryMatrix[model]) {
          let val = summaryMatrix[model][strat];

          if ((val === null || val === undefined) && (model === "pvgis_tmy" || model === "pvgis_poa")) {
             const availableKeys = Object.keys(summaryMatrix[model]).filter(k => k !== "error");
             if (availableKeys.length > 0) {
               val = summaryMatrix[model][availableKeys[0]];
             }
          }

          if (val !== null && val !== undefined) {
            const label = t(`constants.models.${model}.label` as any) || model;
            entry[label] = val;
          }
        }
      }
      return entry;
    });
  }, [summaryMatrix, visibleModels, t]);

  /* ── 3-Level TimeSeries Data ────────────────────── */
  const chartData = useMemo(() => {
    if (drillLevel === "annual") {
      // MONTHLY TOTALS
      const monthBuckets: Record<number, Record<string, number>> = {};
      for (let m = 0; m < 12; m++) monthBuckets[m] = {};

      for (const modelName of visibleModels) {
        const hourly = getHourlyForModel(comparisonData[modelName], selectedStrategy);
        if (!hourly?.length) continue;
        const label = t(`constants.models.${modelName}.label` as any) || modelName;

        for (const row of hourly) {
          if (!row.datetime) continue;
          const dt = safeParseDate(row.datetime);
          const m = dt.getMonth();
          if (isNaN(m)) continue;
          const val = (row[selectedMetric] as number) || 0;
          monthBuckets[m][label] = (monthBuckets[m][label] || 0) + val;
        }
      }

      return Object.entries(monthBuckets).sort(([a], [b]) => Number(a) - Number(b)).map(([mStr, bucket]) => {
        const m = Number(mStr);
        const entry: Record<string, string | number> = { name: MONTH_SHORT[m], clickId: m };
        for (const [label, val] of Object.entries(bucket)) {
          entry[label] = Math.round((val / 1000) * 100) / 100;
        }
        if (deltaMode && visibleModels.length > 1) {
          const baseModel = t(`constants.models.${visibleModels[0]}.label` as any) || visibleModels[0];
          const baseVal = entry[baseModel] as number || 0;
          for (let i = 1; i < visibleModels.length; i++) {
            const label = t(`constants.models.${visibleModels[i]}.label` as any) || visibleModels[i];
            const val = entry[label] as number || 0;
            entry[label] = Math.round((val - baseVal) * 100) / 100;
          }
          entry[baseModel] = 0;
        }
        return entry;
      });
    }

    if (drillLevel === "month" && selectedMonth !== null) {
      // DAILY TOTALS
      const dayBuckets: Record<number, Record<string, number>> = {};

      for (const modelName of visibleModels) {
        const hourly = getHourlyForModel(comparisonData[modelName], selectedStrategy);
        if (!hourly?.length) continue;
        const label = t(`constants.models.${modelName}.label` as any) || modelName;

        for (const row of hourly) {
          if (!row.datetime) continue;
          const dt = safeParseDate(row.datetime);
          if (isNaN(dt.getTime()) || dt.getMonth() !== selectedMonth) continue;
          
          const d = dt.getDate();
          if (!dayBuckets[d]) dayBuckets[d] = {};
          const val = (row[selectedMetric] as number) || 0;
          dayBuckets[d][label] = (dayBuckets[d][label] || 0) + val;
        }
      }

      return Object.entries(dayBuckets).sort(([a], [b]) => Number(a) - Number(b)).map(([dStr, bucket]) => {
        const d = Number(dStr);
        const entry: Record<string, string | number> = { name: `${d} ${MONTH_SHORT[selectedMonth]}`, clickId: d };
        for (const [label, val] of Object.entries(bucket)) {
          entry[label] = Math.round((val / 1000) * 100) / 100; 
        }
        if (deltaMode && visibleModels.length > 1) {
          const baseModel = t(`constants.models.${visibleModels[0]}.label` as any) || visibleModels[0];
          const baseVal = entry[baseModel] as number || 0;
          for (let i = 1; i < visibleModels.length; i++) {
            const label = t(`constants.models.${visibleModels[i]}.label` as any) || visibleModels[i];
            const val = entry[label] as number || 0;
            entry[label] = Math.round((val - baseVal) * 100) / 100;
          }
          entry[baseModel] = 0;
        }
        return entry;
      });
    }

    if (drillLevel === "day" && selectedMonth !== null && selectedDay !== null) {
      // HOURLY SERIES
      const buckets: Record<number, Record<string, number>> = {};
      for (let h = 0; h < 24; h++) buckets[h] = {};

      for (const modelName of visibleModels) {
        const hourly = getHourlyForModel(comparisonData[modelName], selectedStrategy);
        if (!hourly?.length) continue;
        const label = t(`constants.models.${modelName}.label` as any) || modelName;

        for (const row of hourly) {
          if (!row.datetime) continue;
          const dt = safeParseDate(row.datetime);
          if (isNaN(dt.getTime()) || dt.getMonth() !== selectedMonth || dt.getDate() !== selectedDay) continue;
          
          const h = dt.getHours();
          const val = (row[selectedMetric] as number) || 0;
          buckets[h][label] = val;
        }
      }

      return Object.entries(buckets).sort(([a], [b]) => Number(a) - Number(b)).map(([hStr, bucket]) => {
        const entry: Record<string, string | number> = { name: `${String(hStr).padStart(2, "0")}:00` };
        for (const [label, val] of Object.entries(bucket)) {
          entry[label] = Math.round(val * 100) / 100;
        }
        if (deltaMode && visibleModels.length > 1) {
          const baseModel = t(`constants.models.${visibleModels[0]}.label` as any) || visibleModels[0];
          const baseVal = entry[baseModel] as number || 0;
          for (let i = 1; i < visibleModels.length; i++) {
            const label = t(`constants.models.${visibleModels[i]}.label` as any) || visibleModels[i];
            const val = entry[label] as number || 0;
            entry[label] = Math.round((val - baseVal) * 100) / 100;
          }
          entry[baseModel] = 0;
        }
        return entry;
      });
    }

    return [];
  }, [drillLevel, selectedMonth, selectedDay, comparisonData, visibleModels, selectedStrategy, selectedMetric, deltaMode, MONTH_SHORT, t]);

  /* ── Click Handlers ────────────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (state: any) => {
    if (!state || !state.activePayload || !state.activePayload.length) return;
    const clickId = state.activePayload[0].payload.clickId;
    
    if (chartMode === "summary") return; // cannot drill summary matrix

    if (drillLevel === "annual" && clickId !== undefined) {
      setSelectedMonth(clickId);
      setDrillLevel("month");
      setTsChartType("bar"); // Default for Daily view
    } else if (drillLevel === "month" && clickId !== undefined) {
      setSelectedDay(clickId);
      setDrillLevel("day");
      setTsChartType("area"); // Default for Hourly
    }
  };

  const handleBack = () => {
    if (drillLevel === "day") {
      setDrillLevel("month");
      setSelectedDay(null);
    } else if (drillLevel === "month") {
      setDrillLevel("annual");
      setSelectedMonth(null);
    }
  };

  if (modelNames.length === 0) return null;

  return (
    <div className="glass-card" id="comparison-chart">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            {language === "tr" ? "Model Karşılaştırması" : "Model Comparison"}
          </h3>
          {(chartMode === "timeseries" && drillLevel !== "annual") && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 transition-all mr-2"
                title={t("charts.back")}
              >
                ← {language === "tr" ? "Geri" : "Go Up"}
              </button>
              <span className="text-xs text-amber-400 font-medium whitespace-nowrap">
                {selectedMonth !== null && MONTH_SHORT[selectedMonth]}
                {selectedDay !== null && ` - ${selectedDay}`}
              </span>
            </div>
          )}
          {deltaMode && visibleModels.length > 1 && chartMode === "timeseries" && (
            <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded ml-2">
              Delta Base: {t(`constants.models.${visibleModels[0]}.label` as any) || visibleModels[0]}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Delta Toggle */}
          {chartMode === "timeseries" && visibleModels.length > 1 && (
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                deltaMode ? "bg-cyan-400/20 text-cyan-300 border-cyan-400/30" : "bg-white/[0.04] text-slate-400 border-white/[0.06] hover:text-white"
              }`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeltaMode(!deltaMode); }}
              title={language === "tr" ? "Modeller arası farkı göster" : "Show Difference between models"}
            >
              <Activity className="h-3 w-3 inline mr-1" />
              {language === "tr" ? "Fark Modu" : "Delta Mode"}
            </button>
          )}

          {/* Timeseries Types */}
          {chartMode === "timeseries" && (
            <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <button
                type="button"
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tsChartType === "bar" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTsChartType("bar"); }}
              >
                {language === "tr" ? "Çubuk" : "Bar"}
              </button>
              <button
                type="button"
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tsChartType === "line" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTsChartType("line"); }}
              >
                {language === "tr" ? "Çizgi" : "Line"}
              </button>
              <button
                type="button"
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tsChartType === "area" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTsChartType("area"); }}
              >
                {language === "tr" ? "Alan" : "Area"}
              </button>
            </div>
          )}

          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {summaryMatrix && (
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartMode === "summary" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartMode("summary"); }}
              >
                <BarChart3 className="h-3 w-3 inline mr-1" />{language === "tr" ? "Özet" : "Summary"}
              </button>
            )}
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                chartMode === "timeseries" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
              }`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartMode("timeseries"); }}
            >
              <TrendingUp className="h-3 w-3 inline mr-1" />{language === "tr" ? "Zaman Serisi" : "Time Series"}
            </button>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              exportCSV(chartMode === "summary" ? summaryBarData : chartData, `comparison_${chartMode}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
          >
            <FileDown className="h-3 w-3" />CSV
          </button>
        </div>
      </div>

      {/* Unified Controls Panel */}
      <div className="flex flex-col xl:flex-row gap-6 mb-6 items-start justify-between bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
        {/* Left Side: Model Toggles */}
        <div className="flex-1 w-full">
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">
            {language === "tr" ? "Görünür Modeller" : "Toggle Visible Models"}
          </label>
          <div className="flex flex-wrap gap-2">
            {modelNames.map((model, i) => {
              const isVisible = !hiddenModels.has(model);
              const label = t(`constants.models.${model}.label` as any) || model;
              return (
                <button
                  key={model}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleModel(model); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                    isVisible
                      ? "border-white/[0.15] bg-white/[0.06] text-slate-200 shadow-sm"
                      : "border-white/[0.02] bg-transparent text-slate-600 line-through"
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{ backgroundColor: isVisible ? (MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]) : "#334155" }} />
                  {isVisible ? <Eye className="h-3 w-3 opacity-70" /> : <EyeOff className="h-3 w-3 opacity-40" />}
                  {label}
                  {/* Delta indicator strokes */}
                  {isVisible && chartMode === "timeseries" && (tsChartType === "line" || drillLevel === "day") && (
                    <svg width="24" height="4" className="ml-1 hidden sm:block">
                      <line x1="0" y1="2" x2="24" y2="2" stroke={MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} strokeWidth={2} strokeDasharray={STROKES[i % STROKES.length]} />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Data Selectors (Only in timeseries) */}
        {chartMode === "timeseries" && (
          <div className="flex flex-row gap-4 min-w-max border-t xl:border-t-0 xl:border-l border-white/[0.06] pt-4 xl:pt-0 xl:pl-6">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">
                {language === "tr" ? "Strateji" : "Strategy"}
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="select-field text-xs py-1.5 px-3 rounded-lg border border-white/[0.1] bg-slate-800/50 hover:bg-slate-800 focus:ring-1 focus:ring-amber-500/50 min-w-[140px]"
              >
                {strategies.map((s) => (
                  <option key={s} value={s}>{t(`constants.strategies.${s}.label` as any) || s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">
                {language === "tr" ? "Metrik" : "Metric"}
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="select-field text-xs py-1.5 px-3 rounded-lg border border-white/[0.1] bg-slate-800/50 hover:bg-slate-800 focus:ring-1 focus:ring-amber-500/50 min-w-[140px]"
              >
                {availableMetrics.map((m) => (
                  <option key={m} value={m}>{t(`charts.${m.toLowerCase()}` as any) || m.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === "summary" ? (
            <BarChart data={summaryBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="strategy" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} label={{ value: "kWh/m²", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
              <Tooltip content={<ComparisonTooltip t={t} />} />
              {visibleModels.map((model, i) => (
                <Bar key={model} dataKey={t(`constants.models.${model}.label` as any) || model} fill={MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} radius={[3, 3, 0, 0]} opacity={0.85} animationDuration={600} />
              ))}
            </BarChart>
          ) : (
            tsChartType === "bar" ? (
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                onClick={drillLevel !== "day" ? handleChartClick : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={drillLevel !== "day" ? "pointer" : "default"} />
                <YAxis 
                   tick={{ fill: "#64748b", fontSize: 11 }} 
                   axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                   label={{ value: drillLevel === "day" ? (t(`charts.${selectedMetric.toLowerCase()}` as any) || selectedMetric.toUpperCase()) : "kWh/m²", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip content={<ComparisonTooltip t={t} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                {visibleModels.map((model, i) => {
                  const label = t(`constants.models.${model}.label` as any) || model;
                  return (
                    <Bar
                      key={label}
                      dataKey={label}
                      fill={MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                      radius={[3, 3, 0, 0]}
                      opacity={deltaMode && i === 0 ? 0 : 0.85}
                      className="cursor-pointer hover:opacity-100"
                    />
                  );
                })}
              </BarChart>
            ) : tsChartType === "line" ? (
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                onClick={drillLevel !== "day" ? handleChartClick : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={drillLevel !== "day" ? "pointer" : "default"} />
                <YAxis 
                  tick={{ fill: "#64748b", fontSize: 11 }} 
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  label={{ value: drillLevel === "day" ? (t(`charts.${selectedMetric.toLowerCase()}` as any) || selectedMetric.toUpperCase()) : "kWh/m²", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip content={<ComparisonTooltip t={t} />} />
                {visibleModels.map((model, i) => {
                  const label = t(`constants.models.${model}.label` as any) || model;
                  return (
                    <Line
                      key={label}
                      type="monotone"
                      dataKey={label}
                      stroke={MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                      strokeWidth={2}
                      strokeDasharray={STROKES[i % STROKES.length]}
                      dot={drillLevel !== "day" ? { r: 4, fill: MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length] } : false}
                      activeDot={{ r: 6 }}
                      opacity={deltaMode && i === 0 ? 0 : 1}
                    />
                  );
                })}
              </LineChart>
            ) : (
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                onClick={drillLevel !== "day" ? handleChartClick : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={drillLevel !== "day" ? "pointer" : "default"} />
                <YAxis 
                  tick={{ fill: "#64748b", fontSize: 11 }} 
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  label={{ value: drillLevel === "day" ? (t(`charts.${selectedMetric.toLowerCase()}` as any) || selectedMetric.toUpperCase()) : "kWh/m²", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip content={<ComparisonTooltip t={t} />} />
                {visibleModels.map((model, i) => {
                  const label = t(`constants.models.${model}.label` as any) || model;
                  return (
                    <Area
                      key={label}
                      type="monotone"
                      dataKey={label}
                      stroke={MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                      fill={MODEL_COLORS[model] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                      strokeWidth={2}
                      strokeDasharray={STROKES[i % STROKES.length]}
                      fillOpacity={deltaMode && i === 0 ? 0 : 0.2}
                      opacity={deltaMode && i === 0 ? 0 : 1}
                    />
                  );
                })}
              </AreaChart>
            )
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
