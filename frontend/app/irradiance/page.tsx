"use client";

import { useState, useCallback } from "react";
import {
  Download, ChevronDown, ChevronUp, Play,
  Info, FileJson, FileText, MapPin, Calendar, Hash, Layers,
} from "lucide-react";

import GlassCard from "@/components/shared/GlassCard";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import MapPicker from "@/components/simulation/MapPicker";
import { useLanguage } from "@/context/LanguageContext";
import { generateIrradiance } from "@/lib/api";
import { DEFAULTS, TIMEZONES } from "@/lib/constants";

/* ─── Types ──────────────────────────────────────────── */

interface IrradianceRecord {
  datetime?: string;
  day_of_year?: number;
  hour?: number;
  ghi?: number;
  dni?: number;
  dhi?: number;
  poa_global?: number;
  temp_air?: number;
  wind_speed?: number;
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
  { value: "instesre_bird", label: "INSTESRE Bird", desc: "Bird & Hulstrom (1981) — OpenMeteo atmosphere" },
  { value: "ineichen", label: "Ineichen / Perez", desc: "Auto Linke turbidity — OpenMeteo atmosphere" },
  { value: "simplified_solis", label: "Simplified Solis", desc: "Atmospheric transmissivity via AOD" },
  { value: "pvlib_bird", label: "pvlib Bird", desc: "pvlib implementation of Bird model" },
  { value: "pvgis_tmy", label: "PVGIS TMY", desc: "Typical Meteorological Year — always 1 year" },
  { value: "pvgis_poa", label: "PVGIS POA", desc: "Multi-year hourly plane-of-array (SARAH2, max 2023)" },
] as const;

/* ─── Download helpers ───────────────────────────────── */

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function recordsToCSV(records: IrradianceRecord[]): string {
  if (!records.length) return "";
  const keys = Object.keys(records[0]);
  const header = keys.join(",");
  const rows = records.map((r) =>
    keys.map((k) => {
      const v = r[k];
      return v === undefined || v === null ? "" : String(v);
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

function buildFilename(result: IrradianceResult, suffix: string, ext: string): string {
  const loc = `${result.location.latitude.toFixed(2)}N_${result.location.longitude.toFixed(2)}E`;
  const range = result.year_range
    ? `${result.year_range.start_year}-${result.year_range.end_year}`
    : "tmy";
  return `irradiance_${result.model}_${loc}_${range}${suffix}.${ext}`;
}

/* ─── Results Summary ────────────────────────────────── */

const MODEL_LABELS: Record<string, string> = {
  instesre_bird: "INSTESRE Bird",
  ineichen: "Ineichen / Perez",
  simplified_solis: "Simplified Solis",
  pvlib_bird: "pvlib Bird",
  pvgis_tmy: "PVGIS TMY",
  pvgis_poa: "PVGIS POA",
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

function ResultsSummary({ result, language }: { result: IrradianceResult; language: string }) {
  const summaryEntries = Object.entries(result.summary);

  // Group: annual entries first, then peak
  const annual = summaryEntries.filter(([k]) => k.startsWith("annual_"));
  const peak = summaryEntries.filter(([k]) => k.startsWith("peak_"));

  const rangeLabel = result.is_tmy
    ? "TMY"
    : result.year_range
    ? `${result.year_range.start_year} – ${result.year_range.end_year}`
    : "—";

  return (
    <GlassCard>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="section-heading text-lg mb-1">
            📊 {language === "tr" ? "Veri Özeti" : "Data Summary"}
          </h2>
          <p className="text-xs text-slate-500">
            {MODEL_LABELS[result.model] ?? result.model}
          </p>
        </div>
        {result.is_tmy && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] px-2.5 py-1 rounded-full border border-amber-400/30 text-amber-400 bg-amber-400/[0.06] font-medium">
              TMY
            </span>
          </div>
        )}
      </div>

      {/* ── Meta row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500">{language === "tr" ? "Konum" : "Location"}</p>
            <p className="text-xs font-semibold text-slate-200">
              {result.location.latitude.toFixed(3)}°, {result.location.longitude.toFixed(3)}°
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500">{language === "tr" ? "Yükseklik" : "Elevation"}</p>
            <p className="text-xs font-semibold text-slate-200">{result.location.elevation} m</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500">{language === "tr" ? "Zaman Aralığı" : "Period"}</p>
            <p className="text-xs font-semibold text-slate-200">{rangeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500">{language === "tr" ? "Satır Sayısı" : "Total Rows"}</p>
            <p className="text-xs font-semibold text-slate-200">{result.total_rows.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {summaryEntries.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          {language === "tr" ? "Bu model için ışınım özeti mevcut değil." : "No irradiance summary available for this dataset."}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Annual totals */}
          {annual.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                {language === "tr" ? "Yıllık Toplam" : "Annual Total"}
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

          {/* Peak values */}
          {peak.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                {language === "tr" ? "Tepe Değer" : "Peak Value"}
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
      )}
    </GlassCard>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

export default function IrradiancePage() {
  const { language } = useLanguage();

  // Location
  const [lat, setLat] = useState(38.42);
  const [lng, setLng] = useState(27.14);
  const [elevation, setElevation] = useState("50");
  const [tz, setTz] = useState("Europe/Istanbul");

  // Model & time
  const [model, setModel] = useState("ineichen");
  const [startYear, setStartYear] = useState<number>(DEFAULTS.start_year);
  const [endYear, setEndYear] = useState<number>(DEFAULTS.end_year);

  // Advanced params (collapsible)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ozone, setOzone] = useState<number>(DEFAULTS.ozone);
  const [aod500, setAod500] = useState<number>(DEFAULTS.aod500);
  const [aod380, setAod380] = useState<number>(DEFAULTS.aod380);
  const [aod700, setAod700] = useState<number>(DEFAULTS.aod700);
  const [albedo, setAlbedo] = useState<number>(DEFAULTS.albedo);
  const [asymmetry, setAsymmetry] = useState<number>(DEFAULTS.asymmetry);
  const [surfaceTilt, setSurfaceTilt] = useState<number>(DEFAULTS.surface_tilt);
  const [surfaceAzimuth, setSurfaceAzimuth] = useState<number>(DEFAULTS.surface_azimuth);

  // State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IrradianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTmy = model === "pvgis_tmy";
  const isPoa = model === "pvgis_poa";
  const isBird = model === "instesre_bird" || model === "pvlib_bird";
  const isSolis = model === "simplified_solis";
  const yearCount = endYear - startYear + 1;

  const handleMapChange = useCallback(
    (newLat: number, newLng: number) => {
      setLat(newLat);
      setLng(newLng);
    },
    []
  );

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setLoading(true);

    const payload: Record<string, unknown> = {
      model,
      latitude: lat,
      longitude: lng,
      elevation: parseFloat(elevation) || 0,
      timezone: tz,
    };

    if (!isTmy) {
      payload.start_year = startYear;
      payload.end_year = endYear;
    }

    if (isBird) {
      Object.assign(payload, { ozone, aod500, aod380, albedo, asymmetry });
      if (model === "instesre_bird") payload.solar_constant = 1367.0;
    }
    if (isSolis) payload.aod700 = aod700;
    if (isPoa) {
      Object.assign(payload, {
        surface_tilt: surfaceTilt,
        surface_azimuth: surfaceAzimuth,
      });
    }

    try {
      const data = await generateIrradiance(payload) as IrradianceResult;
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Download handlers
  const downloadCSV = () => {
    if (!result) return;
    triggerDownload(
      recordsToCSV(result.records),
      buildFilename(result, "", "csv"),
      "text/csv"
    );
  };

  const downloadSimplifiedCSV = () => {
    if (!result?.records_simplified) return;
    triggerDownload(
      recordsToCSV(result.records_simplified),
      buildFilename(result, "_simplified_day_hour", "csv"),
      "text/csv"
    );
  };

  const downloadJSON = () => {
    if (!result) return;
    triggerDownload(
      JSON.stringify({ ...result, records: result.records }, null, 2),
      buildFilename(result, "", "json"),
      "application/json"
    );
  };

  return (
    <div className="min-h-screen bg-mesh">
      <LoadingOverlay
        visible={loading}
        message={
          language === "tr"
            ? `Ham veri üretiliyor… ${isTmy ? "TMY getiriliyor" : `${startYear}–${endYear} hesaplanıyor`}`
            : `Generating raw data… ${isTmy ? "Fetching TMY" : `Computing ${startYear}–${endYear}`}`
        }
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            <span className="text-gradient-solar">
              {language === "tr" ? "Irradiance" : "Irradiance"}
            </span>{" "}
            <span className="text-slate-200">
              {language === "tr" ? "Üretici" : "Generator"}
            </span>
          </h1>
          <p className="text-slate-400 max-w-2xl text-sm">
            {language === "tr"
              ? "Ham saatlik ışınım verisi üretin. Ortalama yıl stratejisi uygulanmaz — doğrudan ham zaman serisi."
              : "Generate raw hourly irradiance timeseries. No averaging strategy applied — pure raw data."}
          </p>
        </div>

        <div className="space-y-5 animate-slide-up">
          {/* ── Location ── */}
          <GlassCard>
            <h2 className="section-heading text-lg mb-4">
              📍 {language === "tr" ? "Konum" : "Location"}
            </h2>
            <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="input-label">{language === "tr" ? "Enlem" : "Latitude"}</label>
                <input type="number" step="any" value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))} className="input-field" />
              </div>
              <div>
                <label className="input-label">{language === "tr" ? "Boylam" : "Longitude"}</label>
                <input type="number" step="any" value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))} className="input-field" />
              </div>
              <div>
                <label className="input-label">{language === "tr" ? "Yükseklik (m)" : "Elevation (m)"}</label>
                <input type="number" value={elevation}
                  onChange={(e) => setElevation(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="input-label">{language === "tr" ? "Zaman Dilimi" : "Timezone"}</label>
                <select value={tz} onChange={(e) => setTz(e.target.value)} className="select-field">
                  {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </GlassCard>

          {/* ── Model & Time Range ── */}
          <GlassCard>
            <h2 className="section-heading text-lg mb-4">
              ☀️ {language === "tr" ? "Model & Zaman Aralığı" : "Model & Time Range"}
            </h2>

            {/* Model cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setModel(m.value)}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                    model === m.value
                      ? "border-amber-400/40 bg-amber-400/[0.08]"
                      : "border-white/[0.06] hover:border-white/[0.15] bg-white/[0.01]"
                  }`}
                >
                  <p className={`text-sm font-semibold mb-0.5 ${model === m.value ? "text-amber-300" : "text-slate-200"}`}>
                    {m.label}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* Year range (hidden for TMY) */}
            {!isTmy && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">
                    {language === "tr" ? "Başlangıç Yılı" : "Start Year"}
                  </label>
                  <input type="number" value={startYear} min={2005} max={2025}
                    onChange={(e) => setStartYear(parseInt(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="input-label">
                    {language === "tr" ? "Bitiş Yılı" : "End Year"}
                    {isPoa && <span className="ml-1 text-[10px] text-slate-500">(max 2023)</span>}
                  </label>
                  <input type="number" value={endYear} min={2005}
                    max={isPoa ? 2023 : 2025}
                    onChange={(e) => setEndYear(parseInt(e.target.value))} className="input-field" />
                </div>
                <div className="flex items-end">
                  <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] w-full">
                    <p className="text-[10px] text-slate-500">
                      {language === "tr" ? "Toplam süre" : "Total span"}
                    </p>
                    <p className="text-sm font-bold text-amber-400">
                      {endYear >= startYear ? `${endYear - startYear + 1} ${language === "tr" ? "yıl" : "yr"}` : "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {`↓ ${language === "tr" ? "özet + indirme" : "summary + download"}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isTmy && (
              <div className="p-3 rounded-xl bg-blue-400/[0.06] border border-blue-400/20 flex gap-2">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  {language === "tr"
                    ? "TMY her zaman tek bir temsili yıldır. İki indirme formatı sunulur: tam zaman indeksli ve sadeleştirilmiş (yıl çıkarılmış, gün_yılı + saat)."
                    : "TMY is always a single representative year. Two download formats: full datetime index and simplified (year stripped — day_of_year + hour)."}
                </p>
              </div>
            )}
          </GlassCard>

          {/* ── Advanced Parameters ── */}
          {(isBird || isSolis || isPoa) && (
            <GlassCard>
              <button
                type="button"
                className="flex items-center justify-between w-full"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <h2 className="section-heading text-lg">
                  ⚗️ {language === "tr" ? "Gelişmiş Parametreler" : "Advanced Parameters"}
                </h2>
                {showAdvanced
                  ? <ChevronUp className="h-5 w-5 text-slate-400" />
                  : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </button>

              {showAdvanced && (
                <div className="mt-4 animate-fade-in">
                  {isBird && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="input-label">Ozone (atm-cm)</label>
                        <input type="number" step="0.01" value={ozone}
                          onChange={(e) => setOzone(parseFloat(e.target.value))} className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">AOD 500 nm</label>
                        <input type="number" step="0.01" value={aod500}
                          onChange={(e) => setAod500(parseFloat(e.target.value))} className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">AOD 380 nm</label>
                        <input type="number" step="0.01" value={aod380}
                          onChange={(e) => setAod380(parseFloat(e.target.value))} className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">Albedo</label>
                        <input type="number" step="0.01" value={albedo}
                          onChange={(e) => setAlbedo(parseFloat(e.target.value))} className="input-field" />
                      </div>
                      {model === "pvlib_bird" && (
                        <div>
                          <label className="input-label">Asymmetry</label>
                          <input type="number" step="0.01" value={asymmetry}
                            onChange={(e) => setAsymmetry(parseFloat(e.target.value))} className="input-field" />
                        </div>
                      )}
                    </div>
                  )}

                  {isSolis && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">AOD 700 nm</label>
                        <input type="number" step="0.01" value={aod700}
                          onChange={(e) => setAod700(parseFloat(e.target.value))} className="input-field" />
                      </div>
                    </div>
                  )}

                  {isPoa && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">
                          {language === "tr" ? "Panel Eğimi (°)" : "Panel Tilt (°)"}
                        </label>
                        <input type="number" value={surfaceTilt} min={0} max={90}
                          onChange={(e) => setSurfaceTilt(parseFloat(e.target.value))} className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">
                          {language === "tr" ? "Panel Azimut (°)" : "Panel Azimuth (°)"}
                        </label>
                        <input type="number" value={surfaceAzimuth} min={0} max={359}
                          onChange={(e) => setSurfaceAzimuth(parseFloat(e.target.value))} className="input-field" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          )}

          {/* ── Generate Button ── */}
          {error && (
            <div className="p-4 rounded-xl border border-red-400/30 bg-red-400/[0.06] text-sm text-red-300">
              ⚠️ {error}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="btn-primary text-base px-8 py-3.5 flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {language === "tr" ? "Veri Üret" : "Generate Data"}
            </button>
          </div>

          {/* ── Results ── */}
          {result && (
            <div className="space-y-5">
              {/* Summary */}
              <ResultsSummary result={result} language={language} />

              {/* Downloads */}
              <GlassCard>
                <div className="flex items-center gap-2 mb-4">
                  <Download className="h-5 w-5 text-amber-400" />
                  <h2 className="section-heading text-lg">
                    {language === "tr" ? "İndir" : "Download"}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Primary CSV */}
                  <button
                    type="button"
                    onClick={downloadCSV}
                    className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10">
                      <FileText className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {language === "tr" ? "CSV İndir" : "Download CSV"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        {buildFilename(result, "", "csv")}
                      </p>
                    </div>
                  </button>

                  {/* JSON */}
                  <button
                    type="button"
                    onClick={downloadJSON}
                    className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-400/10">
                      <FileJson className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {language === "tr" ? "JSON İndir" : "Download JSON"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        {buildFilename(result, "", "json")}
                      </p>
                    </div>
                  </button>

                  {/* TMY Simplified CSV */}
                  {result.is_tmy && result.records_simplified && (
                    <button
                      type="button"
                      onClick={downloadSimplifiedCSV}
                      className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left sm:col-span-2"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-400/10">
                        <FileText className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          {language === "tr"
                            ? "CSV İndir — Sadeleştirilmiş (Gün + Saat)"
                            : "Download CSV — Simplified (Day of Year + Hour)"}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                          {buildFilename(result, "_simplified_day_hour", "csv")}
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
