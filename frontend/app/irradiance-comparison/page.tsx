"use client";

import { useState, useCallback } from "react";
import {
  MapPin, Settings, Play, Download,
  ChevronDown, ChevronUp, FileJson, BarChart2, CheckCircle2, Circle, AlertCircle, Loader2
} from "lucide-react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/context/LanguageContext";
import { runDeepComparison } from "@/lib/api";
import { TIMEZONES, DEFAULTS } from "@/lib/constants";
import GlassCard from "@/components/shared/GlassCard";
import Modal from "@/components/shared/Modal";
import adminConfig from "@/config/admin.json";

const MapPicker = dynamic(
  () => import("@/components/simulation/MapPicker"),
  { ssr: false }
);

const ComparisonChart = dynamic(
  () => import("@/components/charts/ComparisonChart"),
  { ssr: false }
);

/* ─── Types ──────────────────────────────────────────── */

interface ComparisonMatrixResponse {
  location: { latitude: number; longitude: number; elevation: number };
  year_range: { start_year: number; end_year: number };
  summary_matrix: Record<string, Record<string, number | null>>;
  comparison: Record<string, any>;
}

/* ─── Constants ──────────────────────────────────────── */

const MODEL_OPTIONS = [
  { id: "instesre_bird", label: "INSTESRE Bird" },
  { id: "ineichen", label: "Ineichen / Perez" },
  { id: "simplified_solis", label: "Simplified Solis" },
  { id: "pvlib_bird", label: "pvlib Bird" },
];

const MODEL_LABELS: Record<string, string> = {
  instesre_bird: "INSTESRE Bird",
  ineichen: "Ineichen / Perez",
  simplified_solis: "Simplified Solis",
  pvlib_bird: "pvlib Bird",
  pvgis_tmy: "PVGIS TMY",
};

const STRATEGY_LABELS: Record<string, string> = {
  simple_mean: "Simple Mean",
  trimmed_mean: "Trimmed Mean",
  exponential_weighted: "Exponential Weighted",
  tmy: "TMY"
};

const STRATEGY_LABELS_TR: Record<string, string> = {
  simple_mean: "Basit Ortalama",
  trimmed_mean: "Kırpılmış Ortalama",
  exponential_weighted: "Üstel Ağırlıklı",
  tmy: "TMY"
};

/* ─── Helpers ────────────────────────────────────────── */

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildFilename(result: ComparisonMatrixResponse, ext: string): string {
  const loc = `${result.location.latitude.toFixed(2)}N_${result.location.longitude.toFixed(2)}E`;
  const range = `${result.year_range.start_year}-${result.year_range.end_year}`;
  return `deep_comparison_${loc}_${range}.${ext}`;
}

/* ─── Main Page ──────────────────────────────────────── */

export default function IrradianceComparisonPage() {
  const { language } = useLanguage();
  const tr = (en: string, trStr: string) => language === "tr" ? trStr : en;
  const getStrategyLabel = (key: string) => language === "tr" ? (STRATEGY_LABELS_TR[key] || key) : (STRATEGY_LABELS[key] || key);

  /* ── Location ── */
  const [lat, setLat] = useState(38.42);
  const [lng, setLng] = useState(27.14);
  const [elevation, setElevation] = useState("50");
  const [tz, setTz] = useState("Europe/Istanbul");

  const handleMapChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat); setLng(newLng);
  }, []);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  /* ── Models ── */
  const [selectedModels, setSelectedModels] = useState<string[]>(["instesre_bird", "ineichen", "simplified_solis", "pvlib_bird"]);
  const [includePvgisTmy, setIncludePvgisTmy] = useState(true);
  const [includePvgisPoa, setIncludePvgisPoa] = useState(true);

  /* ── Advanced params ── */
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ozone, setOzone] = useState<number>(DEFAULTS.ozone);
  const [aod500, setAod500] = useState<number>(DEFAULTS.aod500);
  const [aod380, setAod380] = useState<number>(DEFAULTS.aod380);
  const [aod700, setAod700] = useState<number>(DEFAULTS.aod700);
  const [albedo, setAlbedo] = useState<number>(DEFAULTS.albedo);
  const [asymmetry, setAsymmetry] = useState<number>(DEFAULTS.asymmetry);
  const [surfaceTilt, setSurfaceTilt] = useState<number>(DEFAULTS.surface_tilt);
  const [surfaceAzimuth, setSurfaceAzimuth] = useState<number>(DEFAULTS.surface_azimuth);

  /* ── State ── */
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonMatrixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleModel = (val: string) => {
    setSelectedModels(prev =>
      prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val]
    );
  };

  const handleGenerate = async () => {
    setError(null); setResult(null); setLoading(true);

    if (selectedModels.length === 0 && !includePvgisTmy && !includePvgisPoa) {
      setError(tr("Please select at least one model.", "Lütfen en az bir model seçin."));
      setLoading(false);
      return;
    }

    const startYear = adminConfig.deepComparison.startYear;
    const endYear = adminConfig.deepComparison.endYear;
    const avgYearStrategy = adminConfig.deepComparison.averageYearStrategy;

    const payload = {
      models: selectedModels,
      include_pvgis_tmy: includePvgisTmy,
      include_pvgis_poa: includePvgisPoa,
      latitude: lat,
      longitude: lng,
      elevation: parseFloat(elevation) || 0,
      timezone: "UTC",
      start_year: startYear,
      end_year: endYear,
      avg_year_strategies: [avgYearStrategy],
      decay: 0.9,
      lower_percentile: 10,
      ozone, aod500, aod380, aod700, albedo, asymmetry,
      surface_tilt: surfaceTilt,
      surface_azimuth: surfaceAzimuth
    };

    try {
      const data = await runDeepComparison(payload) as ComparisonMatrixResponse;
      setResult(data);
      setTimeout(() => {
        document.getElementById("comparison-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!result) return;
    triggerDownload(JSON.stringify(result, null, 2), buildFilename(result, "json"), "application/json");
  };

  // Determine needed advanced params
  const needsBirdParams = selectedModels.includes("instesre_bird") || selectedModels.includes("pvlib_bird");
  const needsAsymmetry = selectedModels.includes("pvlib_bird");
  const needsSolisParams = selectedModels.includes("simplified_solis");
  const needsPoaParams = includePvgisPoa;
  const hasAdvancedParams = needsBirdParams || needsSolisParams || needsPoaParams;

  // Prepare table headers and rows if result exists
  // Extract all unique strategies found in the result summary matrix
  let tableHeaders: string[] = [];
  if (result) {
    const strategySet = new Set<string>();
    Object.values(result.summary_matrix).forEach(stratData => {
      Object.keys(stratData).forEach(k => strategySet.add(k));
    });
    // Ensure TMY is last if present
    const arr = Array.from(strategySet).filter(k => k !== "tmy");
    if (strategySet.has("tmy")) arr.push("tmy");
    tableHeaders = arr;
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">

        {/* ════ Header ════ */}
        <div className="mb-10 animate-fade-in flex flex-col items-center justify-center text-center gap-4 relative">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              {tr("Irradiance", "Işınım")} <span>{tr("Comparison", "Kıyası")}</span>
            </h1>
            <p className="text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
              {tr(
                "Compare multiple clear-sky and historical irradiance models for a given location to evaluate differences in solar resource estimations. Identify the most accurate baseline data to ensure robust system sizing and rigorous financial forecasting.",
                "Farklı clear-sky ve tarihsel ışınım modellerini belirli bir konum için kıyaslayarak güneş kaynağı tahminlerindeki farklılıkları değerlendirin. Güçlü sistem boyutlandırması ve titiz finansal öngörüler sağlamak için en doğru referans verilerini belirleyin."
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

        <Modal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} title={tr("How to Use: Irradiance Comparison", "Nasıl Kullanılır: Işınım Kıyası")}>
          <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            <p>
              {tr(
                "This module performs a deep comparative analysis of multiple irradiance models to help you understand the variations and uncertainties in solar resource data.",
                "Bu modül, güneş kaynağı verilerindeki varyasyonları ve belirsizlikleri anlamanıza yardımcı olmak için birden fazla ışınım modelinin derinlemesine karşılaştırmalı analizini yapar."
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{tr("Model Selection:", "Model Seçimi:")}</strong> {tr("Select multiple models (Bird, Ineichen, Solis, PVGIS) to run them simultaneously for the same location.", "Aynı konum için eşzamanlı olarak çalıştırmak üzere birden fazla model seçin (Bird, Ineichen, Solis, PVGIS).")}</li>
              <li><strong>{tr("Matrix Output:", "Matris Çıktısı:")}</strong> {tr("The summary matrix compares the models using different aggregation strategies (Simple Mean, Trimmed Mean, Exponential Weighted, etc.).", "Özet matrisi, modelleri farklı toplama stratejileri kullanarak karşılaştırır (Basit Ortalama, Kırpılmış Ortalama vb.).")}</li>
              <li><strong>{tr("Time-series Analysis:", "Zaman Serisi Analizi:")}</strong> {tr("Interactive charts allow you to drill down from annual comparisons all the way to hourly profile differences.", "İnteraktif grafikler, yıllık karşılaştırmalardan saatlik profil farklılıklarına kadar inmenizi sağlar.")}</li>
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
                  type="number" step="any" value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">{tr("Longitude (°)", "Boylam (°)")}</label>
                <input
                  type="number" step="any" value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            </div>
          </GlassCard>

          {/* ── Settings ── */}
          <div className="flex flex-col gap-6">
            <GlassCard>
              <h2 className="section-heading text-lg mb-4">⚙️ {tr("Comparison Configuration", "Kıyaslama Konfigürasyonu")}</h2>

              <div className="flex flex-col gap-6">
                {/* Models to Compare */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    {tr("Models to Compare", "Kıyaslanacak Modeller")}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {MODEL_OPTIONS.map(m => {
                      const isSelected = selectedModels.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleModel(m.id)}
                          className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${isSelected
                              ? "bg-amber-400/[0.08] border-amber-400/40"
                              : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1 w-full">
                            {isSelected ? (
                              <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs font-semibold ${isSelected ? "text-amber-400" : "text-slate-300"}`}>
                              {m.label}
                            </span>
                          </div>
                        </button>
                      )
                    })}

                    <button
                      type="button"
                      onClick={() => setIncludePvgisTmy(!includePvgisTmy)}
                      className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${includePvgisTmy ? "bg-amber-400/[0.08] border-amber-400/40" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1 w-full">
                        {includePvgisTmy ? <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" /> : <Circle className="h-4 w-4 text-slate-600 flex-shrink-0" />}
                        <span className={`text-xs font-semibold ${includePvgisTmy ? "text-amber-400" : "text-slate-300"}`}>PVGIS TMY</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludePvgisPoa(!includePvgisPoa)}
                      className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${includePvgisPoa ? "bg-amber-400/[0.08] border-amber-400/40" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1 w-full">
                        {includePvgisPoa ? <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" /> : <Circle className="h-4 w-4 text-slate-600 flex-shrink-0" />}
                        <span className={`text-xs font-semibold ${includePvgisPoa ? "text-amber-400" : "text-slate-300"}`}>PVGIS POA</span>
                      </div>
                    </button>
                  </div>
                </div>

              </div>

              {/* Timezone (Moved below grid) */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {tr("Timezone", "Zaman Dilimi")}
                </label>
                <select value={tz} onChange={(e) => setTz(e.target.value)} className="select-field w-full">
                  {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Advanced params */}
              {hasAdvancedParams && (
                <div className="border-t border-white/[0.06] pt-4 mt-4">
                  <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full mb-3">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {tr("Advanced Parameters", "Gelişmiş Parametreler")}
                    </span>
                    {showAdvanced ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 animate-fade-in pb-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{tr("Elevation (m)", "Yükseklik (m)")}</label>
                          <input type="number" value={elevation} onChange={(e) => setElevation(e.target.value)} className="input-field py-1.5 text-xs" />
                        </div>
                        {needsBirdParams && (
                          <>
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ozone (atm-cm)</label>
                              <input type="number" step={0.01} value={ozone} onChange={(e) => setOzone(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">AOD 500 nm</label>
                              <input type="number" step={0.01} value={aod500} onChange={(e) => setAod500(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">AOD 380 nm</label>
                              <input type="number" step={0.01} value={aod380} onChange={(e) => setAod380(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Albedo</label>
                              <input type="number" step={0.01} value={albedo} onChange={(e) => setAlbedo(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                            </div>
                          </>
                        )}
                        {needsAsymmetry && (
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Asymmetry</label>
                            <input type="number" step={0.01} value={asymmetry} onChange={(e) => setAsymmetry(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                          </div>
                        )}
                        {needsSolisParams && (
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">AOD 700 nm</label>
                            <input type="number" step={0.01} value={aod700} onChange={(e) => setAod700(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                          </div>
                        )}
                        {needsPoaParams && (
                          <>
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{tr("Panel Tilt (°)", "Panel Eğimi (°)")}</label>
                              <input type="number" value={surfaceTilt} min={0} max={90} onChange={(e) => setSurfaceTilt(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{tr("Azimuth (°)", "Azimut (°)")}</label>
                              <input type="number" value={surfaceAzimuth} min={0} max={359} onChange={(e) => setSurfaceAzimuth(parseFloat(e.target.value))} className="input-field py-1.5 text-xs" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Generate button */}
            <div className="text-center">
              <button type="button" onClick={handleGenerate} disabled={loading || (selectedModels.length === 0 && !includePvgisTmy && !includePvgisPoa)}
                className="w-full sm:w-2/3 md:w-1/2 mx-auto mt-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-xl shadow-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <><Loader2 className="h-6 w-6 animate-spin" />{tr("Running Comparison…", "Kıyaslama Çalışıyor…")}</>
                  : <><Play className="h-6 w-6" />{tr("Compare Models", "Modelleri Kıyasla")}</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* ════ Results below ════ */}
        {result && (
          <div id="comparison-results" className="mt-6 space-y-5 animate-fade-in">

            <div className="glass-card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-100 mb-1 flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-amber-400" />
                    {tr("Comparison Matrix", "Kıyaslama Matrisi")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {tr(`Annual Irradiance Summaries (${result.year_range.start_year}-${result.year_range.end_year}, kWh/m²)`, `Yıllık Işınım Özetleri (${result.year_range.start_year}-${result.year_range.end_year}, kWh/m²)`)}
                  </p>
                </div>
              </div>

              {/* Summary Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white/[0.04] text-slate-300 text-xs uppercase tracking-wider">
                      <th className="p-4 border-b border-r border-white/[0.08] font-semibold">Model</th>
                      {tableHeaders.map(th => (
                        <th key={th} className="p-4 border-b border-white/[0.08] font-semibold text-center whitespace-nowrap">
                          {getStrategyLabel(th)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {Object.entries(result.summary_matrix).map(([modelId, stratData]) => {
                      return (
                        <tr key={modelId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 border-r border-white/[0.08] font-medium text-amber-400/90 whitespace-nowrap">
                            {MODEL_LABELS[modelId] || modelId}
                          </td>
                          {tableHeaders.map(th => {
                            // PVGIS TMY only has 'tmy' strategy essentially
                            const val = modelId === "pvgis_tmy" ? stratData["tmy"] : stratData[th];
                            return (
                              <td key={th} className="p-4 text-center text-slate-200 tabular-nums">
                                {val !== undefined && val !== null ? (
                                  <span className="font-semibold">
                                    {Number(val).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparison Chart (Timeseries & Drill-down) */}
            <ComparisonChart
              comparisonData={result.comparison}
              summaryMatrix={result.summary_matrix}
              defaultMode="timeseries"
            />

            {/* Downloads */}
            <div className="glass-card">
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
                    <p className="text-sm font-semibold text-slate-200">{tr("Download Full JSON", "Tam JSON İndir")}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{buildFilename(result, "json")}</p>
                  </div>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
