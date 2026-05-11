"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Zap, BarChart3, TrendingUp, Activity } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ModelChainChartProps {
  title?: string;
  simulation_results: Record<string, any>;
}

const COLORS = ["#fbbf24", "#38bdf8", "#34d399", "#a78bfa", "#f87171"];
const STROKES = ["10 0", "5 5", "3 3", "8 4"];

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
        const strat = entry.dataKey;
        const labelText = t(`constants.strategies.${strat}.label` as any) || strat;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{labelText}:</span>
            <span className="font-semibold text-white">
              {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
            </span>
            <span className="text-slate-500 text-[10px]">kWh</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ModelChainChart({ title, simulation_results }: ModelChainChartProps) {
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

  const [chartType, setChartType] = useState<"bar" | "line" | "area">("bar");
  const [deltaMode, setDeltaMode] = useState(false);
  const [drillLevel, setDrillLevel] = useState<"annual" | "month" | "day">("annual");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const strategies = Object.keys(simulation_results || {});
  const [hiddenStrats, setHiddenStrats] = useState<Set<string>>(new Set());

  const toggleStrat = (s: string) => {
    setHiddenStrats((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const visibleStrats = strategies.filter((s) => !hiddenStrats.has(s));

  const chartData = useMemo(() => {
    if (drillLevel === "annual") {
      const monthBuckets: Record<number, Record<string, number>> = {};
      for (let m = 0; m < 12; m++) monthBuckets[m] = {};

      for (const strat of visibleStrats) {
        const ac = simulation_results[strat]?.ac;
        if (!ac || typeof ac !== "object") continue;
        for (const [dt, val] of Object.entries(ac)) {
          if (typeof val === "number" && isFinite(val)) {
            const dateObj = safeParseDate(dt);
            if (isNaN(dateObj.getTime())) continue;
            const m = dateObj.getMonth();
            monthBuckets[m][strat] = (monthBuckets[m][strat] || 0) + val / 1000;
          }
        }
      }

      return Object.entries(monthBuckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([mStr, bucket]) => {
          const m = Number(mStr);
          const entry: Record<string, string | number> = { name: MONTH_SHORT[m], monthIndex: m };
          for (const [strat, total] of Object.entries(bucket)) {
            entry[strat] = Math.round(total * 100) / 100;
          }
          if (deltaMode && visibleStrats.length > 1) {
            const base = entry[visibleStrats[0]] as number || 0;
            for (let i = 1; i < visibleStrats.length; i++) {
              const val = entry[visibleStrats[i]] as number || 0;
              entry[visibleStrats[i]] = Math.round((val - base) * 1000) / 1000;
            }
            entry[visibleStrats[0]] = 0;
          }
          return entry;
        });
    }

    if (drillLevel === "month" && selectedMonth !== null) {
      const dayBuckets: Record<number, Record<string, number>> = {};

      for (const strat of visibleStrats) {
        const ac = simulation_results[strat]?.ac;
        if (!ac || typeof ac !== "object") continue;
        for (const [dt, val] of Object.entries(ac)) {
          if (typeof val === "number" && isFinite(val)) {
            const dateObj = safeParseDate(dt);
            if (isNaN(dateObj.getTime()) || dateObj.getMonth() !== selectedMonth) continue;
            const d = dateObj.getDate();
            if (!dayBuckets[d]) dayBuckets[d] = {};
            dayBuckets[d][strat] = (dayBuckets[d][strat] || 0) + val / 1000;
          }
        }
      }

      return Object.entries(dayBuckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([dStr, bucket]) => {
          const d = Number(dStr);
          const entry: Record<string, string | number> = { name: `${d} ${MONTH_SHORT[selectedMonth]}`, dayIndex: d };
          for (const [strat, total] of Object.entries(bucket)) {
            entry[strat] = Math.round(total * 100) / 100;
          }
          if (deltaMode && visibleStrats.length > 1) {
            const base = entry[visibleStrats[0]] as number || 0;
            for (let i = 1; i < visibleStrats.length; i++) {
              const val = entry[visibleStrats[i]] as number || 0;
              entry[visibleStrats[i]] = Math.round((val - base) * 1000) / 1000;
            }
            entry[visibleStrats[0]] = 0;
          }
          return entry;
        });
    }

    if (drillLevel === "day" && selectedMonth !== null && selectedDay !== null) {
      const hourBuckets: Record<number, Record<string, number>> = {};
      for (let h = 0; h < 24; h++) hourBuckets[h] = {};

      for (const strat of visibleStrats) {
        const ac = simulation_results[strat]?.ac;
        if (!ac || typeof ac !== "object") continue;
        for (const [dt, val] of Object.entries(ac)) {
          if (typeof val === "number" && isFinite(val)) {
            const dateObj = safeParseDate(dt);
            if (
              isNaN(dateObj.getTime()) ||
              dateObj.getMonth() !== selectedMonth ||
              dateObj.getDate() !== selectedDay
            ) continue;
            const h = dateObj.getHours();
            hourBuckets[h][strat] = (hourBuckets[h][strat] || 0) + val / 1000;
          }
        }
      }

      return Object.entries(hourBuckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([hStr, bucket]) => {
          const h = Number(hStr);
          const entry: Record<string, string | number> = { name: `${String(h).padStart(2, "0")}:00` };
          for (const [strat, total] of Object.entries(bucket)) {
            entry[strat] = Math.round(total * 100) / 100;
          }
          if (deltaMode && visibleStrats.length > 1) {
            const base = entry[visibleStrats[0]] as number || 0;
            for (let i = 1; i < visibleStrats.length; i++) {
              const val = entry[visibleStrats[i]] as number || 0;
              entry[visibleStrats[i]] = Math.round((val - base) * 1000) / 1000;
            }
            entry[visibleStrats[0]] = 0;
          }
          return entry;
        });
    }

    return [];
  }, [drillLevel, selectedMonth, selectedDay, simulation_results, visibleStrats, deltaMode, MONTH_SHORT]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (state: any) => {
    if (!state?.activePayload?.length) return;
    const payload = state.activePayload[0].payload;
    if (drillLevel === "annual" && payload.monthIndex !== undefined) {
      setSelectedMonth(payload.monthIndex);
      setDrillLevel("month");
      setChartType("bar");
    } else if (drillLevel === "month" && payload.dayIndex !== undefined) {
      setSelectedDay(payload.dayIndex);
      setDrillLevel("day");
      setChartType("line");
    }
  };

  const handleBack = () => {
    if (drillLevel === "day") { setDrillLevel("month"); setSelectedDay(null); }
    else if (drillLevel === "month") { setDrillLevel("annual"); setSelectedMonth(null); }
  };

  const yAxisProps = {
    tick: { fill: "#64748b", fontSize: 11 },
    axisLine: { stroke: "rgba(255,255,255,0.06)" },
    domain: [0, "auto"] as [number, string],
    label: { value: "kWh", angle: -90, position: "insideLeft" as const, fill: "#64748b", fontSize: 10 },
  };

  if (!strategies.length) return null;

  return (
    <div className="glass-card" id="modelchain-chart">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            {title || (language === "tr" ? "Enerji Üretim Profili" : "Energy Production Profile")}
          </h3>
          {drillLevel !== "annual" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 transition-all"
              >
                ← {language === "tr" ? "Geri" : "Go Up"}
              </button>
              <span className="text-xs text-amber-400 font-medium whitespace-nowrap">
                {selectedMonth !== null && MONTH_SHORT[selectedMonth]}
                {selectedDay !== null && ` ${selectedDay}`}
              </span>
            </div>
          )}
          {deltaMode && visibleStrats.length > 1 && (
            <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded ml-2">
              Delta: {t(`constants.strategies.${visibleStrats[0]}.label` as any) || visibleStrats[0]}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleStrats.length > 1 && (
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                deltaMode ? "bg-cyan-400/20 text-cyan-300 border-cyan-400/30" : "bg-white/[0.04] text-slate-400 border-white/[0.06] hover:text-white"
              }`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeltaMode(!deltaMode); }}
            >
              <Activity className="h-3 w-3 inline mr-1" />
              {language === "tr" ? "Fark Modu" : "Delta Mode"}
            </button>
          )}

          {/* Chart Type Toggles */}
          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <button
              type="button"
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${chartType === "bar" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartType("bar"); }}
              title={language === "tr" ? "Çubuk Grafik" : "Bar Chart"}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${chartType === "line" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartType("line"); }}
              title={language === "tr" ? "Çizgi Grafik" : "Line Chart"}
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${chartType === "area" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChartType("area"); }}
              title={language === "tr" ? "Alan Grafik" : "Area Chart"}
            >
              {language === "tr" ? "Alan" : "Area"}
            </button>
          </div>
        </div>
      </div>

      {/* Strategies Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {strategies.map((strat, i) => {
          const isVisible = !hiddenStrats.has(strat);
          const label = t(`constants.strategies.${strat}.label` as any) || strat;
          return (
            <button
              key={strat}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStrat(strat); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                isVisible
                  ? "border-white/[0.15] bg-white/[0.06] text-slate-200"
                  : "border-white/[0.04] bg-transparent text-slate-600 line-through"
              }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isVisible ? COLORS[i % COLORS.length] : "#475569" }} />
              {label}
              {isVisible && chartType !== "bar" && (
                <svg width="24" height="4" className="ml-1 hidden sm:block">
                  <line x1="0" y1="2" x2="24" y2="2" stroke={COLORS[i % COLORS.length]} strokeWidth={2} strokeDasharray={STROKES[i % STROKES.length]} />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={drillLevel !== "day" ? "pointer" : "default"} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip t={t} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {visibleStrats.map((strat, i) => (
                <Bar key={strat} dataKey={strat} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} opacity={deltaMode && i === 0 ? 0 : 0.85} className="cursor-pointer hover:opacity-100" />
              ))}
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={drillLevel !== "day" ? "pointer" : "default"} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip t={t} />} />
              {visibleStrats.map((strat, i) => (
                <Line key={strat} type="monotone" dataKey={strat} stroke={COLORS[i % COLORS.length]} strokeWidth={2} strokeDasharray={STROKES[i % STROKES.length]} dot={drillLevel !== "day" ? { r: 4, fill: COLORS[i % COLORS.length] } : false} activeDot={{ r: 6 }} opacity={deltaMode && i === 0 ? 0 : 1} />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={drillLevel !== "day" ? "pointer" : "default"} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip t={t} />} />
              {visibleStrats.map((strat, i) => (
                <Area key={strat} type="monotone" dataKey={strat} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} strokeWidth={2} strokeDasharray={STROKES[i % STROKES.length]} fillOpacity={deltaMode && i === 0 ? 0 : 0.2} />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Totals summary */}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.06] pt-4">
        {strategies.map((strat, i) => {
          const ac = simulation_results[strat]?.ac;
          const total = (() => {
            if (!ac || typeof ac !== "object") return 0;
            return Object.entries(ac).reduce((sum: number, [dt, v]) => {
              if (typeof v !== "number" || !isFinite(v)) return sum;
              if (drillLevel === "annual") return sum + v / 1000;
              const dateObj = safeParseDate(dt);
              if (isNaN(dateObj.getTime())) return sum;
              if (drillLevel === "month") return dateObj.getMonth() === selectedMonth ? sum + v / 1000 : sum;
              if (drillLevel === "day") return dateObj.getMonth() === selectedMonth && dateObj.getDate() === selectedDay ? sum + v / 1000 : sum;
              return sum + v / 1000;
            }, 0);
          })();

          const unit = drillLevel === "day" ? "kWh/gün" : drillLevel === "month" ? "kWh/ay" : "kWh/yıl";
          const label = t(`constants.strategies.${strat}.label` as any) || strat;
          const isHidden = hiddenStrats.has(strat);
          return (
            <div
              key={strat}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                isHidden ? "border-white/[0.04] bg-transparent opacity-40" : "border-white/[0.1] bg-white/[0.04]"
              }`}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-xs text-slate-400">{label}</span>
              <span className="text-sm font-bold text-white">{total < 100 ? total.toFixed(2) : Math.round(total).toLocaleString()}</span>
              <span className="text-[10px] text-slate-500">{unit}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
