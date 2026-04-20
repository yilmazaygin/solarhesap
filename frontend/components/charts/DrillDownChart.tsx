"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FileDown, BarChart3 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/* ═══════════════════════════════════════════════════════
   Types & Helpers
   ═══════════════════════════════════════════════════════ */

interface HourlyRecord {
  datetime: string;
  [key: string]: string | number | undefined;
}

interface DrillDownChartProps {
  hourlyData: HourlyRecord[];
  title?: string;
  columns?: string[]; // Allowed keys to chart
}

const SERIES_COLORS: Record<string, string> = {
  ghi: "#fbbf24",
  dni: "#f97316",
  dhi: "#38bdf8",
  poa_global: "#fbbf24",
  poa_direct: "#f97316",
  poa_diffuse: "#38bdf8",
  temp_air: "#f87171",
  wind_speed: "#34d399",
  ac_power: "#a78bfa",
  dc_power: "#818cf8",
};

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
function CustomTooltip({ active, payload, label, t }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.1] bg-slate-900/95 backdrop-blur-xl p-3 shadow-xl z-50">
      <p className="text-xs font-semibold text-slate-300 mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => {
        const key = entry.dataKey.toLowerCase();
        const labelText = t(`charts.${key}` as any) || entry.dataKey;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{labelText}:</span>
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
  const csv = [keys.join(","), ...data.map((r) => keys.map((k) => r[k] ?? "").join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════
   DrillDownChart Component
   ═══════════════════════════════════════════════════════ */

export default function DrillDownChart({ hourlyData, title, columns = [] }: DrillDownChartProps) {
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

  // Navigation
  const [drillLevel, setDrillLevel] = useState<"annual" | "month" | "day">("annual");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // User UI Selectors
  const [chartType, setChartType] = useState<"bar" | "line" | "area">("bar");
  const computedCols = useMemo(() => {
    if (columns.length > 0) return columns;
    if (!hourlyData?.length) return [];
    return Object.keys(hourlyData[0]).filter((k) => k !== "datetime" && typeof hourlyData[0][k] === "number");
  }, [columns, hourlyData]);

  const [activeCols, setActiveCols] = useState<Set<string>>(new Set());

  const visibleCols = useMemo(() => {
    if (activeCols.size === 0 && computedCols.length > 0) {
      return computedCols.slice(0, 3);
    }
    return computedCols.filter((c) => activeCols.has(c));
  }, [activeCols, computedCols]);

  const toggleCol = (col: string) => {
    setActiveCols((prev) => {
      let next = new Set(prev);
      if (next.size === 0) next = new Set(computedCols.slice(0, 3));
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  /* ── 3-Level Data Parser ───────────────────────── */
  const chartData = useMemo(() => {
    if (!hourlyData?.length) return [];

    if (drillLevel === "annual") {
      // MONTHLY TOTALS
      const monthBuckets: Record<number, Record<string, number>> = {};
      for (let m = 0; m < 12; m++) monthBuckets[m] = {};

      for (const row of hourlyData) {
        if (!row.datetime) continue;
        const dt = safeParseDate(row.datetime);
        if (isNaN(dt.getTime())) continue;
        const m = dt.getMonth();
        for (const col of visibleCols) {
          monthBuckets[m][col] = (monthBuckets[m][col] || 0) + ((row[col] as number) || 0);
        }
      }

      return Object.entries(monthBuckets).sort(([a], [b]) => Number(a) - Number(b)).map(([mStr, bucket]) => {
        const m = Number(mStr);
        const entry: Record<string, string | number> = { name: MONTH_SHORT[m], clickId: m };
        for (const col of visibleCols) {
          const total = bucket[col];
          entry[col] = Math.round((total / 1000) * 100) / 100;
        }
        return entry;
      });
    }

    if (drillLevel === "month" && selectedMonth !== null) {
      // DAILY TOTALS
      const dayBuckets: Record<number, Record<string, number>> = {};

      for (const row of hourlyData) {
        if (!row.datetime) continue;
        const dt = safeParseDate(row.datetime);
        if (isNaN(dt.getTime()) || dt.getMonth() !== selectedMonth) continue;
        
        const d = dt.getDate();
        if (!dayBuckets[d]) dayBuckets[d] = {};
        for (const col of visibleCols) {
          dayBuckets[d][col] = (dayBuckets[d][col] || 0) + ((row[col] as number) || 0);
        }
      }

      return Object.entries(dayBuckets).sort(([a], [b]) => Number(a) - Number(b)).map(([dStr, bucket]) => {
        const d = Number(dStr);
        const entry: Record<string, string | number> = { name: `${d} ${MONTH_SHORT[selectedMonth]}`, clickId: d };
        for (const col of visibleCols) {
          entry[col] = Math.round((bucket[col] / 1000) * 100) / 100; // Wh to kWh
        }
        return entry;
      });
    }

    if (drillLevel === "day" && selectedMonth !== null && selectedDay !== null) {
      // HOURLY SERIES
      const hourList: Record<string, string | number>[] = [];
      
      for (const row of hourlyData) {
        if (!row.datetime) continue;
        const dt = safeParseDate(row.datetime);
        if (isNaN(dt.getTime()) || dt.getMonth() !== selectedMonth || dt.getDate() !== selectedDay) continue;

        const h = dt.getHours();
        const entry: Record<string, string | number> = { name: `${String(h).padStart(2, "0")}:00` };
        for (const col of visibleCols) {
          entry[col] = Math.round(((row[col] as number) || 0) * 100) / 100; // Explicit per-hour W values
        }
        hourList.push(entry);
      }
      return hourList;
    }

    return [];
  }, [drillLevel, selectedMonth, selectedDay, hourlyData, visibleCols, MONTH_SHORT]);


  /* ── Click Handlers ────────────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (state: any) => {
    if (!state || !state.activePayload || !state.activePayload.length) return;
    const clickId = state.activePayload[0].payload.clickId;

    if (drillLevel === "annual" && clickId !== undefined) {
      setSelectedMonth(clickId);
      setDrillLevel("month");
      setChartType("bar"); // Default for Daily view
    } else if (drillLevel === "month" && clickId !== undefined) {
      setSelectedDay(clickId);
      setDrillLevel("day");
      setChartType("area"); // Lines/Areas typically better for hourly
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

  if (!hourlyData?.length) return null;

  return (
    <div className="glass-card" id="drilldown-chart">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-400" />
            {title || (language === "tr" ? "Veri Gezgini" : "Data Explorer")}
          </h3>
          {(drillLevel !== "annual") && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 transition-all"
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Configurator */}
          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <button
              type="button"
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                chartType === "bar" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
              }`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartType("bar"); }}
            >
              {language === "tr" ? "Çubuk" : "Bar"}
            </button>
            <button
              type="button"
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                chartType === "line" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
              }`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartType("line"); }}
            >
              {language === "tr" ? "Çizgi" : "Line"}
            </button>
            <button
              type="button"
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                chartType === "area" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"
              }`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartType("area"); }}
            >
              {language === "tr" ? "Alan" : "Area"}
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              exportCSV(chartData, "data_profile");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
          >
            <FileDown className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Selectable Metrics */}
      <div className="flex flex-wrap gap-2 mb-4">
        {computedCols.map((col) => {
          const isVisible = visibleCols.includes(col);
          const labelText = t(`charts.${col.toLowerCase()}` as any) || col.toUpperCase();
          return (
            <button
              key={col}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCol(col); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                isVisible
                  ? "border-white/[0.15] bg-white/[0.06] text-slate-200"
                  : "border-white/[0.04] bg-transparent text-slate-600 line-through"
              }`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isVisible ? SERIES_COLORS[col] || "#fbbf24" : "#475569" }}
              />
              {labelText}
            </button>
          );
        })}
      </div>

      {/* Chart Canvas */}
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
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
                label={{ value: drillLevel === "day" ? t("charts.unit_w") : "kWh/m²", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip t={t} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {visibleCols.map((col) => (
                <Bar
                  key={col}
                  dataKey={col}
                  fill={SERIES_COLORS[col] || "#fbbf24"}
                  radius={[4, 4, 0, 0]}
                  opacity={0.85}
                  className="cursor-pointer hover:opacity-100"
                />
              ))}
            </BarChart>
          ) : chartType === "line" ? (
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
                label={{ value: drillLevel === "day" ? t("charts.unit_w") : "kWh/m²", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip t={t} />} />
              {visibleCols.map((col) => (
                <Line
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={SERIES_COLORS[col] || "#fbbf24"}
                  strokeWidth={2}
                  dot={drillLevel !== "day" ? { r: 4, fill: SERIES_COLORS[col] || "#fbbf24" } : false}
                  activeDot={{ r: 6 }}
                />
              ))}
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
                label={{ value: drillLevel === "day" ? t("charts.unit_w") : "kWh/m²", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip t={t} />} />
              {visibleCols.map((col) => (
                <Area
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={SERIES_COLORS[col] || "#fbbf24"}
                  fill={SERIES_COLORS[col] || "#fbbf24"}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
