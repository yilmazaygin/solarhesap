"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  MapPin, Zap, Settings, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Upload, X, History, FileText,
  Database, Edit3, Search, Download, Calculator,
} from "lucide-react";
import dynamic from "next/dynamic";
import HistoricalComparisonChart from "@/components/charts/HistoricalComparisonChart";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { runHistoricalBasic, runHistoricalAdvanced, searchSamComponents } from "@/lib/api";
import {
  SAM_MODULE_DBS, SAM_INVERTER_DBS, TEMP_MODEL_CONFIGS, TEMP_MODELS,
  DC_MODEL_HINTS, AC_MODEL_HINTS,
} from "@/lib/constants";
import { useLanguage } from "@/context/LanguageContext";

const MapPicker = dynamic(
  () => import("@/components/simulation/MapPicker"),
  { ssr: false }
);

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const HISTORICAL_YEAR_MIN = 2005;
const HISTORICAL_YEAR_MAX = 2022;
const YEARS = Array.from(
  { length: HISTORICAL_YEAR_MAX - HISTORICAL_YEAR_MIN + 1 },
  (_, i) => HISTORICAL_YEAR_MAX - i,
);

const TIERS = [
  { id: "very_low",    label: { en: "Very Low (~14%)",      tr: "Çok Düşük (~14%)" } },
  { id: "low",         label: { en: "Low (~15%)",           tr: "Düşük (~15%)" } },
  { id: "medium",      label: { en: "Medium (~18%)",        tr: "Orta (~18%)" } },
  { id: "medium_high", label: { en: "Medium-High (~20%)",   tr: "Orta-Yüksek (~20%)" } },
  { id: "high",        label: { en: "High (~22%)",          tr: "Yüksek (~22%)" } },
] as const;

type TierId = (typeof TIERS)[number]["id"];

/* ═══════════════════════════════════════════════════════
   Advanced config sub-components
   ═══════════════════════════════════════════════════════ */

interface ModuleConfig {
  source: "database" | "manual";
  db_name: string; module_name: string; module_display: string;
  manual_params_json: string;
}
interface TempConfig {
  source: "lookup" | "manual";
  model: string; config: string; manual_params_json: string;
}
interface InverterConfig {
  source: "database" | "manual";
  db_name: string; inverter_name: string; inverter_display: string;
  manual_params_json: string;
}

function defaultModule(): ModuleConfig {
  return { source: "database", db_name: "CECMod", module_name: "", module_display: "", manual_params_json: '{"pdc0":250,"gamma_pdc":-0.004}' };
}
function defaultTemp(): TempConfig {
  return { source: "lookup", model: "sapm", config: "open_rack_glass_polymer", manual_params_json: '{"a":-3.56,"b":-0.075,"deltaT":3}' };
}
function defaultInverter(): InverterConfig {
  return { source: "database", db_name: "CECInverter", inverter_name: "", inverter_display: "", manual_params_json: '{"pdc0":5000,"eta_inv_nom":0.96}' };
}

const DEMO_ADVANCED = {
  flatTilt: 30,
  flatAzimuth: 180,
  flatMps: 12,
  flatStrings: 1,
  module: { source: "manual" as const, db_name: "CECMod", module_name: "", module_display: "", manual_params_json: '{"pdc0":400,"gamma_pdc":-0.004}' },
  temp: { source: "lookup" as const, model: "sapm", config: "open_rack_glass_polymer", manual_params_json: '{"a":-3.56,"b":-0.075,"deltaT":3}' },
  inverter: { source: "manual" as const, db_name: "CECInverter", inverter_name: "", inverter_display: "", manual_params_json: '{"pdc0":5000,"eta_inv_nom":0.96}' },
  dcModel: "pvwatts",
  acModel: "pvwatts",
};

function SAMSearch({ db, placeholder, selectedName, selectedDisplay, onSelect, onClear }: {
  db: string; placeholder?: string;
  selectedName: string; selectedDisplay: string;
  onSelect: (name: string, display: string) => void; onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await searchSamComponents(db, q, 50) as { results: { name: string }[] };
      setResults(data.results || []); setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [db]);

  if (selectedName) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.06]">
        <Database className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-slate-200 flex-1 truncate">{selectedDisplay || selectedName}</span>
        <button type="button" onClick={onClear} className="text-slate-500 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        <input type="text" value={query} placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (debRef.current) clearTimeout(debRef.current);
            debRef.current = setTimeout(() => doSearch(e.target.value), 350);
          }}
          onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400/50" />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-white/[0.1] bg-slate-900/98 backdrop-blur-xl shadow-xl">
          {results.map((r) => {
            const display = r.name.split("_").join(" ").replace(/\s+/g, " ").trim();
            return (
              <button key={r.name} type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] border-b border-white/[0.04] last:border-0"
                onClick={() => { onSelect(r.name, display); setQuery(""); setResults([]); setOpen(false); }}>
                <p className="text-slate-200 font-medium truncate">{display}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModulePanel({ config, onChange }: { config: ModuleConfig; onChange: (c: ModuleConfig) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["database", "manual"] as const).map((src) => (
          <button key={src} type="button" onClick={() => onChange({ ...config, source: src })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              config.source === src ? "border-amber-400/40 bg-amber-400/15 text-amber-300" : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
            }`}>
            {src === "database" ? <Database className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
            {src === "database" ? "Database" : "Manual"}
          </button>
        ))}
      </div>
      {config.source === "database" ? (
        <div className="space-y-2">
          <select value={config.db_name}
            onChange={(e) => onChange({ ...config, db_name: e.target.value, module_name: "", module_display: "" })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400/50">
            {SAM_MODULE_DBS.map((db) => <option key={db.value} value={db.value}>{db.label}</option>)}
          </select>
          <SAMSearch db={config.db_name} placeholder="Search module…"
            selectedName={config.module_name} selectedDisplay={config.module_display}
            onSelect={(n, d) => onChange({ ...config, module_name: n, module_display: d })}
            onClear={() => onChange({ ...config, module_name: "", module_display: "" })} />
        </div>
      ) : (
        <textarea value={config.manual_params_json} rows={3}
          onChange={(e) => onChange({ ...config, manual_params_json: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-amber-400/50" />
      )}
    </div>
  );
}

function TempPanel({ config, onChange }: { config: TempConfig; onChange: (c: TempConfig) => void }) {
  const configs = TEMP_MODEL_CONFIGS[config.model] || [];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["lookup", "manual"] as const).map((src) => (
          <button key={src} type="button" onClick={() => onChange({ ...config, source: src })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              config.source === src ? "border-amber-400/40 bg-amber-400/15 text-amber-300" : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
            }`}>
            {src === "lookup" ? <Database className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
            {src === "lookup" ? "pvlib Lookup" : "Manual"}
          </button>
        ))}
      </div>
      {config.source === "lookup" ? (
        <div className="grid grid-cols-2 gap-2">
          <select value={config.model}
            onChange={(e) => { const m = e.target.value; onChange({ ...config, model: m, config: TEMP_MODEL_CONFIGS[m]?.[0]?.value || "" }); }}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400/50">
            {TEMP_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={config.config} onChange={(e) => onChange({ ...config, config: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400/50">
            {configs.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      ) : (
        <textarea value={config.manual_params_json} rows={2}
          onChange={(e) => onChange({ ...config, manual_params_json: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-amber-400/50" />
      )}
    </div>
  );
}

function InverterPanel({ config, onChange }: { config: InverterConfig; onChange: (c: InverterConfig) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["database", "manual"] as const).map((src) => (
          <button key={src} type="button" onClick={() => onChange({ ...config, source: src })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              config.source === src ? "border-amber-400/40 bg-amber-400/15 text-amber-300" : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
            }`}>
            {src === "database" ? <Database className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
            {src === "database" ? "Database" : "Manual"}
          </button>
        ))}
      </div>
      {config.source === "database" ? (
        <div className="space-y-2">
          <select value={config.db_name}
            onChange={(e) => onChange({ ...config, db_name: e.target.value, inverter_name: "", inverter_display: "" })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400/50">
            {SAM_INVERTER_DBS.map((db) => <option key={db.value} value={db.value}>{db.label}</option>)}
          </select>
          <SAMSearch db={config.db_name} placeholder="Search inverter…"
            selectedName={config.inverter_name} selectedDisplay={config.inverter_display}
            onSelect={(n, d) => onChange({ ...config, inverter_name: n, inverter_display: d })}
            onClear={() => onChange({ ...config, inverter_name: "", inverter_display: "" })} />
        </div>
      ) : (
        <textarea value={config.manual_params_json} rows={3}
          onChange={(e) => onChange({ ...config, manual_params_json: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-amber-400/50" />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function parseJsonOrNull(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s); } catch { return null; }
}
function buildModuleConfig(m: ModuleConfig) {
  return m.source === "database"
    ? { source: "database", db_name: m.db_name, module_name: m.module_name }
    : { source: "manual", parameters: parseJsonOrNull(m.manual_params_json) };
}
function buildTempConfig(t: TempConfig) {
  return t.source === "lookup"
    ? { source: "lookup", model: t.model, config: t.config }
    : { source: "manual", parameters: parseJsonOrNull(t.manual_params_json) };
}
function buildInverterConfig(inv: InverterConfig) {
  return inv.source === "database"
    ? { source: "database", db_name: inv.db_name, inverter_name: inv.inverter_name }
    : { source: "manual", parameters: parseJsonOrNull(inv.manual_params_json) };
}

function parseActualFile(text: string, ext: string): { datetime: string; ac_kw: number }[] | null {
  try {
    if (ext === "json") {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) return null;
      return arr.filter((r) => r.datetime && typeof r.ac_kw === "number");
    }
    const lines = text.trim().split("\n");
    const header = lines[0].toLowerCase().replace(/\s/g, "");
    if (!header.includes("datetime") || !header.includes("ac_kw")) return null;
    return lines.slice(1).map((l) => {
      const [dt, kw] = l.split(",");
      return { datetime: dt.trim(), ac_kw: parseFloat(kw) };
    }).filter((r) => r.datetime && !isNaN(r.ac_kw));
  } catch { return null; }
}

function SummaryCard({ label, value, unit, sub, tooltip }: { label: string; value: string; unit: string; sub?: string; tooltip?: string }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <p className="text-2xl font-bold text-slate-100">
        {value}<span className="text-sm font-medium text-slate-400 ml-1">{unit}</span>
      </p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResult = Record<string, any>;

export default function HistoricalPage() {
  const { t, language } = useLanguage();
  const tr = (en: string, trStr: string) => language === "tr" ? trStr : en;

  /* ── Mode ─────────────────────────────────────────── */
  const [mode, setMode] = useState<"basic" | "advanced">("basic");

  /* ── Location ─────────────────────────────────────── */
  const [lat, setLat] = useState(38.4192);
  const [lng, setLng] = useState(27.1287);

  const handleMapChange = useCallback((la: number, lo: number) => {
    setLat(la); setLng(lo);
  }, []);

  /* ── Year ─────────────────────────────────────────── */
  const [year, setYear] = useState(2019);

  /* ── Basic mode ─────────────────────────────────────*/
  const [tier, setTier] = useState<TierId>("medium");
  const [areaMode, setAreaMode] = useState<"m2" | "ab">("m2");
  const [areaM2, setAreaM2] = useState(100);
  const [areaA, setAreaA] = useState(10);
  const [areaB, setAreaB] = useState(10);
  const effectiveArea = areaMode === "m2" ? areaM2 : areaA * areaB;

  /* ── Advanced mode ────────────────────────────────── */
  const [flatTilt, setFlatTilt] = useState(DEMO_ADVANCED.flatTilt);
  const [flatAzimuth, setFlatAzimuth] = useState(DEMO_ADVANCED.flatAzimuth);
  const [flatMps, setFlatMps] = useState(DEMO_ADVANCED.flatMps);
  const [flatStrings, setFlatStrings] = useState(DEMO_ADVANCED.flatStrings);
  const [advModule, setAdvModule] = useState<ModuleConfig>(DEMO_ADVANCED.module);
  const [advTemp, setAdvTemp] = useState<TempConfig>(DEMO_ADVANCED.temp);
  const [advInverter, setAdvInverter] = useState<InverterConfig>(DEMO_ADVANCED.inverter);
  const [dcModel, setDcModel] = useState(DEMO_ADVANCED.dcModel);
  const [acModel, setAcModel] = useState(DEMO_ADVANCED.acModel);
  const [showMCConfig, setShowMCConfig] = useState(true);
  const [showModuleSection, setShowModuleSection] = useState(true);
  const [showTempSection, setShowTempSection] = useState(true);
  const [showInverterSection, setShowInverterSection] = useState(true);

  const resetAdvanced = () => {
    setFlatTilt(DEMO_ADVANCED.flatTilt);
    setFlatAzimuth(DEMO_ADVANCED.flatAzimuth);
    setFlatMps(DEMO_ADVANCED.flatMps);
    setFlatStrings(DEMO_ADVANCED.flatStrings);
    setAdvModule(DEMO_ADVANCED.module);
    setAdvTemp(DEMO_ADVANCED.temp);
    setAdvInverter(DEMO_ADVANCED.inverter);
    setDcModel(DEMO_ADVANCED.dcModel);
    setAcModel(DEMO_ADVANCED.acModel);
    setResult(null);
    setError(null);
  };

  useEffect(() => { if (DC_MODEL_HINTS[advModule.db_name]) setDcModel(DC_MODEL_HINTS[advModule.db_name]); }, [advModule.db_name]);
  useEffect(() => { if (AC_MODEL_HINTS[advInverter.db_name]) setAcModel(AC_MODEL_HINTS[advInverter.db_name]); }, [advInverter.db_name]);

  /* ── Upload ───────────────────────────────────────── */
  const [actualData, setActualData] = useState<{ datetime: string; ac_kw: number }[] | null>(null);
  const [actualFileName, setActualFileName] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [showUpload, setShowUpload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setUploadError("");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["json", "csv"].includes(ext)) { setUploadError("Only .json or .csv files accepted."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseActualFile(text, ext);
      if (!parsed || parsed.length === 0) { setUploadError("Could not parse file. Check format."); return; }
      setActualData(parsed); setActualFileName(file.name);
    };
    reader.readAsText(file);
  };

  /* ── Result ───────────────────────────────────────── */
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const validate = (): string | null => {
    if (mode === "advanced") {
      if (advModule.source === "database" && !advModule.module_name) return "No module selected.";
      if (advInverter.source === "database" && !advInverter.inverter_name) return "No inverter selected.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valErr = validate();
    if (valErr) { setError(valErr); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      let data: ApiResult;
      if (mode === "basic") {
        data = await runHistoricalBasic({
          latitude: lat, longitude: lng, elevation: 0, year,
          efficiency_tier: tier,
          ...(areaMode === "m2" ? { area_m2: areaM2 } : { area_a: areaA, area_b: areaB }),
        }) as ApiResult;
      } else {
        data = await runHistoricalAdvanced({
          latitude: lat, longitude: lng, elevation: 0, year,
          use_arrays: false,
          flat_system: {
            surface_tilt: flatTilt, surface_azimuth: flatAzimuth,
            modules_per_string: flatMps, strings_per_inverter: flatStrings,
            module_type: "glass_polymer", racking_model: "open_rack",
            module: buildModuleConfig(advModule),
            temperature_model: buildTempConfig(advTemp),
          },
          inverter: buildInverterConfig(advInverter),
          modelchain_config: { dc_model: dcModel, ac_model: acModel },
        }) as ApiResult;
      }
      setResult(data);
      setTimeout(() => {
        document.getElementById("hist-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  /* ── Downloads ──────────────────────────────────────── */
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    if (!result) return;
    triggerDownload(
      new Blob([JSON.stringify({ generated: new Date().toISOString(), ...result }, null, 2)], { type: "application/json" }),
      `solarhesap_historical_${result.year}_${lat.toFixed(4)}_${lng.toFixed(4)}.json`,
    );
  };

  const downloadCSV = () => {
    if (!result) return;
    const sm = result.summary;
    const rows: (string | number | null | undefined)[][] = [
      ["# Solar Historical Simulation — Solarhesap"],
      ["# Annual Energy Simulated (kWh)", sm.annual_energy_kwh],
      ...(actualAnnualKwh !== undefined ? [
        ["# Annual Energy Actual (kWh)", actualAnnualKwh.toFixed(1)],
        ["# Difference (kWh)", (actualAnnualKwh - sm.annual_energy_kwh).toFixed(1)],
      ] : []),
      [],
      ["Month", "Simulated (kWh)", ...(actualData ? ["Actual (kWh)"] : [])],
      ...(result.monthly ?? []).map((m: Record<string, unknown>) => {
        const actMonthly = actualData
          ? actualData.filter((r) => new Date(r.datetime).getMonth() + 1 === Number(m.month))
              .reduce((s, r) => s + r.ac_kw, 0).toFixed(2)
          : null;
        return actMonthly !== null ? [m.month_name, m.energy_kwh, actMonthly] : [m.month_name, m.energy_kwh];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => (String(c ?? "").includes(",") ? `"${c}"` : c ?? "")).join(",")).join("\n");
    triggerDownload(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `solarhesap_historical_${result.year}_${lat.toFixed(4)}_${lng.toFixed(4)}.csv`,
    );
  };

  /* ── Derived ──────────────────────────────────────── */
  const sys = result?.system_info;
  const sum = result?.summary;
  const hourly: { datetime: string; ac_kw: number }[] = result?.hourly ?? [];
  const annualKwh: number = sum?.annual_energy_kwh ?? 0;
  const actualAnnualKwh = actualData ? actualData.reduce((s, r) => s + r.ac_kw, 0) : undefined;

  return (
    <div className="min-h-screen pt-16 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">

        {/* ════ Top section: Map + Params ════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_340px] gap-5">

          {/* ── Left: Map ── */}
          <div className="glass-card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <MapPin className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">{tr("Location", "Konum Seçimi")}</h2>
            </div>
            <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} height={450} />
            <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-3 text-xs text-slate-500">
              <MapPin className="h-3 w-3 text-amber-400 flex-shrink-0" />
              {lat !== 38.4192 || lng !== 27.1287
                ? <span className="font-mono">{lat.toFixed(4)}°{lat >= 0 ? "K" : "G"}, {lng.toFixed(4)}°{lng >= 0 ? "D" : "B"}</span>
                : <span>{tr("Click the map to select coordinates", "Haritaya tıklayarak konum seçin")}</span>
              }
            </div>
          </div>

          {/* ── Right: Params panel ── */}
          <form onSubmit={handleSubmit} className="glass-card p-0 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <Settings className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">{tr("Simulation Parameters", "Simülasyon Parametreleri")}</h2>
            </div>

            <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">

              {/* Mode toggle */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                {(["basic", "advanced"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      mode === m ? "bg-amber-500 text-slate-900" : "text-slate-400 hover:text-white"
                    }`}>
                    {m === "basic" ? t("historical.basic") : t("historical.advanced")}
                  </button>
                ))}
              </div>

              {/* Lat / Lng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    <MapPin className="h-3 w-3 text-amber-400" />{tr("Latitude (°)", "Enlem (°)")}
                  </label>
                  <input type="number" step="0.0001" min={-90} max={90} value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="input-field py-2.5 text-sm" />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    <MapPin className="h-3 w-3 text-amber-400" />{tr("Longitude (°)", "Boylam (°)")}
                  </label>
                  <input type="number" step="0.0001" min={-180} max={180} value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    className="input-field py-2.5 text-sm" />
                </div>
              </div>

              {/* ── Basic mode: Year + Tier side by side, then Area ── */}
              {mode === "basic" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                        <History className="h-3 w-3 text-amber-400" />
                        {t("historical.year")}
                        <InfoTooltip text={t("historical.ttYear")} />
                      </label>
                      <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="select-field py-2.5 text-sm">
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                        <Zap className="h-3 w-3 text-amber-400" />{tr("Panel Type", "Panel Tipi")}
                      </label>
                      <select value={tier} onChange={(e) => setTier(e.target.value as TierId)} className="select-field py-2.5 text-sm">
                        {TIERS.map((ti) => <option key={ti.id} value={ti.id}>{ti.label[language]}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Area with A×B switch */}
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
                      <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                        {tr("Roof Area", "Panel Alanı")}
                      </span>
                      <InfoTooltip text={t("estimate.ttPackingFactor")} align="left" width={200} />
                      <div className="ml-auto flex items-center rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5 gap-0.5">
                        <button type="button" onClick={() => setAreaMode("m2")}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${areaMode === "m2" ? "bg-amber-400/20 text-amber-300" : "text-slate-600 hover:text-slate-400"}`}>
                          m²
                        </button>
                        <button type="button" onClick={() => setAreaMode("ab")}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${areaMode === "ab" ? "bg-amber-400/20 text-amber-300" : "text-slate-600 hover:text-slate-400"}`}>
                          A×B
                        </button>
                      </div>
                    </div>
                    {areaMode === "m2" ? (
                      <input type="number" step="1" min={1} value={areaM2}
                        onChange={(e) => setAreaM2(parseFloat(e.target.value) || 0)}
                        className="input-field py-2.5 text-sm" />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="0.1" min={0.1} value={areaA}
                          onChange={(e) => setAreaA(parseFloat(e.target.value) || 0)}
                          className="input-field py-2.5 text-sm" placeholder="A (m)" />
                        <input type="number" step="0.1" min={0.1} value={areaB}
                          onChange={(e) => setAreaB(parseFloat(e.target.value) || 0)}
                          className="input-field py-2.5 text-sm" placeholder="B (m)" />
                      </div>
                    )}
                    <p className="text-[10px] text-slate-600 mt-1">
                      ~{Math.round(effectiveArea * 0.85)} m² {tr("usable", "kullanılabilir")}
                      {areaMode === "ab" && <span className="ml-1 text-slate-700">({areaA} × {areaB} = {(areaA * areaB).toFixed(1)} m²)</span>}
                    </p>
                  </div>
                </>
              )}

              {/* ── Advanced mode: Year + Tilt, then Azimuth + Strings ── */}
              {mode === "advanced" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                        <History className="h-3 w-3 text-amber-400" />
                        {t("historical.year")}
                        <InfoTooltip text={t("historical.ttYear")} />
                      </label>
                      <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="select-field py-2.5 text-sm">
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Tilt (°)", "Eğim (°)")}</label>
                      <input type="number" value={flatTilt} min={0} max={90}
                        onChange={(e) => setFlatTilt(parseFloat(e.target.value))}
                        className="input-field py-2.5 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Azimuth (°)", "Azimut (°)")}</label>
                      <input type="number" value={flatAzimuth} min={0} max={359}
                        onChange={(e) => setFlatAzimuth(parseFloat(e.target.value))}
                        className="input-field py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Mod/String", "Mod/String")}</label>
                      <input type="number" value={flatMps} min={1} max={30}
                        onChange={(e) => setFlatMps(parseInt(e.target.value))}
                        className="input-field py-2.5 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Strings/Inverter", "String/İnvertör")}</label>
                    <input type="number" value={flatStrings} min={1} max={20}
                      onChange={(e) => setFlatStrings(parseInt(e.target.value))}
                      className="input-field py-2.5 text-sm" />
                  </div>
                  <p className="text-[10px] text-slate-600">
                    {tr("Module, temperature & inverter config below ↓", "Modül, sıcaklık ve invertör ayarları aşağıda ↓")}
                  </p>
                </div>
              )}

              {/* Upload (always open by default) */}
              <div className="border-t border-white/[0.06] pt-3">
                <button type="button" onClick={() => setShowUpload(!showUpload)}
                  className="flex items-center justify-between w-full mb-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Upload className="h-3.5 w-3.5" />
                    {t("historical.actualData")}
                    <span className="text-[10px] text-slate-600 font-normal">{t("historical.optional")}</span>
                    <InfoTooltip text={t("historical.ttUpload")} />
                    {actualData && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />}
                  </span>
                  {showUpload ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                </button>
                {showUpload && (
                  <div className="space-y-2">
                    {actualData ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-sky-400/30 bg-sky-400/[0.06]">
                        <FileText className="h-4 w-4 text-sky-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 truncate">{actualFileName}</p>
                          <p className="text-[10px] text-slate-500">{actualData.length.toLocaleString()} {tr("hourly records", "saatlik kayıt")}</p>
                        </div>
                        <button type="button" onClick={() => { setActualData(null); setActualFileName(""); }}
                          className="text-slate-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-white/[0.1] hover:border-amber-400/30 cursor-pointer transition-all">
                        <Upload className="h-5 w-5 text-slate-600" />
                        <p className="text-xs text-slate-500 text-center">{t("historical.dropArea")}</p>
                        <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                      </div>
                    )}
                    {uploadError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{uploadError}</p>}
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{t("historical.running")}</>
                  : <><Calculator className="h-4 w-4" />{t("historical.run")}</>
                }
              </button>

              <p className="text-[10px] text-slate-600 text-center">
                PVGIS SARAH · {HISTORICAL_YEAR_MIN}–{HISTORICAL_YEAR_MAX}
              </p>
            </div>
          </form>
        </div>

        {/* ════ Advanced config — below grid, only in advanced mode ════ */}
        {mode === "advanced" && (
          <div className="mt-5 glass-card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <Settings className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">{tr("Advanced Component Config", "Gelişmiş Bileşen Ayarları")}</h2>
              <button type="button" onClick={resetAdvanced}
                className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-white/[0.1] text-slate-400 hover:border-amber-400/30 hover:text-amber-400 transition-all">
                <X className="h-3 w-3" />{tr("Reset", "Sıfırla")}
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
              {/* Module */}
              <div className="pb-4 md:pb-0 md:pr-4">
                <button type="button" onClick={() => setShowModuleSection(!showModuleSection)}
                  className="flex items-center justify-between w-full mb-3">
                  <span className="text-xs font-semibold text-slate-300">{tr("Module", "Modül")}</span>
                  {showModuleSection ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                </button>
                {showModuleSection && <ModulePanel config={advModule} onChange={setAdvModule} />}
              </div>
              {/* Temperature */}
              <div className="py-4 md:py-0 md:px-4">
                <button type="button" onClick={() => setShowTempSection(!showTempSection)}
                  className="flex items-center justify-between w-full mb-3">
                  <span className="text-xs font-semibold text-slate-300">{tr("Temperature Model", "Sıcaklık Modeli")}</span>
                  {showTempSection ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                </button>
                {showTempSection && <TempPanel config={advTemp} onChange={setAdvTemp} />}
              </div>
            </div>
            <div className="border-t border-white/[0.05] p-4 grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
              {/* Inverter */}
              <div className="pb-4 md:pb-0 md:pr-4">
                <button type="button" onClick={() => setShowInverterSection(!showInverterSection)}
                  className="flex items-center justify-between w-full mb-3">
                  <span className="text-xs font-semibold text-slate-300">{tr("Inverter", "İnvertör")}</span>
                  {showInverterSection ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                </button>
                {showInverterSection && <InverterPanel config={advInverter} onChange={setAdvInverter} />}
              </div>
              {/* ModelChain */}
              <div className="pt-4 md:pt-0 md:pl-4">
                <button type="button" onClick={() => setShowMCConfig(!showMCConfig)}
                  className="flex items-center justify-between w-full mb-3">
                  <span className="text-xs font-semibold text-slate-300">ModelChain Config</span>
                  {showMCConfig ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                </button>
                {showMCConfig && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">DC Model</label>
                      <select value={dcModel} onChange={(e) => setDcModel(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400/50">
                        {["cec", "pvwatts", "sapm", "desoto"].map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">AC Model</label>
                      <select value={acModel} onChange={(e) => setAcModel(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400/50">
                        {["sandia", "pvwatts", "adr"].map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ Results below ════ */}
        {(loading || result) && (
          <div id="hist-results" className="mt-6 space-y-5">

            {loading && (
              <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="h-10 w-10 text-amber-400 animate-spin mb-4" />
                <p className="text-slate-400 text-sm">{t("historical.running")}</p>
                <p className="text-slate-600 text-xs mt-1">{tr("~15–30 seconds", "~15–30 saniye sürebilir")}</p>
              </div>
            )}

            {result && (
              <>
                {/* Download toolbar */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{result.year} {tr("simulation ready", "simülasyonu hazır")}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={downloadJSON}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all">
                      <Download className="h-3.5 w-3.5 text-amber-400" />JSON
                    </button>
                    <button type="button" onClick={downloadCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all">
                      <Download className="h-3.5 w-3.5 text-amber-400" />CSV
                    </button>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SummaryCard
                    label={`${result.year} ${t("historical.simulated")}`}
                    value={annualKwh >= 1000 ? (annualKwh / 1000).toFixed(1) : annualKwh.toFixed(0)}
                    unit={annualKwh >= 1000 ? "MWh" : "kWh"}
                    sub={tr("PVGIS actual irradiance", "gerçek PVGIS ışınımı")}
                    tooltip={t("historical.ttYear")} />
                  {actualAnnualKwh !== undefined && (
                    <SummaryCard
                      label={t("historical.measured")}
                      value={actualAnnualKwh >= 1000 ? (actualAnnualKwh / 1000).toFixed(1) : actualAnnualKwh.toFixed(0)}
                      unit={actualAnnualKwh >= 1000 ? "MWh" : "kWh"}
                      sub={tr("from uploaded data", "yüklenen veriden")} />
                  )}
                  {sum?.specific_yield_kwh_kwp > 0 && (
                    <SummaryCard label={t("estimate.specificYield")}
                      value={sum.specific_yield_kwh_kwp.toFixed(0)} unit="kWh/kWp"
                      sub={tr("per kW DC installed", "kurulu kW başına")}
                      tooltip={t("estimate.ttSpecificYield")} />
                  )}
                  {sum?.capacity_factor_pct > 0 && (
                    <SummaryCard label={t("estimate.capacityFactor")}
                      value={sum.capacity_factor_pct.toFixed(1)} unit="%"
                      sub={tr("Annual / (AC × 8760)", "yıllık / (AC × 8760)")}
                      tooltip={t("estimate.ttCapacityFactor")} />
                  )}
                </div>

                {/* DC/AC warning */}
                {sys?.dc_ac_warning && sys.dc_ac_ratio !== undefined && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {sys.dc_ac_ratio < 0.90
                        ? tr(
                            `DC/AC ratio is ${sys.dc_ac_ratio.toFixed(2)} (below 0.90). System is significantly under-invertered. Consider a smaller inverter for this system size.`,
                            `DC/AC oranı ${sys.dc_ac_ratio.toFixed(2)} (0,90'ın altında). Sistem kayda değer ölçüde yetersiz invertörlü. Bu sistem boyutu için daha küçük bir invertör değerlendirin.`
                          )
                        : tr(
                            `DC/AC ratio is ${sys.dc_ac_ratio.toFixed(2)} (above 1.45). Significant clipping expected during peak hours.`,
                            `DC/AC oranı ${sys.dc_ac_ratio.toFixed(2)} (1,45'in üstünde). Pik saatlerde önemli kırpma bekleniyor.`
                          )
                      }
                    </span>
                  </div>
                )}

                {/* System at a glance */}
                {sys?.n_panels && (
                  <div className="glass-card">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t("estimate.systemGlance")}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: t("estimate.panels"), value: String(sys.n_panels), sub: `${sys.modules_per_string}S × ${sys.n_strings}str` },
                        { label: "DC / AC", value: sys.dc_ac_ratio?.toFixed(2) ?? "—", sub: `${sys.total_dc_kw} kWp / ${sys.total_ac_kw} kW` },
                        { label: tr("Tier", "Verimlilik"), value: sys.tier_label?.split("(")[0]?.trim() ?? "—", sub: sys.module_efficiency_pct ? `${sys.module_efficiency_pct}%` : "" },
                        { label: tr("Tilt / Az", "Eğim / Az"), value: `${sys.surface_tilt_deg ?? "—"}°`, sub: sys.surface_azimuth_deg === 180 ? t("estimate.southFacing") : `${sys.surface_azimuth_deg}°` },
                      ].map((item) => (
                        <div key={item.label} className="bg-white/[0.02] rounded-lg px-3 py-2.5 border border-white/[0.04]">
                          <p className="text-[10px] text-slate-600 uppercase tracking-wide">{item.label}</p>
                          <p className="text-base font-bold text-slate-200 mt-0.5">{item.value}</p>
                          {item.sub && <p className="text-[10px] text-slate-600">{item.sub}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chart */}
                <HistoricalComparisonChart
                  hourlyData={hourly} actualData={actualData ?? undefined}
                  annualKwh={annualKwh} actualAnnualKwh={actualAnnualKwh} year={result.year} />

                {/* Details */}
                {sys && Object.keys(sys).length > 0 && (
                  <div className="glass-card">
                    <button type="button" onClick={() => setDetailsOpen((o) => !o)}
                      className="flex items-center justify-between w-full">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("estimate.fullDetails")}</h3>
                      {detailsOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </button>
                    {detailsOpen && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          [tr("Module", "Modül"), sys.module_name?.replace(/_/g, " ")],
                          [tr("Module Power (STC)", "Modül Gücü (STC)"), sys.module_stc_w ? `${sys.module_stc_w} W` : null],
                          [tr("Module Efficiency", "Modül Verimliliği"), sys.module_efficiency_pct ? `${sys.module_efficiency_pct} %` : null],
                          [tr("Inverter", "İnvertör"), sys.inverter_name?.replace(/_/g, " ")],
                          [tr("Panels", "Panel Sayısı"), sys.n_panels],
                          [tr("Total DC", "DC Kapasite"), sys.total_dc_kw ? `${sys.total_dc_kw} kWp` : null],
                          [tr("Total AC", "AC Kapasite"), sys.total_ac_kw ? `${sys.total_ac_kw} kW` : null],
                          ["DC / AC", sys.dc_ac_ratio?.toFixed(2)],
                          [tr("Tilt", "Eğim"), sys.surface_tilt_deg !== undefined ? `${sys.surface_tilt_deg}°` : null],
                          [tr("Azimuth", "Azimut"), sys.surface_azimuth_deg !== undefined ? `${sys.surface_azimuth_deg}°` : null],
                          [tr("System Losses", "Sistem Kayıpları"), sum?.system_loss_pct ? `${sum.system_loss_pct} %` : null],
                        ].filter(([, v]) => v != null).map(([label, val]) => (
                          <div key={String(label)} className="flex items-start justify-between gap-2 py-1.5 border-b border-white/[0.04]">
                            <span className="text-[11px] text-slate-500">{label}</span>
                            <span className="text-[11px] text-slate-300 font-medium text-right break-all max-w-[55%]">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-slate-600 text-center">
                  {tr(
                    `Weather: ${result?.metadata?.weather_source}.${sum?.system_loss_pct > 0 ? ` System losses: ${sum.system_loss_pct}% applied.` : ""}`,
                    `Hava: ${result?.metadata?.weather_source}.${sum?.system_loss_pct > 0 ? ` Sistem kayıpları: ${sum.system_loss_pct}% uygulandı.` : ""}`,
                  )}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
