"use client";

import { useState, useCallback } from "react";
import {
  MapPin, Settings, Zap, Play, Download, BarChart2,
  ChevronDown, ChevronUp, FileJson, CheckCircle2, Circle, AlertCircle, Loader2
} from "lucide-react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/context/LanguageContext";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { runDeepComparisonYield } from "@/lib/api";
import { DEFAULTS } from "@/lib/constants";
import adminConfig from "@/config/admin.json";
import GlassCard from "@/components/shared/GlassCard";
import Modal from "@/components/shared/Modal";

const MapPicker = dynamic(
  () => import("@/components/simulation/MapPicker"),
  { ssr: false }
);

const ComparisonChart = dynamic(
  () => import("@/components/charts/ComparisonChart"),
  { ssr: false }
);

/* ─── Constants ──────────────────────────────────────── */

const TIERS = [
  { id: "very_low",   label: { en: "Very Low (~14%)",       tr: "Çok Düşük (~14%)" } },
  { id: "low",        label: { en: "Low (~15%)",            tr: "Düşük (~15%)" } },
  { id: "medium",     label: { en: "Medium (~18%)",         tr: "Orta (~18%)" } },
  { id: "medium_high",label: { en: "Medium-High (~20%)",    tr: "Orta-Yüksek (~20%)" } },
  { id: "high",       label: { en: "High (~22%)",           tr: "Yüksek (~22%)" } },
] as const;

type TierId = (typeof TIERS)[number]["id"];

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
  pvgis_poa: "PVGIS POA",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFilename(result: any, ext: string): string {
  const loc = `${result.location.latitude.toFixed(2)}N_${result.location.longitude.toFixed(2)}E`;
  const range = `${result.year_range.start_year}-${result.year_range.end_year}`;
  return `electric_comparison_${loc}_${range}.${ext}`;
}

/* ─── Main Page ──────────────────────────────────────── */

export default function DeepComparisonYieldPage() {
  const { t, language } = useLanguage();
  const tr = (en: string, trStr: string) => language === "tr" ? trStr : en;

  /* ── Location ── */
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [lat, setLat] = useState(38.42);
  const [lng, setLng] = useState(27.14);
  const [elevation, setElevation] = useState("50");

  const handleMapChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat); setLng(newLng);
    const autoTilt = Math.min(Math.abs(newLat), 60);
    setTilt(Math.round(autoTilt));
    setAzimuth(newLat >= 0 ? 180 : 0);
  }, []);

  /* ── PV System ── */
  const [areaMode, setAreaMode] = useState<"m2" | "ab">("m2");
  const [areaM2, setAreaM2] = useState(50);
  const [areaA, setAreaA] = useState(5);
  const [areaB, setAreaB] = useState(10);
  const [tier, setTier] = useState<TierId>("medium");
  const [tilt, setTilt] = useState(38);
  const [azimuth, setAzimuth] = useState(180);
  const effectiveArea = areaMode === "m2" ? areaM2 : areaA * areaB;

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

  /* ── State ── */
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleModel = (val: string) => {
    setSelectedModels(prev => 
      prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
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
      efficiency_tier: tier,
      ...(areaMode === "m2" ? { area_m2: areaM2 } : { area_a: areaA, area_b: areaB }),
      surface_tilt: tilt,
      surface_azimuth: azimuth
    };

    try {
      const data = await runDeepComparisonYield(payload);
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

  const downloadCSV = () => {
    if (!result) return;
    const strats = Object.keys(result.summary_matrix[Object.keys(result.summary_matrix)[0]] || {});
    const strat = strats.find(s => s !== "error") || strats[0];
    const rows = [
      ["Model", "Annual AC Energy (kWh)"],
      ...Object.entries(result.summary_matrix).map(([modelId, stratData]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sData = stratData as any;
        const val = modelId === "pvgis_tmy" || modelId === "pvgis_poa" ? sData["tmy"] || sData["pvgis_poa"] || Object.values(sData)[0] : Object.values(sData)[0];
        return [MODEL_LABELS[modelId] || modelId, val ?? ""];
      })
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    triggerDownload(csv, buildFilename(result, "csv"), "text/csv;charset=utf-8;");
  };

  // Determine needed advanced params
  const needsBirdParams = selectedModels.includes("instesre_bird") || selectedModels.includes("pvlib_bird");
  const needsAsymmetry = selectedModels.includes("pvlib_bird");
  const needsSolisParams = selectedModels.includes("simplified_solis");
  const hasAdvancedParams = needsBirdParams || needsSolisParams;

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">

        {/* ════ Header ════ */}
        <div className="mb-10 animate-fade-in flex flex-col items-center justify-center text-center gap-4 relative">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-2">
              {tr("Model", "Model")} <span>{tr("Comparison", "Kıyası")}</span>
            </h1>
            <p className="text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
              {tr(
                "Compare the AC energy yield produced by different clear-sky algorithms and historical irradiance models over a multi-year period. This tool helps engineers and researchers understand the sensitivity of energy estimates to the underlying solar radiation data sources.",
                "Farklı clear-sky (açık-gökyüzü) algoritmaları ve tarihsel ışınım veritabanları kullanılarak hesaplanan AC enerji üretimlerini karşılaştırın. Bu araç, mühendislerin ve araştırmacıların baz alınan radyasyon modellerine göre üretim tahminlerinin nasıl değiştiğini detaylıca analiz etmelerini sağlar."
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

        <Modal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} title={tr("How to Use: Model Comparison", "Nasıl Kullanılır: Model Kıyası")}>
          <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            <p>
              {tr(
                "This module allows you to directly compare the AC energy yield derived from various irradiance models. It reveals how your production estimates change based on the underlying data source.",
                "Bu modül, farklı ışınım modellerinden elde edilen AC enerji üretimini doğrudan kıyaslamanızı sağlar. Üretim tahminlerinizin, temel alınan veri kaynağına göre nasıl değiştiğini ortaya koyar."
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{tr("Delta (Difference) Mode:", "Fark (Delta) Modu:")}</strong> {tr("Click the 'Delta Mode' button on the chart to set the first selected model as the baseline (zero). All other models will be displayed as the difference (+ or -) from this baseline. This makes it incredibly easy to see exactly how much lower or higher a model estimates compared to your primary reference.", "Grafikteki 'Fark Modu' butonuna tıklayarak seçili ilk modeli referans (sıfır) kabul edebilirsiniz. Diğer tüm modeller, bu referansa olan fark (+ veya -) olarak gösterilecektir. Bu sayede bir modelin diğerine göre tahmini ne kadar saptırdığını veya farklılaştığını çok daha net görebilirsiniz.")}</li>
              <li><strong>{tr("Model Selection:", "Model Seçimi:")}</strong> {tr("Select multiple models like PVGIS TMY, Bird, or Ineichen to run them simultaneously.", "Aynı anda çalıştırmak için PVGIS TMY, Bird veya Ineichen gibi birden fazla model seçin.")}</li>
              <li><strong>{tr("Time-series Drill Down:", "Zaman Serisi Analizi:")}</strong> {tr("Click on a month or day bar in the chart to drill down into daily and hourly production profiles.", "Günlük ve saatlik üretim profillerini detaylıca incelemek için grafikteki herhangi bir aya veya güne tıklayın.")}</li>
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
          <form onSubmit={handleGenerate} className="flex flex-col gap-6">
            <GlassCard>
              <h2 className="section-heading text-lg mb-4">⚙️ {tr("System & Model Configuration", "Sistem ve Model Konfigürasyonu")}</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Area */}
                <div className="flex flex-col justify-start">
                  <div className="flex items-center justify-between gap-1 mb-2 h-[32px]">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
                      <label className="text-[11px] text-slate-500 uppercase tracking-wider">
                        {tr("Panel Area", "Panel Alanı")}
                      </label>
                      <InfoTooltip text={tr("Total physical area of the panels.", "Panellerin toplam fiziksel alanı.")} />
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
                  <div className="flex flex-col">
                    {areaMode === "m2" ? (
                      <input type="number" step="1" min={1} value={areaM2}
                        onChange={(e) => setAreaM2(parseFloat(e.target.value) || 0)}
                        className="input-field" placeholder="e.g. 50" />
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

                {/* Panel tier */}
                <div className="flex flex-col justify-start">
                  <div className="flex items-center gap-1 mb-2 h-[32px]">
                    <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
                    <label className="text-[11px] text-slate-500 uppercase tracking-wider">
                      {tr("Panel Type", "Panel Tipi")}
                    </label>
                  </div>
                  <div className="flex flex-col">
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value as TierId)}
                      className="select-field"
                    >
                      {TIERS.map((ti) => (
                        <option key={ti.id} value={ti.id}>
                          {ti.label[language]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tilt */}
                  <div className="flex flex-col justify-start">
                    <div className="flex items-center gap-1 mb-2 h-[32px] whitespace-nowrap">
                      <span className="text-amber-400 text-[10px] font-bold">∠</span>
                      <label className="text-[11px] text-slate-500 uppercase tracking-wider">
                        {tr("Tilt (°)", "Eğim Açısı (°)")}
                      </label>
                    </div>
                    <div className="flex flex-col">
                      <input
                        type="number" min={0} max={90} value={tilt}
                        onChange={(e) => setTilt(parseFloat(e.target.value) || 0)}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col justify-start">
                    <div className="flex items-center gap-1 mb-2 h-[32px] whitespace-nowrap">
                      <span className="text-amber-400 text-[10px] font-bold">◪</span>
                      <label className="text-[11px] text-slate-500 uppercase tracking-wider">
                        {tr("Azimuth (°)", "Azimut (°)")}
                      </label>
                    </div>
                    <div className="flex flex-col">
                      <input
                        type="number" min={0} max={359} value={azimuth}
                        onChange={(e) => setAzimuth(parseFloat(e.target.value) || 0)}
                        className="input-field"
                      />
                    </div>
                  </div>
              </div>

              <div className="border-t border-white/[0.06] my-6" />

              {/* Models to Compare */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-4">
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
                        className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                          isSelected 
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
                    className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                      includePvgisTmy ? "bg-amber-400/[0.08] border-amber-400/40" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
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
                    className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                      includePvgisPoa ? "bg-amber-400/[0.08] border-amber-400/40" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 w-full">
                      {includePvgisPoa ? <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" /> : <Circle className="h-4 w-4 text-slate-600 flex-shrink-0" />}
                      <span className={`text-xs font-semibold ${includePvgisPoa ? "text-amber-400" : "text-slate-300"}`}>PVGIS POA</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Advanced params */}
              {hasAdvancedParams && (
                <div className="border-t border-white/[0.06] mt-6 pt-4">
                  <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full mb-3">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {tr("Advanced Parameters", "Gelişmiş Parametreler")}
                    </span>
                    {showAdvanced ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-3 pb-2 animate-fade-in">
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
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
              <button type="submit" disabled={loading}
                className="w-full sm:w-2/3 md:w-1/2 mx-auto mt-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-xl shadow-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <><Loader2 className="h-6 w-6 animate-spin" />{tr("Simulating Yield…", "Üretim Hesaplanıyor…")}</>
                  : <><Play className="h-6 w-6" />{tr("Compare Production", "Üretimi Kıyasla")}</>
                }
              </button>
            </div>
          </form>
        </div>

        {/* ════ Results below ════ */}
        {result && (
          <div id="comparison-results" className="mt-6 space-y-5 animate-fade-in">

            <div className="glass-card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-100 mb-1 flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-amber-400" />
                    {tr("Energy Yield Matrix", "Üretim Kıyaslama Matrisi")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {tr(`Annual AC Energy Summaries (kWh) based on ${result.system_info.total_dc_kw} kWp system`, 
                    `${result.system_info.total_dc_kw} kWp sistem için Yıllık AC Enerji Üretimleri (kWh)`)}
                  </p>
                </div>
              </div>

              {/* Summary Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white/[0.04] text-slate-300 text-xs uppercase tracking-wider">
                      <th className="p-4 border-b border-r border-white/[0.08] font-semibold">Model</th>
                      <th className="p-4 border-b border-white/[0.08] font-semibold text-center whitespace-nowrap">
                        {tr("Annual Energy (kWh)", "Yıllık Üretim (kWh)")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {Object.entries(result.summary_matrix).map(([modelId, stratData]) => {
                      // We only have one strategy ("simple_mean" or "tmy") because we hardcoded it in the backend yield response
                      const sData = stratData as Record<string, number | null>;
                      const val = modelId === "pvgis_tmy" || modelId === "pvgis_poa" ? sData["tmy"] || sData["pvgis_poa"] || Object.values(sData)[0] : Object.values(sData)[0];
                      
                      return (
                        <tr key={modelId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 border-r border-white/[0.08] font-medium text-amber-400/90 whitespace-nowrap">
                            {MODEL_LABELS[modelId] || modelId}
                          </td>
                          <td className="p-4 text-center text-slate-200 tabular-nums">
                            {val !== undefined && val !== null ? (
                              <span className="font-semibold text-emerald-400">
                                {Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparison Chart */}
            <ComparisonChart 
              comparisonData={result.comparison} 
              summaryMatrix={result.summary_matrix}
              defaultMode="timeseries"
              mode="yield"
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
                    <p className="text-sm font-semibold text-slate-200">{tr("Download JSON", "JSON İndir")}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{buildFilename(result, "json")}</p>
                  </div>
                </button>
                <button type="button" onClick={downloadCSV}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10">
                    <Download className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{tr("Download CSV", "CSV İndir")}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{buildFilename(result, "csv")}</p>
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
