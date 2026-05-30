"use client";

import { useState, useCallback } from "react";
import {
  MapPin, Settings, Play, Download,
  ChevronDown, ChevronUp,
  FileJson, FileText, Calendar, Hash, Layers, AlertCircle, Loader2
} from "lucide-react";
import dynamic from "next/dynamic";
import IrradianceTimeseriesChart from "@/components/charts/IrradianceTimeseriesChart";
import { useLanguage } from "@/context/LanguageContext";
import { generateIrradiance } from "@/lib/api";
import { TIMEZONES, DEFAULTS } from "@/lib/constants";
import GlassCard from "@/components/shared/GlassCard";
import Modal from "@/components/shared/Modal";

const MapPicker = dynamic(
  () => import("@/components/simulation/MapPicker"),
  { ssr: false }
);

/* ─── Types ──────────────────────────────────────────── */

interface IrradianceRecord {
  datetime?: string;
  day_of_year?: number;
  hour?: number;
  ghi?: number; dni?: number; dhi?: number;
  poa_global?: number;
  temp_air?: number; wind_speed?: number;
  [key: string]: string | number | undefined;
}

interface IrradianceResult {
  model: string;
  is_tmy: boolean;
  location: { latitude: number; longitude: number; elevation: number };
  year_range?: { start_year: number; end_year: number };
  total_rows: number;
  columns: string[];
  summary: Record<string, number>;
  records: IrradianceRecord[];
  records_simplified?: IrradianceRecord[];
  metadata?: Record<string, unknown>;
}

/* ─── Constants ──────────────────────────────────────── */

const MODELS = [
  { value: "instesre_bird",    label: "INSTESRE Bird",      desc: "Bird & Hulstrom (1981)" },
  { value: "ineichen",         label: "Ineichen / Perez",   desc: "Auto Linke turbidity" },
  { value: "simplified_solis", label: "Simplified Solis",   desc: "Atmospheric transmissivity" },
  { value: "pvlib_bird",       label: "pvlib Bird",         desc: "pvlib Bird model" },
] as const;

const MODEL_LABELS: Record<string, string> = {
  instesre_bird: "INSTESRE Bird", ineichen: "Ineichen / Perez",
  simplified_solis: "Simplified Solis", pvlib_bird: "pvlib Bird",
};

const COL_LABELS: Record<string, string> = {
  ghi: "GHI", dni: "DNI", dhi: "DHI",
  poa_global: "POA Global", poa_direct: "POA Direct",
  poa_diffuse: "POA Diffuse", poa_ground_diffuse: "POA Ground",
  temp_air: "Temp Air", wind_speed: "Wind Speed",
};

function colLabel(col: string) {
  return COL_LABELS[col] ?? col.replace(/_/g, " ").toUpperCase();
}

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

function recordsToCSV(records: IrradianceRecord[]): string {
  if (!records.length) return "";
  const keys = Object.keys(records[0]);
  return [keys.join(","), ...records.map((r) =>
    keys.map((k) => { const v = r[k]; return v === undefined || v === null ? "" : String(v); }).join(",")
  )].join("\n");
}

function buildFilename(result: IrradianceResult, suffix: string, ext: string): string {
  const loc = `${result.location.latitude.toFixed(2)}N_${result.location.longitude.toFixed(2)}E`;
  const range = result.year_range ? `${result.year_range.start_year}-${result.year_range.end_year}` : "tmy";
  return `irradiance_${result.model}_${loc}_${range}${suffix}.${ext}`;
}

/* ─── Main Page ──────────────────────────────────────── */

export default function IrradiancePage() {
  const { language } = useLanguage();
  const tr = (en: string, trStr: string) => language === "tr" ? trStr : en;

  /* ── Location ── */
  const [lat, setLat] = useState(38.42);
  const [lng, setLng] = useState(27.14);
  const [elevation, setElevation] = useState("50");
  const [tz, setTz] = useState("Europe/Istanbul");

  const handleMapChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat); setLng(newLng);
  }, []);

  /* ── Model & time ── */
  const [model, setModel] = useState("ineichen");
  const [startDate, setStartDate] = useState(`${DEFAULTS.start_year}-01-01`);
  const [endDate, setEndDate] = useState(`${DEFAULTS.end_year}-12-31`);

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
  const [result, setResult] = useState<IrradianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const isBird = model === "instesre_bird" || model === "pvlib_bird";
  const isSolis = model === "simplified_solis";
  const hasAdvanced = isBird || isSolis;

  const handleGenerate = async () => {
    setError(null); setResult(null); setLoading(true);
    const payload: Record<string, unknown> = {
      model, latitude: lat, longitude: lng,
      elevation: parseFloat(elevation) || 0, timezone: tz,
    };
    payload.start_date = startDate; payload.end_date = endDate;
    if (isBird) {
      Object.assign(payload, { ozone, aod500, aod380, albedo, asymmetry });
      if (model === "instesre_bird") payload.solar_constant = 1367.0;
    }
    if (isSolis) payload.aod700 = aod700;
    try {
      const data = await generateIrradiance(payload) as IrradianceResult;
      setResult(data);
      setTimeout(() => {
        document.getElementById("irr-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  };

  const downloadCSV = () => { if (!result) return; triggerDownload(recordsToCSV(result.records), buildFilename(result, "", "csv"), "text/csv"); };
  const downloadJSON = () => { if (!result) return; triggerDownload(JSON.stringify({ ...result }, null, 2), buildFilename(result, "", "json"), "application/json"); };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">

        {/* ════ Header ════ */}
        <div className="mb-10 animate-fade-in flex flex-col items-center justify-center text-center gap-4 relative">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              {tr("Irradiance", "Işınım")} <span>{tr("Generator", "Üreticisi")}</span>
            </h1>
            <p className="text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
              {tr(
                "Generate high-resolution clear-sky solar irradiance profiles (GHI, DNI, DHI, POA) for any location worldwide. This tool implements advanced atmospheric models like Bird and Simplified Solis to provide foundational radiation data for solar energy research.",
                "Dünya üzerindeki herhangi bir konum için yüksek çözünürlüklü clear-sky (açık-gökyüzü) güneş ışınımı profilleri (GHI, DNI, DHI, POA) üretin. Bu araç, güneş enerjisi araştırmaları için temel radyasyon verilerini sağlamak amacıyla Bird ve Simplified Solis gibi gelişmiş atmosferik modelleri uygular."
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

        <Modal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} title={tr("How to Use: Irradiance Generator", "Nasıl Kullanılır: Işınım Üreticisi")}>
          <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            <p>
              {tr(
                "The Irradiance Generator provides clear-sky theoretical solar radiation values for a specified location and date range.",
                "Işınım Üreticisi, belirtilen konum ve tarih aralığı için teorik açık gökyüzü (clear-sky) güneş radyasyonu değerleri sağlar."
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{tr("Model Selection:", "Model Seçimi:")}</strong> {tr("Choose from industry-standard clear-sky models like INSTESRE Bird, pvlib Bird, Ineichen/Perez, or Simplified Solis.", "INSTESRE Bird, pvlib Bird, Ineichen/Perez veya Simplified Solis gibi endüstri standardı açık gökyüzü modellerinden birini seçin.")}</li>
              <li><strong>{tr("Advanced Parameters:", "Gelişmiş Parametreler:")}</strong> {tr("Some models allow fine-tuning atmospheric conditions like Ozone, Albedo, and Aerosol Optical Depth (AOD) at various wavelengths.", "Bazı modeller Ozon, Albedo ve çeşitli dalga boylarındaki Aerosol Optik Derinliği (AOD) gibi atmosferik koşulların ince ayarını yapmanıza izin verir.")}</li>
              <li><strong>{tr("Outputs:", "Çıktılar:")}</strong> {tr("Calculates Global Horizontal (GHI), Direct Normal (DNI), and Diffuse Horizontal (DHI) irradiance.", "Global Yatay (GHI), Doğrudan Normal (DNI) ve Yaygın Yatay (DHI) ışınım değerlerini hesaplar.")}</li>
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
              <h2 className="section-heading text-lg mb-4">⚙️ {tr("Irradiance Parameters", "Işınım Parametreleri")}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Elevation + Timezone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                      {tr("Elevation (m)", "Yükseklik (m)")}
                    </label>
                    <input type="number" value={elevation}
                      onChange={(e) => setElevation(e.target.value)}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                      {tr("Timezone", "Zaman Dilimi")}
                    </label>
                    <select value={tz} onChange={(e) => setTz(e.target.value)} className="select-field">
                      {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Model */}
                <div>
                  <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    {tr("Irradiance Model", "Işınım Modeli")}
                  </label>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="select-field">
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {MODELS.find((m) => m.value === model)?.desc}
                  </p>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                      {tr("Start Date", "Başlangıç Tarihi")}
                    </label>
                    <input type="date" value={startDate} min="2005-01-01" max="2025-12-31"
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                      {tr("End Date", "Bitiş Tarihi")}
                    </label>
                    <input type="date" value={endDate} min="2005-01-01" max="2025-12-31"
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-field" />
                  </div>
                </div>
              </div>



              {/* Advanced params (Bird, Solis, POA) */}
              {hasAdvanced && (
                <div className="border-t border-white/[0.06] pt-4 mt-6">
                  <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full mb-3">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {tr("Advanced Parameters", "Gelişmiş Parametreler")}
                    </span>
                    {showAdvanced ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 animate-fade-in pb-2">
                      {isBird && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {[
                            { label: "Ozone (atm-cm)", value: ozone, set: setOzone, step: 0.01 },
                            { label: "AOD 500 nm", value: aod500, set: setAod500, step: 0.01 },
                            { label: "AOD 380 nm", value: aod380, set: setAod380, step: 0.01 },
                            { label: "Albedo", value: albedo, set: setAlbedo, step: 0.01 },
                            ...(model === "pvlib_bird" ? [{ label: "Asymmetry", value: asymmetry, set: setAsymmetry, step: 0.01 }] : []),
                          ].map(({ label, value, set, step }) => (
                            <div key={label}>
                              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                              <input type="number" step={step} value={value}
                                onChange={(e) => set(parseFloat(e.target.value))}
                                className="input-field py-1.5 text-xs" />
                            </div>
                          ))}
                        </div>
                      )}
                      {isSolis && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">AOD 700 nm</label>
                            <input type="number" step={0.01} value={aod700}
                              onChange={(e) => setAod700(parseFloat(e.target.value))}
                              className="input-field py-1.5 text-xs" />
                          </div>
                        </div>
                      )}

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
              <button type="button" onClick={handleGenerate} disabled={loading}
                className="w-full sm:w-2/3 md:w-1/2 mx-auto mt-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-xl shadow-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <><Loader2 className="h-6 w-6 animate-spin" />{tr("Generating…", "Üretiliyor…")}</>
                  : <><Play className="h-6 w-6" />{tr("Generate Data", "Veri Üret")}</>
                }
              </button>

              <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1 mt-3">
                {startDate && endDate ? `${startDate} → ${endDate} · ` : ""}
                {tr("raw hourly timeseries", "ham saatlik zaman serisi")}
              </p>
            </div>
          </div>
        </div>

        {/* ════ Results below ════ */}
        {result && (
          <div id="irr-results" className="mt-6 space-y-5">

            {/* Summary card */}
            <div className="glass-card">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-100 mb-1">
                    {tr("Data Summary", "Veri Özeti")}
                  </h2>
                  <p className="text-xs text-slate-500">{MODEL_LABELS[result.model] ?? result.model}</p>
                </div>
                {result.is_tmy && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full border border-amber-400/30 text-amber-400 bg-amber-400/[0.06] font-medium">TMY</span>
                )}
              </div>

              {/* Meta row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 pb-5 border-b border-white/[0.06]">
                {[
                  { icon: <MapPin className="h-3.5 w-3.5 text-slate-500" />, label: tr("Location", "Konum"), value: `${result.location.latitude.toFixed(3)}°, ${result.location.longitude.toFixed(3)}°` },
                  { icon: <Layers className="h-3.5 w-3.5 text-slate-500" />, label: tr("Elevation", "Yükseklik"), value: `${result.location.elevation} m` },
                  { icon: <Calendar className="h-3.5 w-3.5 text-slate-500" />, label: tr("Period", "Zaman Aralığı"), value: result.is_tmy ? "TMY" : (startDate && endDate ? `${startDate} – ${endDate}` : result.year_range ? `${result.year_range.start_year}–${result.year_range.end_year}` : "—") },
                  { icon: <Hash className="h-3.5 w-3.5 text-slate-500" />, label: tr("Total Rows", "Satır Sayısı"), value: result.total_rows.toLocaleString() },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    {icon}
                    <div>
                      <p className="text-[10px] text-slate-500">{label}</p>
                      <p className="text-xs font-semibold text-slate-200">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              {(() => {
                const total = Object.entries(result.summary).filter(([k]) => k.startsWith("total_"));
                const avg   = Object.entries(result.summary).filter(([k]) => k.startsWith("avg_"));
                const peak  = Object.entries(result.summary).filter(([k]) => k.startsWith("peak_"));
                return (
                  <div className="space-y-4">
                    {total.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                          {tr("Total", "Toplam")}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {total.map(([key, val]) => {
                            const col = key.replace("total_", "").replace("_kwh_m2", "");
                            return (
                              <div key={key} className="p-3.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.04]">
                                <p className="text-[10px] text-amber-400/70 font-medium mb-1">{colLabel(col)}</p>
                                <p className="text-2xl font-bold tabular-nums text-amber-400 leading-none">
                                  {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">kWh / m²</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {avg.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                          {tr("Average", "Ortalama")}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {avg.map(([key, val]) => {
                            const col = key.replace("avg_", "").replace("_w_m2", "");
                            return (
                              <div key={key} className="p-3.5 rounded-xl border border-sky-400/20 bg-sky-400/[0.04]">
                                <p className="text-[10px] text-sky-400/70 font-medium mb-1">{colLabel(col)}</p>
                                <p className="text-2xl font-bold tabular-nums text-sky-400 leading-none">
                                  {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">W / m²</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {peak.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                          {tr("Peak", "Tepe")}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {peak.map(([key, val]) => {
                            const col = key.replace("peak_", "").replace("_w_m2", "");
                            return (
                              <div key={key} className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                                <p className="text-[10px] text-slate-500 font-medium mb-1">{colLabel(col)}</p>
                                <p className="text-2xl font-bold tabular-nums text-slate-200 leading-none">
                                  {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">W / m²</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Downloads */}
            <div className="glass-card">
              <div className="flex items-center gap-2 mb-4">
                <Download className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-200">{tr("Download", "İndir")}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={downloadCSV}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10">
                    <FileText className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{tr("Download CSV", "CSV İndir")}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{buildFilename(result, "", "csv")}</p>
                  </div>
                </button>

                <button type="button" onClick={downloadJSON}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-400/10">
                    <FileJson className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{tr("Download JSON", "JSON İndir")}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{buildFilename(result, "", "json")}</p>
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
