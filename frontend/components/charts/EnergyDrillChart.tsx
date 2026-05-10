"use client";

import { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChevronLeft, Zap, BarChart3, TrendingUp } from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface HourlyRecord {
  datetime: string;
  ac_kw: number;
}

interface EnergyDrillChartProps {
  hourlyData: HourlyRecord[];
  annualKwh: number;
}

type DrillLevel = "year" | "month" | "day";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LONG  = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];

function parseUTC(dt: string): Date {
  return new Date(dt);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EnergyTooltip({ active, payload, label, unit, accentColor }: any) {
  if (!active || !payload?.length) return null;
  const val: number = payload[0].value;
  return (
    <div className="rounded-xl border border-white/[0.1] bg-slate-900/95 backdrop-blur-xl p-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-300 mb-1">{label}</p>
      <div className="flex items-center gap-2 text-xs">
        <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
        <span className="text-slate-400">{unit === "kW" ? "AC Power:" : "Energy:"}</span>
        <span className="font-bold" style={{ color: accentColor }}>
          {unit === "kW"
            ? `${val.toFixed(2)} kW`
            : val >= 1000
              ? `${(val / 1000).toFixed(2)} MWh`
              : `${val.toFixed(1)} kWh`}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function EnergyDrillChart({ hourlyData, annualKwh }: EnergyDrillChartProps) {
  const [level, setLevel] = useState<DrillLevel>("year");
  const [isDark, setIsDark] = useState(true);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  useEffect(() => {
    const check = () => setIsDark(!document.documentElement.classList.contains("light"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const barColor = isDark ? "#fbbf24" : "#0284c7";
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selDay, setSelDay] = useState<number | null>(null);

  /* ── Pre-index hourly data ──────────────────────────── */
  const indexed = useMemo(() => {
    return hourlyData.map((r) => {
      const d = parseUTC(r.datetime);
      return { ...r, month: d.getMonth(), day: d.getDate(), hour: d.getHours() };
    });
  }, [hourlyData]);

  /* ── Chart data per drill level ─────────────────────── */
  const chartData = useMemo(() => {
    if (level === "year") {
      const buckets = Array.from({ length: 12 }, () => 0);
      for (const r of indexed) buckets[r.month] += r.ac_kw;
      return buckets.map((kwh, m) => ({
        name: MONTH_SHORT[m],
        label: MONTH_LONG[m],
        value: Math.round(kwh * 10) / 10,
        clickMonth: m,
      }));
    }

    if (level === "month" && selMonth !== null) {
      const buckets: Record<number, number> = {};
      for (const r of indexed) {
        if (r.month !== selMonth) continue;
        buckets[r.day] = (buckets[r.day] || 0) + r.ac_kw;
      }
      return Object.entries(buckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([d, kwh]) => ({
          name: String(d),
          label: `${MONTH_SHORT[selMonth]} ${d}`,
          value: Math.round(kwh * 100) / 100,
          clickDay: Number(d),
        }));
    }

    if (level === "day" && selMonth !== null && selDay !== null) {
      const hours: { name: string; label: string; value: number }[] = [];
      for (const r of indexed) {
        if (r.month !== selMonth || r.day !== selDay) continue;
        hours.push({
          name: `${String(r.hour).padStart(2, "0")}:00`,
          label: `${String(r.hour).padStart(2, "0")}:00`,
          value: Math.round(r.ac_kw * 1000) / 1000,
        });
      }
      return hours.sort((a, b) => a.name.localeCompare(b.name));
    }

    return [];
  }, [level, selMonth, selDay, indexed]);

  /* ── Click handlers ─────────────────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (data: any) => {
    if (!data?.activePayload?.[0]) return;
    const payload = data.activePayload[0].payload;
    if (level === "year" && payload.clickMonth !== undefined) {
      setSelMonth(payload.clickMonth);
      setLevel("month");
    } else if (level === "month" && payload.clickDay !== undefined) {
      setSelDay(payload.clickDay);
      setLevel("day");
    }
  };

  const handleBack = () => {
    if (level === "day") { setLevel("month"); setSelDay(null); }
    else if (level === "month") { setLevel("year"); setSelMonth(null); }
  };

  /* ── Axis label ─────────────────────────────────────── */
  const yUnit = level === "day" ? "kW" : "kWh";
  const yLabel = level === "day" ? "AC Power (kW)" : "Energy (kWh)";

  /* ── Click hint ─────────────────────────────────────── */
  const hint = level === "year"
    ? "Click a month to see daily breakdown"
    : level === "month"
      ? "Click a day to see hourly profile"
      : null;

  /* ── Period type label ──────────────────────────────── */
  const periodLabel =
    level === "year" ? "Annual production"
    : level === "month" ? "Monthly production"
    : "Daily production";

  /* ── Breadcrumb ─────────────────────────────────────── */
  const crumb =
    level === "year" ? `${annualKwh >= 1000 ? (annualKwh / 1000).toFixed(1) + " MWh" : annualKwh.toFixed(0) + " kWh"} / year`
    : level === "month" && selMonth !== null ? MONTH_LONG[selMonth]
    : selMonth !== null && selDay !== null ? `${MONTH_LONG[selMonth]} ${selDay}`
    : "";

  if (!hourlyData.length) return null;

  const canClick = level !== "day";

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Energy Output
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-400/20 text-amber-400/80 bg-amber-400/[0.06]">
            {periodLabel}
          </span>
          {level !== "year" && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          {crumb && (
            <span className="text-xs text-slate-400 font-medium">{crumb}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hint && (
            <span className="text-[10px] text-slate-600 italic hidden sm:block">{hint}</span>
          )}
          {/* Chart type toggle */}
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <button type="button" onClick={() => setChartType("bar")}
              className={`p-1.5 rounded-md transition-all ${chartType === "bar" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              title="Bar chart">
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setChartType("line")}
              className={`p-1.5 rounded-md transition-all ${chartType === "line" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              title="Line chart">
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              onClick={canClick ? handleBarClick : undefined}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                cursor={canClick ? "pointer" : "default"}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, dy: 50 }}
              />
              <Tooltip content={<EnergyTooltip unit={yUnit} accentColor={barColor} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar
                dataKey="value"
                fill={barColor}
                radius={[4, 4, 0, 0]}
                opacity={0.85}
                className={canClick ? "cursor-pointer hover:opacity-100" : ""}
              />
            </BarChart>
          ) : (
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              onClick={canClick ? handleBarClick : undefined}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                cursor={canClick ? "pointer" : "default"}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, dy: 50 }}
              />
              <Tooltip content={<EnergyTooltip unit={yUnit} accentColor={barColor} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={barColor}
                strokeWidth={2}
                dot={level !== "day" ? { r: 4, fill: barColor } : false}
                activeDot={{ r: 6 }}
                className={canClick ? "cursor-pointer" : ""}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Level indicator */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04]">
        {(["year", "month", "day"] as DrillLevel[]).map((l, i) => (
          <div key={l} className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-medium ${l !== level ? "text-slate-600" : ""}`}
              style={l === level ? { color: barColor } : undefined}
            >
              {l === "year" ? "Annual" : l === "month" ? "Monthly" : "Daily"}
            </span>
            {i < 2 && <span className="text-slate-700 text-[10px]">›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
