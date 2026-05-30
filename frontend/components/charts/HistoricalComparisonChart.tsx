"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { ChevronLeft, Zap, BarChart3, TrendingUp, AreaChart as AreaChartIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface HourlyRecord {
  datetime: string;
  ac_kw: number;
}

interface HistoricalComparisonChartProps {
  hourlyData: HourlyRecord[];
  actualData?: HourlyRecord[];
  annualKwh: number;
  actualAnnualKwh?: number;
  year: number;
}

type DrillLevel = "year" | "month" | "day";

const MONTH_SHORT_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LONG_EN  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT_TR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const MONTH_LONG_TR  = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ComparisonTooltip({ active, payload, label, unit, hasActual, simLabel, actLabel }: any) {
  if (!active || !payload?.length) return null;
  const simVal: number = payload.find((p: { dataKey: string }) => p.dataKey === "simulated")?.value ?? 0;
  const actVal: number | undefined = hasActual
    ? payload.find((p: { dataKey: string }) => p.dataKey === "actual")?.value
    : undefined;

  const fmt = (v: number) =>
    unit === "kW"
      ? `${v.toFixed(2)} kW`
      : v >= 1000
        ? `${(v / 1000).toFixed(2)} MWh`
        : `${v.toFixed(1)} kWh`;

  const diff = actVal !== undefined ? actVal - simVal : null;
  const errPct = actVal !== undefined && simVal > 0
    ? ((actVal - simVal) / simVal) * 100
    : null;

  return (
    <div className="rounded-xl border border-white/[0.1] bg-slate-900/95 backdrop-blur-xl p-3 shadow-xl space-y-1.5">
      <p className="text-xs font-semibold text-slate-300 mb-1">{label}</p>
      <div className="flex items-center gap-2 text-xs">
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-slate-400">{simLabel}:</span>
        <span className="font-bold text-amber-300">{fmt(simVal)}</span>
      </div>
      {actVal !== undefined && (
        <>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-slate-400">{actLabel}:</span>
            <span className="font-bold text-sky-300">{fmt(actVal)}</span>
          </div>
          {diff !== null && errPct !== null && (
            <div className="flex items-center gap-2 text-xs border-t border-white/[0.06] pt-1.5 mt-1">
              <span className="text-slate-500">Δ</span>
              <span className={`font-semibold ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {diff >= 0 ? "+" : ""}{fmt(Math.abs(diff))}
                {" "}({errPct >= 0 ? "+" : ""}{errPct.toFixed(1)}%)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function HistoricalComparisonChart({
  hourlyData,
  actualData,
  annualKwh,
  actualAnnualKwh,
  year,
}: HistoricalComparisonChartProps) {
  const { language } = useLanguage();
  const isTr = language === "tr";

  const MONTH_SHORT = isTr ? MONTH_SHORT_TR : MONTH_SHORT_EN;
  const MONTH_LONG  = isTr ? MONTH_LONG_TR  : MONTH_LONG_EN;

  const s = {
    energyOutput:   isTr ? "Enerji Çıkışı"                          : "Energy Output",
    annualProd:     isTr ? "Yıllık üretim"                          : "Annual production",
    monthlyProd:    isTr ? "Aylık üretim"                           : "Monthly production",
    dailyProd:      isTr ? "Günlük üretim"                          : "Daily production",
    clickMonth:     isTr ? "Günlük dağılım için bir aya tıkla"      : "Click a month to see daily breakdown",
    clickDay:       isTr ? "Saatlik profil için bir güne tıkla"     : "Click a day to see hourly profile",
    back:           isTr ? "Geri"                                    : "Back",
    annual:         isTr ? "Yıllık"                                  : "Annual",
    monthly:        isTr ? "Aylık"                                   : "Monthly",
    daily:          isTr ? "Günlük"                                  : "Daily",
    acPowerKw:      isTr ? "AC Güç (kW)"                            : "AC Power (kW)",
    energyKwh:      isTr ? "Enerji (kWh)"                           : "Energy (kWh)",
    simulated:      isTr ? "Simüle"                                  : "Simulated",
    actual:         isTr ? "Gerçek"                                  : "Actual",
    actualTotal:    isTr ? "Gerçek toplam:"                          : "Actual total:",
    difference:     isTr ? "Fark:"                                   : "Difference:",
    simCrumb:       isTr ? "simüle"                                  : "simulated",
  };

  const [level, setLevel] = useState<DrillLevel>("year");
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selDay, setSelDay] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"bar" | "line" | "area">("bar");

  const hasActual = !!actualData?.length;

  const indexed = useMemo(() => hourlyData.map((r) => {
    const d = new Date(r.datetime);
    return { ...r, month: d.getMonth(), day: d.getDate(), hour: d.getHours() };
  }), [hourlyData]);

  const actualIndexed = useMemo(() => (actualData ?? []).map((r) => {
    const d = new Date(r.datetime);
    return { ...r, month: d.getMonth(), day: d.getDate(), hour: d.getHours() };
  }), [actualData]);

  const sumBy = (
    data: typeof indexed,
    key: "month" | "day" | "hour",
    filter?: (r: typeof indexed[0]) => boolean,
  ): Record<number, number> => {
    const out: Record<number, number> = {};
    for (const r of data) {
      if (filter && !filter(r)) continue;
      out[r[key]] = (out[r[key]] || 0) + r.ac_kw;
    }
    return out;
  };

  const chartData = useMemo(() => {
    if (level === "year") {
      const sim = sumBy(indexed, "month");
      const act = hasActual ? sumBy(actualIndexed, "month") : {};
      return Array.from({ length: 12 }, (_, m) => ({
        name: MONTH_SHORT[m],
        label: MONTH_LONG[m],
        simulated: Math.round((sim[m] || 0) * 10) / 10,
        ...(hasActual ? { actual: Math.round((act[m] || 0) * 10) / 10 } : {}),
        clickMonth: m,
      }));
    }

    if (level === "month" && selMonth !== null) {
      const inMonth = (r: typeof indexed[0]) => r.month === selMonth;
      const sim = sumBy(indexed, "day", inMonth);
      const act = hasActual ? sumBy(actualIndexed, "day", inMonth) : {};
      return Object.keys(sim)
        .map(Number)
        .sort((a, b) => a - b)
        .map((d) => ({
          name: String(d),
          label: `${MONTH_SHORT[selMonth]} ${d}`,
          simulated: Math.round((sim[d] || 0) * 100) / 100,
          ...(hasActual ? { actual: Math.round((act[d] || 0) * 100) / 100 } : {}),
          clickDay: d,
        }));
    }

    if (level === "day" && selMonth !== null && selDay !== null) {
      const inDay = (r: typeof indexed[0]) => r.month === selMonth && r.day === selDay;
      const simHours = indexed.filter(inDay);
      const actHours = hasActual ? actualIndexed.filter(inDay) : [];
      const actMap: Record<number, number> = {};
      for (const r of actHours) actMap[r.hour] = r.ac_kw;
      return simHours
        .sort((a, b) => a.hour - b.hour)
        .map((r) => ({
          name: `${String(r.hour).padStart(2, "0")}:00`,
          label: `${String(r.hour).padStart(2, "0")}:00`,
          simulated: Math.round(r.ac_kw * 1000) / 1000,
          ...(hasActual ? { actual: Math.round((actMap[r.hour] || 0) * 1000) / 1000 } : {}),
        }));
    }

    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, selMonth, selDay, indexed, actualIndexed, hasActual, language]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (data: any) => {
    if (!data?.activePayload?.[0]) return;
    const p = data.activePayload[0].payload;
    if (level === "year" && p.clickMonth !== undefined) {
      setSelMonth(p.clickMonth);
      setLevel("month");
    } else if (level === "month" && p.clickDay !== undefined) {
      setSelDay(p.clickDay);
      setLevel("day");
    }
  };

  const handleBack = () => {
    if (level === "day") { setLevel("month"); setSelDay(null); }
    else if (level === "month") { setLevel("year"); setSelMonth(null); }
  };

  const yUnit = level === "day" ? "kW" : "kWh";
  const yLabel = level === "day" ? s.acPowerKw : s.energyKwh;
  const canClick = level !== "day";

  const hint = level === "year" ? s.clickMonth : level === "month" ? s.clickDay : null;

  const periodLabel =
    level === "year" ? s.annualProd : level === "month" ? s.monthlyProd : s.dailyProd;

  const crumb =
    level === "year"
      ? `${year} — ${annualKwh >= 1000 ? (annualKwh / 1000).toFixed(1) + " MWh" : annualKwh.toFixed(0) + " kWh"} ${s.simCrumb}`
      : level === "month" && selMonth !== null
        ? MONTH_LONG[selMonth]
        : selMonth !== null && selDay !== null
          ? `${MONTH_LONG[selMonth]} ${selDay}`
          : "";

  if (!hourlyData.length) return null;

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            {s.energyOutput}
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
              {s.back}
            </button>
          )}
          {crumb && <span className="text-xs text-slate-400 font-medium">{crumb}</span>}
        </div>
        <div className="flex items-center gap-2">
          {hint && (
            <span className="text-[10px] text-slate-600 italic hidden sm:block">{hint}</span>
          )}
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <button type="button" onClick={() => setChartType("bar")}
              className={`p-1.5 rounded-md transition-all ${chartType === "bar" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              title={isTr ? "Çubuk grafik" : "Bar chart"}>
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setChartType("line")}
              className={`p-1.5 rounded-md transition-all ${chartType === "line" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              title={isTr ? "Çizgi grafik" : "Line chart"}>
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setChartType("area")}
              className={`p-1.5 rounded-md transition-all ${chartType === "area" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              title={isTr ? "Alan grafik" : "Area chart"}>
              <AreaChartIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Actual vs Simulated delta banner */}
      {hasActual && level === "year" && actualAnnualKwh !== undefined && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-400/[0.06] border border-sky-400/20 text-xs">
            <div className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-slate-400">{s.actualTotal}</span>
            <span className="font-bold text-sky-300">
              {actualAnnualKwh >= 1000
                ? `${(actualAnnualKwh / 1000).toFixed(2)} MWh`
                : `${actualAnnualKwh.toFixed(0)} kWh`}
            </span>
          </div>
          {(() => {
            const diff = actualAnnualKwh - annualKwh;
            const pct = annualKwh > 0 ? (diff / annualKwh) * 100 : 0;
            const pos = diff >= 0;
            return (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                pos ? "bg-emerald-400/[0.06] border-emerald-400/20" : "bg-red-400/[0.06] border-red-400/20"
              }`}>
                <span className="text-slate-400">{s.difference}</span>
                <span className={`font-bold ${pos ? "text-emerald-400" : "text-red-400"}`}>
                  {pos ? "+" : ""}{pct.toFixed(1)}%
                  {" "}({pos ? "+" : ""}{diff >= 1000 || diff <= -1000
                    ? `${(diff / 1000).toFixed(2)} MWh`
                    : `${diff.toFixed(0)} kWh`})
                </span>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} onClick={canClick ? handleBarClick : undefined}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={canClick ? "pointer" : "default"} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, dy: 50 }} />
              <Tooltip content={<ComparisonTooltip unit={yUnit} hasActual={hasActual} simLabel={s.simulated} actLabel={s.actual} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {hasActual && <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11, color: "#94a3b8" }} formatter={(value) => value === "simulated" ? s.simulated : s.actual} />}
              <Bar dataKey="simulated" name="simulated" fill="#fbbf24" radius={[3, 3, 0, 0]} opacity={0.85} className={canClick ? "cursor-pointer hover:opacity-100" : ""} />
              {hasActual && <Bar dataKey="actual" name="actual" fill="#38bdf8" radius={[3, 3, 0, 0]} opacity={0.75} />}
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} onClick={canClick ? handleBarClick : undefined}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={canClick ? "pointer" : "default"} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, dy: 50 }} />
              <Tooltip content={<ComparisonTooltip unit={yUnit} hasActual={hasActual} simLabel={s.simulated} actLabel={s.actual} />} />
              {hasActual && <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11, color: "#94a3b8" }} formatter={(value) => value === "simulated" ? s.simulated : s.actual} />}
              <Line type="monotone" dataKey="simulated" name="simulated" stroke="#fbbf24" strokeWidth={2} dot={canClick ? { r: 4, fill: "#fbbf24" } : false} activeDot={{ r: 6 }} className={canClick ? "cursor-pointer" : ""} />
              {hasActual && <Line type="monotone" dataKey="actual" name="actual" stroke="#38bdf8" strokeWidth={2} dot={canClick ? { r: 4, fill: "#38bdf8" } : false} activeDot={{ r: 6 }} />}
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} onClick={canClick ? handleBarClick : undefined}>
              <defs>
                <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} cursor={canClick ? "pointer" : "default"} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, dy: 50 }} />
              <Tooltip content={<ComparisonTooltip unit={yUnit} hasActual={hasActual} simLabel={s.simulated} actLabel={s.actual} />} />
              {hasActual && <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11, color: "#94a3b8" }} formatter={(value) => value === "simulated" ? s.simulated : s.actual} />}
              <Area type="monotone" dataKey="simulated" name="simulated" stroke="#fbbf24" strokeWidth={2} fill="url(#simGrad)" dot={canClick ? { r: 4, fill: "#fbbf24" } : false} activeDot={{ r: 6 }} className={canClick ? "cursor-pointer" : ""} />
              {hasActual && <Area type="monotone" dataKey="actual" name="actual" stroke="#38bdf8" strokeWidth={2} fill="url(#actGrad)" dot={canClick ? { r: 4, fill: "#38bdf8" } : false} activeDot={{ r: 6 }} />}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04]">
        {(["year", "month", "day"] as DrillLevel[]).map((l, i) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-medium ${l === level ? "text-amber-400" : "text-slate-600"}`}>
              {l === "year" ? s.annual : l === "month" ? s.monthly : s.daily}
            </span>
            {i < 2 && <span className="text-slate-700 text-[10px]">›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
