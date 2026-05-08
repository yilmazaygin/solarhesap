"use client";

import { useState, useCallback } from "react";
import {
  MapPin, Settings, Play, Download,
  ChevronDown, ChevronUp, Info,
  FileJson, FileText, Calendar, Hash, Layers,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/context/LanguageContext";
import { generateIrradiance } from "@/lib/api";
import { DEFAULTS, TIMEZONES } from "@/lib/constants";

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
  { value: "pvgis_tmy",        label: "PVGIS TMY",          desc: "Typical Met. Year" },
  { value: "pvgis_poa",        label: "PVGIS POA",          desc: "Multi-year plane-of-array" },
] as const;

const MODEL_LABELS: Record<string, string> = {
  instesre_bird: "INSTESRE Bird", ineichen: "Ineichen / Perez",
  simplified_solis: "Simplified Solis", pvlib_bird: "pvlib Bird",
  pvgis_tmy: "PVGIS TMY", pvgis_poa: "PVGIS POA",
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
  const [startYear, setStartYear] = useState<number>(DEFAULTS.start_year);
  const [endYear, setEndYear] = useState<number>(DEFAULTS.end_year);

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

  const isTmy = model === "pvgis_tmy";
  const isPoa = model === "pvgis_poa";
  const isBird = model === "instesre_bird" || model === "pvlib_bird";
  const isSolis = model === "simplified_solis";
  const hasAdvanced = isBird || isSolis || isPoa;

  const handleGenerate = async () => {
    setError(null); setResult(null); setLoading(true);
    const payload: Record<string, unknown> = {
      model, latitude: lat, longitude: lng,
      elevation: parseFloat(elevation) || 0, timezone: tz,
    };
    if (!isTmy) { payload.start_year = startYear; payload.end_year = endYear; }
    if (isBird) {
      Object.assign(payload, { ozone, aod500, aod380, albedo, asymmetry });
      if (model === "instesre_bird") payload.solar_constant = 1367.0;
    }
    if (isSolis) payload.aod700 = aod700;
    if (isPoa) Object.assign(payload, { surface_tilt: surfaceTilt, surface_azimuth: surfaceAzimuth });
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
  const downloadSimplifiedCSV = () => { if (!result?.records_simplified) return; triggerDownload(recordsToCSV(result.records_simplified), buildFilename(result, "_simplified_day_hour", "csv"), "text/csv"); };
  const downloadJSON = () => { if (!result) return; triggerDownload(JSON.stringify({ ...result }, null, 2), buildFilename(result, "", "json"), "application/json"); };

  return (
    <div className="min-h-screen pt-16 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">

        {/* ════ Top section: Map + Params ════ */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">

          {/* ── Left: Map ── */}
          <div className="glass-card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <MapPin className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">{tr("Location", "Konum Seçimi")}</h2>
            </div>
            <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} height={430} />
            <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-3 text-xs text-slate-500">
              <MapPin className="h-3 w-3 text-amber-400 flex-shrink-0" />
              {lat !== 38.42 || lng !== 27.14
                ? <span className="font-mono">{lat.toFixed(4)}°{lat >= 0 ? "K" : "G"}, {lng.toFixed(4)}°{lng >= 0 ? "D" : "B"}</span>
                : <span>{tr("Click the map to select coordinates", "Haritaya tıklayarak konum seçin")}</span>
              }
            </div>
          </div>

          {/* ── Right: Params panel ── */}
          <div className="glass-card p-0 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <Settings className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">{tr("Irradiance Parameters", "Işınım Parametreleri")}</h2>
            </div>

            <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">

              {/* Lat / Lng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    <MapPin className="h-3 w-3 text-amber-400" />{tr("Latitude (°)", "Enlem (°)")}
                  </label>
                  <input type="number" step="any" value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value))}
                    className="input-field py-2.5 text-sm" />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    <MapPin className="h-3 w-3 text-amber-400" />{tr("Longitude (°)", "Boylam (°)")}
                  </label>
                  <input type="number" step="any" value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value))}
                    className="input-field py-2.5 text-sm" />
                </div>
              </div>

              {/* Elevation + Timezone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    {tr("Elevation (m)", "Yükseklik (m)")}
                  </label>
                  <input type="number" value={elevation}
                    onChange={(e) => setElevation(e.target.value)}
                    className="input-field py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                    {tr("Timezone", "Zaman Dilimi")}
                  </label>
                  <select value={tz} onChange={(e) => setTz(e.target.value)} className="select-field py-2.5 text-sm">
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                  {tr("Irradiance Model", "Işınım Modeli")}
                </label>
                <select value={model} onChange={(e) => setModel(e.target.value)} className="select-field py-2.5 text-sm">
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-600 mt-1">
                  {MODELS.find((m) => m.value === model)?.desc}
                </p>
              </div>

              {/* Year range (hidden for TMY) */}
              {!isTmy && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                      {tr("Start Year", "Başlangıç Yılı")}
                    </label>
                    <input type="number" value={startYear} min={2005} max={2025}
                      onChange={(e) => setStartYear(parseInt(e.target.value))}
                      className="input-field py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                      {tr("End Year", "Bitiş Yılı")}
                      {isPoa && <span className="ml-1 text-slate-600">(max 2023)</span>}
                    </label>
                    <input type="number" value={endYear} min={2005} max={isPoa ? 2023 : 2025}
                      onChange={(e) => setEndYear(parseInt(e.target.value))}
                      className="input-field py-2.5 text-sm" />
                  </div>
                </div>
              )}

              {/* TMY info */}
              {isTmy && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-400/[0.06] border border-sky-400/20">
                  <Info className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400">
                    {tr(
                      "TMY is always a single representative year. Two download formats available.",
                      "TMY her zaman tek bir temsili yıldır. İki indirme formatı sunulur.",
                    )}
                  </p>
                </div>
              )}

              {/* Advanced params (Bird, Solis, POA) */}
              {hasAdvanced && (
                <div className="border-t border-white/[0.06] pt-3">
                  <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full mb-3">
                    <span className="text-xs font-semibold text-slate-400">
                      {tr("Advanced Parameters", "Gelişmiş Parametreler")}
                    </span>
                    {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-3">
                      {isBird && (
                        <div className="grid grid-cols-2 gap-3">
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
                                className="input-field py-2 text-sm" />
                            </div>
                          ))}
                        </div>
                      )}
                      {isSolis && (
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">AOD 700 nm</label>
                          <input type="number" step={0.01} value={aod700}
                            onChange={(e) => setAod700(parseFloat(e.target.value))}
                            className="input-field py-2 text-sm" />
                        </div>
                      )}
                      {isPoa && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                              {tr("Panel Tilt (°)", "Panel Eğimi (°)")}
                            </label>
                            <input type="number" value={surfaceTilt} min={0} max={90}
                              onChange={(e) => setSurfaceTilt(parseFloat(e.target.value))}
                              className="input-field py-2 text-sm" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                              {tr("Azimuth (°)", "Azimut (°)")}
                            </label>
                            <input type="number" value={surfaceAzimuth} min={0} max={359}
                              onChange={(e) => setSurfaceAzimuth(parseFloat(e.target.value))}
                              className="input-field py-2 text-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1" />

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl border border-red-400/30 bg-red-400/[0.06] text-xs text-red-300">
                  ⚠️ {error}
                </div>
              )}

              {/* Generate button */}
              <button type="button" onClick={handleGenerate} disabled={loading}
                className="btn-primary w-full py-3 disabled:opacity-50">
                {loading
                  ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {tr("Generating…", "Üretiliyor…")}</>
                  : <><Play className="h-4 w-4" />{tr("Generate Data", "Veri Üret")}</>
                }
              </button>

              <p className="text-[10px] text-slate-600 text-center">
                {!isTmy && endYear >= startYear ? `${endYear - startYear + 1} ${tr("year(s)", "yıl")} · ` : ""}
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
                  { icon: <Calendar className="h-3.5 w-3.5 text-slate-500" />, label: tr("Period", "Zaman Aralığı"), value: result.is_tmy ? "TMY" : result.year_range ? `${result.year_range.start_year}–${result.year_range.end_year}` : "—" },
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
                const annual = Object.entries(result.summary).filter(([k]) => k.startsWith("annual_"));
                const peak = Object.entries(result.summary).filter(([k]) => k.startsWith("peak_"));
                return (
                  <div className="space-y-4">
                    {annual.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                          {tr("Annual Total", "Yıllık Toplam")}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {annual.map(([key, val]) => {
                            const col = key.replace("annual_", "").replace("_kwh_m2", "");
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
                    {peak.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                          {tr("Peak Value", "Tepe Değer")}
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

                {result.is_tmy && result.records_simplified && (
                  <button type="button" onClick={downloadSimplifiedCSV}
                    className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left sm:col-span-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-400/10">
                      <FileText className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {tr("CSV — Simplified (Day of Year + Hour)", "CSV — Sadeleştirilmiş (Gün + Saat)")}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{buildFilename(result, "_simplified_day_hour", "csv")}</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
