"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  MapPin, Zap, Settings, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Upload, X, History, FileText,
  Database, Edit3, Search, Download, Calculator, FileJson
} from "lucide-react";
import dynamic from "next/dynamic";
import HistoricalComparisonChart from "@/components/charts/HistoricalComparisonChart";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { runHistoricalBasic, runHistoricalAdvanced } from "@/lib/api";
import {
  SAM_MODULE_DBS, SAM_INVERTER_DBS, TEMP_MODEL_CONFIGS, TEMP_MODELS,
  DC_MODEL_HINTS, AC_MODEL_HINTS, AOI_MODELS, SPECTRAL_MODELS, LOSSES_MODELS, DC_MODELS, AC_MODELS
} from "@/lib/constants";
import { ModuleConfig, TempConfig, InverterConfig, ArrayState, defaultModuleConfig, DEFAULT_FLAT_MODULE, DEFAULT_INVERTER, defaultTempConfig, defaultArray } from "@/lib/advanced-types";
import ModulePanel from "@/components/simulation/advanced/ModulePanel";
import TempPanel from "@/components/simulation/advanced/TempPanel";
import InverterPanel from "@/components/simulation/advanced/InverterPanel";
import { useLanguage } from "@/context/LanguageContext";
import GlassCard from "@/components/shared/GlassCard";
import Modal from "@/components/shared/Modal";

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
  const [infoModalOpen, setInfoModalOpen] = useState(false);

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
  const [useArrays, setUseArrays] = useState(false);

  // Flat system
  const [flatTilt, setFlatTilt] = useState(30);
  const [flatAzimuth, setFlatAzimuth] = useState(180);
  const [flatMps, setFlatMps] = useState(10);
  const [flatStrings, setFlatStrings] = useState(2);
  const [advModule, setAdvModule] = useState<ModuleConfig>(DEFAULT_FLAT_MODULE);
  const [advTemp, setAdvTemp] = useState<TempConfig>(defaultTempConfig());

  // Arrays
  const [pvArrays, setPvArrays] = useState<ArrayState[]>([defaultArray("1")]);

  const addArray = () => setPvArrays((prev) => [...prev, defaultArray(String(Date.now()))]);
  const removeArray = (id: string) => setPvArrays((prev) => prev.filter((a) => a.id !== id));
  const updateArray = (id: string, patch: Partial<ArrayState>) =>
    setPvArrays((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // Inverter
  const [advInverter, setAdvInverter] = useState<InverterConfig>(DEFAULT_INVERTER);

  // ModelChain config
  const [showMCConfig, setShowMCConfig] = useState(false);
  const [showModuleSection, setShowModuleSection] = useState(true);
  const [showTempSection, setShowTempSection] = useState(true);
  const [showInverterSection, setShowInverterSection] = useState(true);
  const [dcModel, setDcModel] = useState("cec");
  const [acModel, setAcModel] = useState("sandia");
  const [aoiModel, setAoiModel] = useState("physical");
  const [spectralModel, setSpectralModel] = useState("no_loss");
  const [tempModelOverride, setTempModelOverride] = useState("");
  const [lossesModel, setLossesModel] = useState("no_loss");

  const resetAdvanced = () => {
    setUseArrays(false);
    setFlatTilt(30);
    setFlatAzimuth(180);
    setFlatMps(10);
    setFlatStrings(2);
    setAdvModule(DEFAULT_FLAT_MODULE);
    setAdvTemp(defaultTempConfig());
    setPvArrays([defaultArray("1")]);
    setAdvInverter(DEFAULT_INVERTER);
    setDcModel("cec");
    setAcModel("sandia");
    setAoiModel("physical");
    setSpectralModel("no_loss");
    setTempModelOverride("");
    setLossesModel("no_loss");
    setResult(null);
    setError(null);
  };

  useEffect(() => { if (DC_MODEL_HINTS[advModule.db_name]) setDcModel(DC_MODEL_HINTS[advModule.db_name]); }, [advModule.db_name]);
  useEffect(() => { if (AC_MODEL_HINTS[advInverter.db_name]) setAcModel(AC_MODEL_HINTS[advInverter.db_name]); }, [advInverter.db_name]);

  /* ── Upload ───────────────────────────────────────── */
  const [actualData, setActualData] = useState<{ datetime: string; ac_kw: number }[] | null>(null);
  const [actualFileName, setActualFileName] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [showUpload, setShowUpload] = useState(false);
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
        const payload: Record<string, any> = {
          latitude: lat, longitude: lng, elevation: 0, year,
          use_arrays: useArrays,
          inverter: buildInverterConfig(advInverter),
          modelchain_config: {
            dc_model: dcModel,
            ac_model: acModel,
            aoi_model: aoiModel,
            spectral_model: spectralModel,
            losses_model: lossesModel,
            temperature_model: tempModelOverride || undefined,
          },
        };

        if (!useArrays) {
          payload.flat_system = {
            surface_tilt: flatTilt, surface_azimuth: flatAzimuth,
            modules_per_string: flatMps, strings_per_inverter: flatStrings,
            module_type: "glass_polymer", racking_model: "open_rack",
            module: buildModuleConfig(advModule),
            temperature_model: buildTempConfig(advTemp),
          };
        } else {
          payload.arrays = pvArrays.map((arr) => ({
            name: arr.name || undefined,
            surface_tilt: arr.surface_tilt,
            surface_azimuth: arr.surface_azimuth,
            modules_per_string: arr.modules_per_string,
            strings: arr.strings,
            module_type: arr.module_type,
            albedo: arr.albedo ? parseFloat(arr.albedo) : undefined,
            module: buildModuleConfig(arr.module),
            temperature_model: buildTempConfig(arr.temperature_model),
          }));
        }

        data = await runHistoricalAdvanced(payload) as ApiResult;
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
      ...(result.monthly ?? []).map((m: any) => {
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
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">

        {/* ════ Header ════ */}
        <div className="mb-10 animate-fade-in flex flex-col items-center justify-center text-center gap-4 relative">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              {tr("Historical", "Tarihsel")} <span>{tr("Production", "Üretim")}</span>
            </h1>
            <p className="text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
              {tr(
                "Simulate historical PV energy yield over past years and compare it side-by-side with your actual measured production data. This capability is vital for diagnosing system degradation, evaluating actual performance ratios, and auditing the reliability of past weather databases.",
                "Geçmiş yıllara ait PV enerji üretimini simüle edin ve bu sonuçları gerçek ölçülen üretim verilerinizle yan yana karşılaştırın. Bu özellik, sistem degradasyonunu teşhis etmek, gerçek performans oranlarını değerlendirmek ve geçmiş hava durumu veritabanlarının güvenilirliğini denetlemek için kritik öneme sahiptir."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInfoModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 transition-all text-sm font-medium"
          >
            <AlertCircle className="h-4 w-4" />
            {tr("How to use this module?", "Bu modül nasıl kullanılır?")}
          </button>
        </div>

        <Modal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} title={tr("How to Use: Historical Production", "Nasıl Kullanılır: Tarihsel Üretim")}>
          <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            <p>
              {tr(
                "This module allows you to simulate solar energy production for a specific past year and optionally compare it against your actual system generation data.",
                "Bu modül, geçmişteki belirli bir yıl için güneş enerjisi üretimini simüle etmenize ve isterseniz gerçek sistem üretim verilerinizle karşılaştırmanıza olanak tanır."
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{tr("Simulation Mode:", "Simülasyon Modu:")}</strong> {tr("Use 'Basic' for simple area-based calculations, or 'Advanced' to select specific panels and inverters from the database.", "Basit alan tabanlı hesaplamalar için 'Basic', veritabanından belirli panel ve invertörleri seçmek için 'Advanced' modunu kullanın.")}</li>
              <li><strong>{tr("Year:", "Yıl:")}</strong> {tr("Select the historical year to simulate. PVGIS uses satellite data for that specific year.", "Simüle edilecek geçmiş yılı seçin. PVGIS, o yıl için uydu verilerini kullanır.")}</li>
              <li><strong>{tr("Actual Data (Optional):", "Gerçek Veri (İsteğe Bağlı):")}</strong> {tr("Upload a CSV or JSON file containing your actual hourly AC generation data to see side-by-side comparison charts and error margins.", "Yan yana karşılaştırma grafiklerini ve hata paylarını görmek için gerçek saatlik AC üretim verilerinizi içeren bir CSV veya JSON dosyası yükleyin.")}</li>
            </ul>
          </div>
        </Modal>

        <div className="mt-6 space-y-6 animate-slide-up">
          {/* ── Location ── */}
          <GlassCard>
            <h2 className="section-heading text-lg mb-4">📍 {tr("Location", "Konum")}</h2>
            <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="input-label">{tr("Latitude (°)", "Enlem (°)")}</label>
                <input
                  type="number" step="0.0001" min={-90} max={90} value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">{tr("Longitude (°)", "Boylam (°)")}</label>
                <input
                  type="number" step="0.0001" min={-180} max={180} value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            </div>
          </GlassCard>

          {/* ── Settings ── */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-heading text-lg">⚙️ {tr("Simulation Parameters", "Simülasyon Parametreleri")}</h2>
                {/* Mode toggle */}
                <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  {(["basic", "advanced"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        mode === m ? "bg-amber-500 text-slate-900" : "text-slate-400 hover:text-white"
                      }`}>
                      {m === "basic" ? t("historical.basic") : t("historical.advanced")}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Basic mode: Year + Tier side by side, then Area ── */}
              {mode === "basic" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col">
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 min-h-[32px]">
                      <History className="h-3 w-3 text-amber-400" />
                      {t("historical.year")}
                      <InfoTooltip text={t("historical.ttYear")} />
                    </label>
                      <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="select-field">
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 min-h-[32px]">
                      <Zap className="h-3 w-3 text-amber-400" />{tr("Panel Type", "Panel Tipi")}
                    </label>
                      <select value={tier} onChange={(e) => setTier(e.target.value as TierId)} className="select-field">
                        {TIERS.map((ti) => <option key={ti.id} value={ti.id}>{ti.label[language]}</option>)}
                      </select>
                  </div>
                  {/* Area with A×B switch */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-1 mb-1.5 min-h-[32px]">
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                          {tr("Roof Area", "Panel Alanı")}
                        </span>
                        <InfoTooltip text={t("estimate.ttPackingFactor")} align="left" width={200} />
                      </div>
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
                        className="input-field" />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="0.1" min={0.1} value={areaA}
                          onChange={(e) => setAreaA(parseFloat(e.target.value) || 0)}
                          className="input-field" placeholder="A (m)" />
                        <input type="number" step="0.1" min={0.1} value={areaB}
                          onChange={(e) => setAreaB(parseFloat(e.target.value) || 0)}
                          className="input-field" placeholder="B (m)" />
                      </div>
                    )}
                      <p className="text-[10px] text-slate-600 mt-1">
                        ~{Math.round(effectiveArea * 0.85)} m² {tr("usable", "kullanılabilir")}
                        {areaMode === "ab" && <span className="ml-1 text-slate-700">({areaA} × {areaB} = {(areaA * areaB).toFixed(1)} m²)</span>}
                      </p>
                  </div>
                </div>
              )}

              {/* ── Advanced mode: Year + Tilt, then Azimuth + Strings ── */}
              {mode === "advanced" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                      <History className="h-3 w-3 text-amber-400" />
                      {t("historical.year")}
                      <InfoTooltip text={t("historical.ttYear")} />
                    </label>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="select-field">
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Tilt (°)", "Eğim (°)")}</label>
                    <input type="number" value={flatTilt} min={0} max={90}
                      onChange={(e) => setFlatTilt(parseFloat(e.target.value))}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Azimuth (°)", "Azimut (°)")}</label>
                    <input type="number" value={flatAzimuth} min={0} max={359}
                      onChange={(e) => setFlatAzimuth(parseFloat(e.target.value))}
                      className="input-field" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Mod/Str", "Mod/Str")}</label>
                      <input type="number" value={flatMps} min={1} max={30}
                        onChange={(e) => setFlatMps(parseInt(e.target.value))}
                        className="input-field" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">{tr("Str/Inv", "Str/Inv")}</label>
                      <input type="number" value={flatStrings} min={1} max={20}
                        onChange={(e) => setFlatStrings(parseInt(e.target.value))}
                        className="input-field" />
                    </div>
                  </div>
                </div>
              )}

              {/* Upload */}
              <div className="border-t border-white/[0.06] pt-6 mt-2">
                <div className="flex items-center justify-between w-full mb-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Upload className="h-4 w-4 text-amber-400" />
                    {tr("Compare with your own production data", "Kendi üretim verinizle kıyaslayın")}
                    <InfoTooltip text={t("historical.ttUpload")} />
                    {actualData && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setShowUpload(!showUpload)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      showUpload ? "bg-amber-400" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        showUpload ? "translate-x-4.5" : "translate-x-1"
                      }`}
                      style={{ transform: showUpload ? 'translateX(18px)' : 'translateX(4px)' }}
                    />
                  </button>
                </div>
                {showUpload && (
                  <div className="space-y-2 animate-fade-in">
                    {actualData ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl border border-sky-400/30 bg-sky-400/[0.06]">
                        <FileText className="h-5 w-5 text-sky-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 font-medium truncate">{actualFileName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{actualData.length.toLocaleString()} {tr("hourly records", "saatlik kayıt")}</p>
                        </div>
                        <button type="button" onClick={() => { setActualData(null); setActualFileName(""); }}
                          className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-colors"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-amber-400/30 hover:bg-amber-400/[0.02] cursor-pointer transition-all">
                        <Upload className="h-8 w-8 text-slate-500" />
                        <p className="text-sm text-slate-400 text-center font-medium">{t("historical.dropArea")}</p>
                        <p className="text-xs text-slate-500 text-center">CSV or JSON format</p>
                        <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                      </div>
                    )}
                    {uploadError && <p className="text-xs text-red-400 flex items-center gap-1.5 mt-2"><AlertCircle className="h-3.5 w-3.5" />{uploadError}</p>}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* ════ Advanced config — below grid, only in advanced mode ════ */}
            {mode === "advanced" && (
              <div className="mt-5 space-y-6 animate-fade-in">
                {/* ── Array Mode Toggle ── */}
                <GlassCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="section-heading text-lg mb-1">📐 {tr("Sistem Topolojisi", "System Topology")}</h2>
                      <p className="text-xs text-slate-400">
                        {useArrays
                          ? tr("Birden fazla PV dizisi tanımlı. Farklı eğim/yön veya panel tipleri kullanılabilir.", "Multiple PV arrays defined. Different tilt/azimuth or modules can be used.")
                          : tr("Basit tekli sistem devrede. Gelişmiş çoklu dizi için sağdaki butonu kullanın.", "Simple flat system is active. Switch to multi-array for complex topologies.")}
                      </p>
                    </div>
                    <button type="button" onClick={() => setUseArrays(!useArrays)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useArrays ? "bg-amber-500" : "bg-slate-700"
                      }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useArrays ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </GlassCard>

                {/* ── Flat System Config ── */}
                {!useArrays && (
                  <GlassCard>
                    <h2 className="section-heading text-lg mb-4">☀️ {tr("Sistem Konfigürasyonu", "System Configuration")}</h2>
                    <div className="border-t border-white/[0.06] pt-4 space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-3">
                          🔆 {tr("Modül Seçimi", "Module Selection")}
                        </h3>
                        <ModulePanel config={advModule} onChange={setAdvModule} />
                      </div>
                      <div className="border-t border-white/[0.06] pt-4">
                        <h3 className="text-sm font-semibold text-slate-300 mb-3">
                          🌡️ {tr("Sıcaklık Modeli", "Temperature Model")}
                        </h3>
                        <TempPanel config={advTemp} onChange={setAdvTemp} />
                      </div>
                    </div>
                  </GlassCard>
                )}

                {/* ── Multi-Array Config ── */}
                {useArrays && (
                  <GlassCard>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="section-heading text-lg">📐 {tr("PV Dizileri", "PV Arrays")}</h2>
                      <button type="button" onClick={addArray} className="btn-secondary text-xs flex items-center gap-1.5">
                        {tr("Dizi Ekle", "Add Array")}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {pvArrays.map((arr, idx) => (
                        <div key={arr.id} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-amber-400">
                              Array {idx + 1}{arr.name ? ` — ${arr.name}` : ""}
                            </h4>
                            {pvArrays.length > 1 && (
                              <button type="button" onClick={() => removeArray(arr.id)}
                                className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-400/10 transition-all">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div>
                              <label className="input-label">{tr("Ad (isteğe bağlı)", "Name (optional)")}</label>
                              <input type="text" value={arr.name}
                                onChange={(e) => updateArray(arr.id, { name: e.target.value })} className="input-field text-sm" />
                            </div>
                            <div>
                              <label className="input-label">{tr("Eğim (°)", "Tilt (°)")}</label>
                              <input type="number" value={arr.surface_tilt} min={0} max={90}
                                onChange={(e) => updateArray(arr.id, { surface_tilt: parseFloat(e.target.value) })} className="input-field text-sm" />
                            </div>
                            <div>
                              <label className="input-label">{tr("Azimut (°)", "Azimuth (°)")}</label>
                              <input type="number" value={arr.surface_azimuth} min={0} max={359}
                                onChange={(e) => updateArray(arr.id, { surface_azimuth: parseFloat(e.target.value) })} className="input-field text-sm" />
                            </div>
                            <div>
                              <label className="input-label">{tr("Modül/Dizi", "Modules/String")}</label>
                              <input type="number" value={arr.modules_per_string} min={1}
                                onChange={(e) => updateArray(arr.id, { modules_per_string: parseInt(e.target.value) })} className="input-field text-sm" />
                            </div>
                            <div>
                              <label className="input-label">{tr("Dizi Sayısı", "Strings")}</label>
                              <input type="number" value={arr.strings} min={1}
                                onChange={(e) => updateArray(arr.id, { strings: parseInt(e.target.value) })} className="input-field text-sm" />
                            </div>
                            <div>
                              <label className="input-label">{tr("Modül Tipi", "Module Type")}</label>
                              <select value={arr.module_type}
                                onChange={(e) => updateArray(arr.id, { module_type: e.target.value })} className="select-field text-sm">
                                <option value="glass_polymer">Glass / Polymer</option>
                                <option value="glass_glass">Glass / Glass</option>
                              </select>
                            </div>
                            <div>
                              <label className="input-label">{tr("Albedo (isteğe bağlı)", "Albedo (optional)")}</label>
                              <input type="number" step="0.01" value={arr.albedo} min={0} max={1}
                                onChange={(e) => updateArray(arr.id, { albedo: e.target.value })} className="input-field text-sm"
                                placeholder="0.25" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/[0.06] pt-3">
                            <div>
                              <h5 className="text-xs font-semibold text-slate-400 mb-2">🔆 {tr("Modül", "Module")}</h5>
                              <ModulePanel
                                config={arr.module}
                                onChange={(m) => updateArray(arr.id, { module: m })}
                              />
                            </div>
                            <div>
                              <h5 className="text-xs font-semibold text-slate-400 mb-2">🌡️ {tr("Sıcaklık", "Temp Model")}</h5>
                              <TempPanel
                                config={arr.temperature_model}
                                onChange={(t) => updateArray(arr.id, { temperature_model: t })}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {/* ── Inverter ── */}
                <GlassCard>
                  <h2 className="section-heading text-lg mb-4">⚡ {tr("Evirici (Sistem Düzeyi)", "Inverter (System Level)")}</h2>
                  <InverterPanel config={advInverter} onChange={setAdvInverter} />
                </GlassCard>

                {/* ── ModelChain Config ── */}
                <GlassCard>
                  <button type="button" className="flex items-center justify-between w-full"
                    onClick={() => setShowMCConfig(!showMCConfig)}>
                    <h2 className="section-heading text-lg">⚙️ {tr("ModelChain Konfigürasyonu", "ModelChain Configuration")}</h2>
                    {showMCConfig ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                  </button>
                  {showMCConfig && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="input-label">DC Model</label>
                          <select value={dcModel} onChange={(e) => setDcModel(e.target.value)} className="select-field">
                            <option value="">Auto</option>
                            {DC_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">AC Model</label>
                          <select value={acModel} onChange={(e) => setAcModel(e.target.value)} className="select-field">
                            <option value="">Auto</option>
                            {AC_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">AOI Model</label>
                          <select value={aoiModel} onChange={(e) => setAoiModel(e.target.value)} className="select-field">
                            <option value="">Auto</option>
                            {AOI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Spectral Model</label>
                          <select value={spectralModel} onChange={(e) => setSpectralModel(e.target.value)} className="select-field">
                            <option value="">Auto</option>
                            {SPECTRAL_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Losses Model</label>
                          <select value={lossesModel} onChange={(e) => setLossesModel(e.target.value)} className="select-field">
                            <option value="">Auto</option>
                            <option value="pvwatts">PVWatts</option>
                            <option value="no_loss">No Loss</option>
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Temperature Model Override</label>
                          <select value={tempModelOverride} onChange={(e) => setTempModelOverride(e.target.value)} className="select-field">
                            <option value="">Auto</option>
                            <option value="sapm">SAPM</option>
                            <option value="pvsyst">PVsyst</option>
                            <option value="faiman">Faiman</option>
                            <option value="fuentes">Fuentes</option>
                            <option value="noct_sam">NOCT SAM</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
              </div>
            )}

            {/* Submit */}
            <div className="text-center">
              <button type="submit" disabled={loading} className="w-full sm:w-2/3 md:w-1/2 mx-auto mt-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-xl shadow-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <><Loader2 className="h-6 w-6 animate-spin" />{t("historical.running")}</>
                  : <><Calculator className="h-6 w-6" />{t("historical.run")}</>
                }
              </button>
              <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1 mt-3">
                PVGIS SARAH · {HISTORICAL_YEAR_MIN}–{HISTORICAL_YEAR_MAX}
              </p>
            </div>
          </form>
        </div>



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

                {/* Downloads */}
                <div className="glass-card mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Download className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-slate-200">{tr("Download Results", "Sonuçları İndir")}</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button type="button" onClick={downloadJSON}
                      className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-400/10">
                        <FileJson className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{tr("Download JSON", "JSON İndir")}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{`solarhesap_historical_${result.year}_${lat.toFixed(4)}_${lng.toFixed(4)}.json`}</p>
                      </div>
                    </button>
                    <button type="button" onClick={downloadCSV}
                      className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10">
                        <Download className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{tr("Download CSV", "CSV İndir")}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{`solarhesap_historical_${result.year}_${lat.toFixed(4)}_${lng.toFixed(4)}.csv`}</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* DC/AC warning (moved below downloads) */}
                {sys?.dc_ac_warning && sys.dc_ac_ratio !== undefined && (
                  <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs leading-relaxed mt-4">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {sys.dc_ac_ratio < 0.90
                        ? tr(
                            `DC/AC ratio is ${sys.dc_ac_ratio.toFixed(2)}. The system is significantly under-invertered. Note: This warning is based on auto-generated system assumptions. For detailed analysis and custom inverter sizing, please use the "Advanced Forecast" module.`,
                            `DC/AC oranı ${sys.dc_ac_ratio.toFixed(2)}. Sistem kayda değer ölçüde yetersiz invertörlü (büyük invertör seçilmiş). Not: Bu uyarı, otomatik oluşturulan sistem varsayımlarına dayanmaktadır. Daha detaylı analiz ve kendi invertörünüzü belirlemek için lütfen "Gelişmiş Tahmin" sayfasına gidin.`
                          )
                        : tr(
                            `DC/AC ratio is ${sys.dc_ac_ratio.toFixed(2)}. Significant clipping losses are expected during peak hours. Note: This warning is based on auto-generated system assumptions. For detailed analysis and custom inverter sizing, please use the "Advanced Forecast" module.`,
                            `DC/AC oranı ${sys.dc_ac_ratio.toFixed(2)}. Pik saatlerde önemli miktarda kırpma (clipping) kaybı bekleniyor. Not: Bu uyarı, otomatik oluşturulan sistem varsayımlarına dayanmaktadır. Daha detaylı analiz ve kendi invertörünüzü belirlemek için lütfen "Gelişmiş Tahmin" sayfasına gidin.`
                          )
                      }
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
