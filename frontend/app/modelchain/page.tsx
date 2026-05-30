"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Zap, Database, Edit3, ChevronDown, ChevronUp,
  Plus, Trash2, Play, Search, X, Info, RotateCcw,
  AlertCircle, Loader2
} from "lucide-react";
import GlassCard from "@/components/shared/GlassCard";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import WarningBanner from "@/components/shared/WarningBanner";
import MapPicker from "@/components/simulation/MapPicker";
import ResultsPanel from "@/components/simulation/ResultsPanel";
import ModelChainChart from "@/components/charts/ModelChainChart";
import Modal from "@/components/shared/Modal";
import {
  SOLAR_MODELS, DC_MODELS, AC_MODELS,
  AOI_MODELS, SPECTRAL_MODELS, LOSSES_MODELS, TIMEZONES, DEFAULTS,
  SAM_MODULE_DBS, SAM_INVERTER_DBS, TEMP_MODEL_CONFIGS, TEMP_MODELS,
  DC_MODEL_HINTS, AC_MODEL_HINTS,
} from "@/lib/constants";
import { runModelChainAdvanced, searchSamComponents } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

import { ModuleConfig, TempConfig, InverterConfig, ArrayState, defaultModuleConfig, DEFAULT_FLAT_MODULE, DEFAULT_INVERTER, defaultTempConfig, defaultArray } from "@/lib/advanced-types";
import ModulePanel from "@/components/simulation/advanced/ModulePanel";
import TempPanel from "@/components/simulation/advanced/TempPanel";
import InverterPanel from "@/components/simulation/advanced/InverterPanel";

/* ─── Payload builder ───────────────────────────────── */

function parseJsonOrNull(jsonStr: string): Record<string, unknown> | null {
  try { return JSON.parse(jsonStr); } catch { return null; }
}

function buildModuleConfig(m: ModuleConfig) {
  if (m.source === "database") {
    return { source: "database", db_name: m.db_name, module_name: m.module_name };
  }
  return { source: "manual", parameters: parseJsonOrNull(m.manual_params_json) };
}

function buildTempConfig(t: TempConfig) {
  if (t.source === "lookup") {
    return { source: "lookup", model: t.model, config: t.config };
  }
  return { source: "manual", parameters: parseJsonOrNull(t.manual_params_json) };
}

function buildInverterConfig(inv: InverterConfig) {
  if (inv.source === "database") {
    return { source: "database", db_name: inv.db_name, inverter_name: inv.inverter_name };
  }
  return { source: "manual", parameters: parseJsonOrNull(inv.manual_params_json) };
}

/* ─── Main Page ─────────────────────────────────────── */

export default function ModelChainAdvancedPage() {
  const { language } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Location
  const [lat, setLat] = useState(38.358);
  const [lng, setLng] = useState(27.155);
  const [altitude, setAltitude] = useState<string>("40");
  const [locTz, setLocTz] = useState("Europe/Istanbul");

  const handleMapChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  }, []);

  // System mode
  const [useArrays, setUseArrays] = useState(false);

  // Flat system
  const [flatTilt, setFlatTilt] = useState(30);
  const [flatAzimuth, setFlatAzimuth] = useState(180);
  const [flatModulesPerString, setFlatModulesPerString] = useState(10);
  const [flatStringsPerInverter, setFlatStringsPerInverter] = useState(2);
  const [flatModuleType, setFlatModuleType] = useState("glass_polymer");
  const [flatRackingModel, setFlatRackingModel] = useState("open_rack");
  const [flatModule, setFlatModule] = useState<ModuleConfig>(DEFAULT_FLAT_MODULE);
  const [flatTemp, setFlatTemp] = useState<TempConfig>(defaultTempConfig());

  // Arrays
  const [pvArrays, setPvArrays] = useState<ArrayState[]>([defaultArray("1")]);

  const addArray = () => setPvArrays((prev) => [...prev, defaultArray(String(Date.now()))]);
  const removeArray = (id: string) => setPvArrays((prev) => prev.filter((a) => a.id !== id));
  const updateArray = (id: string, patch: Partial<ArrayState>) =>
    setPvArrays((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // Inverter
  const [inverter, setInverter] = useState<InverterConfig>(DEFAULT_INVERTER);

  // ModelChain config
  const [showMCConfig, setShowMCConfig] = useState(false);
  const [dcModel, setDcModel] = useState("cec");
  const [acModel, setAcModel] = useState("sandia");
  const [aoiModel, setAoiModel] = useState("physical");
  const [spectralModel, setSpectralModel] = useState("no_loss");
  const [tempModelOverride, setTempModelOverride] = useState("");
  const [lossesModel, setLossesModel] = useState("no_loss");

  // Auto-suggest dc_model when module DB changes (only when using database source)
  useEffect(() => {
    if (flatModule.source !== "database") return;
    const db = flatModule.db_name;
    if (DC_MODEL_HINTS[db]) setDcModel(DC_MODEL_HINTS[db]);
  }, [flatModule.db_name, flatModule.source]);

  useEffect(() => {
    if (inverter.source !== "database") return;
    const db = inverter.db_name;
    if (AC_MODEL_HINTS[db]) setAcModel(AC_MODEL_HINTS[db]);
  }, [inverter.db_name, inverter.source]);

  // Weather
  const [weatherSource, setWeatherSource] = useState("pvgis_tmy");
  const [startDate, setStartDate] = useState("2015-01-01");
  const [endDate, setEndDate] = useState("2020-12-31");
  const [tz, setTz] = useState("UTC");
  const [showClearsky, setShowClearsky] = useState(false);

  // Clear results whenever weather source changes
  useEffect(() => {
    setResults(null);
    setError(null);
  }, [weatherSource]);

  // Reset everything to defaults
  const handleReset = () => {
    setResults(null);
    setError(null);
    setLat(38.358);
    setLng(27.155);
    setAltitude("40");
    setLocTz("Europe/Istanbul");
    setUseArrays(false);
    setFlatTilt(30);
    setFlatAzimuth(180);
    setFlatModulesPerString(10);
    setFlatStringsPerInverter(2);
    setFlatModuleType("glass_polymer");
    setFlatRackingModel("open_rack");
    setFlatModule(DEFAULT_FLAT_MODULE);
    setFlatTemp(defaultTempConfig());
    setPvArrays([defaultArray("1")]);
    setInverter(DEFAULT_INVERTER);
    setShowMCConfig(false);
    setDcModel("cec");
    setAcModel("sandia");
    setAoiModel("physical");
    setSpectralModel("no_loss");
    setTempModelOverride("");
    setLossesModel("no_loss");
    setWeatherSource("pvgis_tmy");
    setStartDate("2015-01-01");
    setEndDate("2020-12-31");
    setTz("UTC");
    setShowClearsky(false);
  };

  const startYear = parseInt(startDate.substring(0, 4));
  const endYear = parseInt(endDate.substring(0, 4));

  const CLEARSKY_SOURCES = [
    { value: "instesre_bird", label: "INSTESRE Bird" },
    { value: "ineichen", label: "Ineichen / Perez" },
    { value: "simplified_solis", label: "Simplified Solis" },
    { value: "pvlib_bird", label: "pvlib Bird" },
  ];

  const isClearsky = CLEARSKY_SOURCES.some((s) => s.value === weatherSource);
  const maxEndDate = weatherSource === "pvgis_poa" ? "2023-12-31" : "2025-12-31";

  const dateRangeError = (() => {
    if (weatherSource === "pvgis_tmy") return null;
    if (endYear < startYear) return language === "tr" ? "Bitiş tarihi başlangıçtan önce olamaz." : "End date must be after start date.";
    if (endYear - startYear + 1 > 20) return language === "tr" ? "Maksimum 20 yıl seçilebilir." : "Maximum range is 20 years.";
    if (weatherSource === "pvgis_poa" && endYear > 2023) return language === "tr" ? "PVGIS SARAH-2 verisi 2023'e kadar mevcut." : "PVGIS SARAH-2 data is available up to 2023.";
    return null;
  })();

  // Validation helper
  const validate = (): string | null => {
    if (!useArrays) {
      if (flatModule.source === "database" && !flatModule.module_name)
        return language === "tr" ? "Modül seçmediniz." : "No module selected.";
    } else {
      if (pvArrays.length === 0)
        return language === "tr" ? "En az 1 array ekleyin." : "Add at least one array.";
      for (const arr of pvArrays) {
        if (arr.module.source === "database" && !arr.module.module_name)
          return language === "tr" ? `Array ${arr.name || arr.id} için modül seçilmedi.` : `No module selected for array ${arr.name || arr.id}.`;
      }
    }
    if (inverter.source === "database" && !inverter.inverter_name)
      return language === "tr" ? "Evirici seçmediniz." : "No inverter selected.";
    return null;
  };

  const handleSubmit = async () => {
    const valErr = validate();
    if (valErr) { setError(valErr); return; }

    if (dateRangeError) { setError(dateRangeError); return; }

    setLoading(true);
    setError(null);
    setResults(null);
    setLoadingMsg(language === "tr" ? "Simülasyon Çalışıyor" : "Running Simulation");

    try {
      const mcConfig: Record<string, string> = {};
      if (dcModel) mcConfig.dc_model = dcModel;
      if (acModel) mcConfig.ac_model = acModel;
      if (aoiModel) mcConfig.aoi_model = aoiModel;
      if (spectralModel) mcConfig.spectral_model = spectralModel;
      if (tempModelOverride) mcConfig.temperature_model = tempModelOverride;
      if (lossesModel) mcConfig.losses_model = lossesModel;

      const payload: Record<string, unknown> = {
        location: {
          latitude: lat,
          longitude: lng,
          altitude: altitude ? parseFloat(altitude) : undefined,
          tz: locTz || undefined,
        },
        use_arrays: useArrays,
        inverter: buildInverterConfig(inverter),
        modelchain_config: Object.keys(mcConfig).length > 0 ? mcConfig : undefined,
        weather_source: weatherSource,
        start_year: startYear,
        end_year: endYear,
        timezone: tz,
        avg_year_strategies: ["simple_mean"],
        reference_year: 2023,
      };

      if (!useArrays) {
        payload.flat_system = {
          surface_tilt: flatTilt,
          surface_azimuth: flatAzimuth,
          modules_per_string: flatModulesPerString,
          strings_per_inverter: flatStringsPerInverter,
          module_type: flatModuleType,
          racking_model: flatRackingModel,
          module: buildModuleConfig(flatModule),
          temperature_model: buildTempConfig(flatTemp),
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

      const result = await runModelChainAdvanced(payload) as Record<string, unknown>;
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <LoadingOverlay visible={loading} message={loadingMsg} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-10 animate-fade-in flex flex-col items-center justify-center text-center gap-4 relative">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              {language === "tr" ? "Gelişmiş" : "Advanced"} <span>{language === "tr" ? "Tahmin" : "Forecast"}</span>
            </h1>
            <p className="text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
              {language === "tr"
                ? "Güneş enerjisi sisteminizi en ince detayına kadar yapılandırın. SAM veritabanlarından endüstri standardı modül ve evirici modelleri seçerek çoklu dizi (array) konfigürasyonları oluşturun ve fiziksel kayıpları da hesaba katarak pvlib tabanlı, yüksek doğruluklu tam model zinciri simülasyonları çalıştırın."
                : "Configure your solar energy system down to the finest detail. Select industry-standard modules and inverters from SAM databases, create multi-array configurations, and run high-accuracy full pvlib model chain simulations that account for various physical losses."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 w-full max-w-2xl mt-2">
            <button
              type="button"
              onClick={() => setInfoModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 transition-all text-sm font-medium"
            >
              <AlertCircle className="h-4 w-4" />
              {language === "tr" ? "Nasıl Kullanılır?" : "How to use?"}
            </button>
          </div>
        </div>

        <Modal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} title={language === "tr" ? "Nasıl Kullanılır: Gelişmiş Tahmin" : "How to Use: Advanced Forecast"}>
          <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            <p>
              {language === "tr"
                ? "Gelişmiş Tahmin modülü, bir veya birden fazla PV dizisi içeren (multi-array) karmaşık güneş enerjisi sistemlerini, profesyonel modelleme kütüphanesi (pvlib) kullanarak detaylı analiz etmenizi sağlar."
                : "The Advanced Forecast module lets you analyze complex solar energy systems containing single or multiple PV arrays using the professional modeling library pvlib."}
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{language === "tr" ? "Konum:" : "Location:"}</strong> {language === "tr" ? "Sahanın enlem, boylam ve yüksekliğini belirleyin." : "Set the latitude, longitude, and elevation of the site."}</li>
              <li><strong>{language === "tr" ? "Sistem Modu:" : "System Mode:"}</strong> {language === "tr" ? "Tek tip eğim/yön içeren projelerde 'Tekil Sistem', farklı çatılara sahip projelerde 'Çoklu Dizi (Multi-Array)' modunu seçin." : "Choose 'Single System' for a uniform tilt/azimuth project, or 'Multi-Array' for projects with different roof planes."}</li>
              <li><strong>{language === "tr" ? "Modül ve İnvertör:" : "Module & Inverter:"}</strong> {language === "tr" ? "Endüstri standardı SAM (System Advisor Model) veritabanlarında arama yaparak cihazlarınızı seçin. (Örn: 'Canadian Solar' veya 'Fronius')." : "Search within industry-standard SAM databases to pick your equipment (e.g., 'Canadian Solar' or 'Fronius')."}</li>
              <li><strong>{language === "tr" ? "Hava Verisi:" : "Weather Data:"}</strong> {language === "tr" ? "Modelin çalışacağı hava durumu kaynağını (PVGIS TMY, Tarihsel Seriler vb.) ve tarih aralığını belirleyin." : "Choose the weather data source (PVGIS TMY, Historical Time Series, etc.) and date range."}</li>
              <li><strong>{language === "tr" ? "ModelChain Yapılandırması:" : "ModelChain Config:"}</strong> {language === "tr" ? "DC ve AC hesaplama modellerini (CEC, Sandia, PVWatts vb.) ihtiyacınıza göre özelleştirin." : "Customize DC and AC calculation models (CEC, Sandia, PVWatts, etc.) according to your needs."}</li>
            </ul>
          </div>
        </Modal>

        <WarningBanner
          type="time"
          message={
            language === "tr"
              ? "Simülasyon yapılandırma ve veri kaynağına göre 15–90 saniye sürebilir. Fail-fast: konfigürasyon veri çekilmeden önce doğrulanır."
              : "Simulation may take 15–90 seconds. Fail-fast validation runs before any data is fetched."
          }
        />

        <div className="mt-6 space-y-6 animate-slide-up">

          {/* ── Location ── */}
          <GlassCard>
            <h2 className="section-heading text-lg mb-4">📍 {language === "tr" ? "Konum" : "Location"}</h2>
            <MapPicker latitude={lat} longitude={lng} onLocationChange={handleMapChange} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
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
                <label className="input-label">{language === "tr" ? "Yükseklik (m)" : "Altitude (m)"}</label>
                <input type="number" step="any" value={altitude}
                  onChange={(e) => setAltitude(e.target.value)} className="input-field" />
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="w-full mt-5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 flex items-center justify-center gap-2 font-medium transition-all"
            >
              <RotateCcw className="h-4 w-4" />
              {language === "tr" ? "Tüm Değişiklikleri Sıfırla" : "Reset All Changes"}
            </button>
          </GlassCard>

          {/* ── System Mode ── */}
          <GlassCard>
            <h2 className="section-heading text-lg mb-4">🔧 {language === "tr" ? "Sistem Modu" : "System Mode"}</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setUseArrays(false)}
                className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                  !useArrays
                    ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-300"
                    : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
                }`}
              >
                <p className="font-semibold text-sm">{language === "tr" ? "Tekil Sistem (Flat)" : "Single System (Flat)"}</p>
                <p className="text-xs mt-1 opacity-70">
                  {language === "tr"
                    ? "Tilt, azimuth, modül, sıcaklık modeli sistem düzeyinde. Klasik yapı."
                    : "Tilt, azimuth, module, temp model at system level. Classic setup."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setUseArrays(true)}
                className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                  useArrays
                    ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-300"
                    : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
                }`}
              >
                <p className="font-semibold text-sm">{language === "tr" ? "Çoklu Array" : "Multi-Array"}</p>
                <p className="text-xs mt-1 opacity-70">
                  {language === "tr"
                    ? "Her array kendi yönü, modülü ve sıcaklık modeline sahip. pvlib Array nesneleri kullanılır."
                    : "Each array has its own orientation, module and temp model. Uses pvlib Array objects."}
                </p>
              </button>
            </div>
            {useArrays && (
              <div className="mt-3 p-3 rounded-xl bg-blue-400/[0.06] border border-blue-400/20 flex gap-2">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  {language === "tr"
                    ? "Array modunda pvlib sistem düzeyindeki tilt/azimuth/modül parametrelerini yoksayar. Evirici parametreleri her zaman sistem düzeyindedir."
                    : "In array mode, pvlib ignores system-level tilt/azimuth/module params. Inverter parameters always stay at system level."}
                </p>
              </div>
            )}
          </GlassCard>

          {/* ── Flat System Config ── */}
          {!useArrays && (
            <GlassCard>
              <h2 className="section-heading text-lg mb-4">☀️ {language === "tr" ? "Sistem Konfigürasyonu" : "System Configuration"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="input-label">{language === "tr" ? "Eğim (°)" : "Tilt (°)"}</label>
                  <input type="number" value={flatTilt} min={0} max={90}
                    onChange={(e) => setFlatTilt(parseFloat(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="input-label">{language === "tr" ? "Azimut (°)" : "Azimuth (°)"}</label>
                  <input type="number" value={flatAzimuth} min={0} max={359}
                    onChange={(e) => setFlatAzimuth(parseFloat(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="input-label">{language === "tr" ? "Modül/Dizi" : "Modules/String"}</label>
                  <input type="number" value={flatModulesPerString} min={1}
                    onChange={(e) => setFlatModulesPerString(parseInt(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="input-label">{language === "tr" ? "Dizi/Evirici" : "Strings/Inverter"}</label>
                  <input type="number" value={flatStringsPerInverter} min={1}
                    onChange={(e) => setFlatStringsPerInverter(parseInt(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="input-label">{language === "tr" ? "Modül Tipi" : "Module Type"}</label>
                  <select value={flatModuleType} onChange={(e) => setFlatModuleType(e.target.value)} className="select-field">
                    <option value="glass_polymer">Glass / Polymer</option>
                    <option value="glass_glass">Glass / Glass</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">{language === "tr" ? "Montaj Modeli" : "Racking Model"}</label>
                  <select value={flatRackingModel} onChange={(e) => setFlatRackingModel(e.target.value)} className="select-field">
                    <option value="open_rack">Open Rack</option>
                    <option value="close_mount">Close Mount</option>
                    <option value="insulated_back">Insulated Back</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    🔆 {language === "tr" ? "Modül Seçimi" : "Module Selection"}
                  </h3>
                  <ModulePanel config={flatModule} onChange={setFlatModule} />
                </div>
                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    🌡️ {language === "tr" ? "Sıcaklık Modeli" : "Temperature Model"}
                  </h3>
                  <TempPanel config={flatTemp} onChange={setFlatTemp} />
                </div>
              </div>
            </GlassCard>
          )}

          {/* ── Multi-Array Config ── */}
          {useArrays && (
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-heading text-lg">📐 {language === "tr" ? "PV Dizileri" : "PV Arrays"}</h2>
                <button type="button" onClick={addArray} className="btn-secondary text-xs flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  {language === "tr" ? "Array Ekle" : "Add Array"}
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
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div>
                        <label className="input-label">{language === "tr" ? "Ad (isteğe bağlı)" : "Name (optional)"}</label>
                        <input type="text" value={arr.name}
                          onChange={(e) => updateArray(arr.id, { name: e.target.value })} className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="input-label">{language === "tr" ? "Eğim (°)" : "Tilt (°)"}</label>
                        <input type="number" value={arr.surface_tilt} min={0} max={90}
                          onChange={(e) => updateArray(arr.id, { surface_tilt: parseFloat(e.target.value) })} className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="input-label">{language === "tr" ? "Azimut (°)" : "Azimuth (°)"}</label>
                        <input type="number" value={arr.surface_azimuth} min={0} max={359}
                          onChange={(e) => updateArray(arr.id, { surface_azimuth: parseFloat(e.target.value) })} className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="input-label">{language === "tr" ? "Modül/Dizi" : "Modules/String"}</label>
                        <input type="number" value={arr.modules_per_string} min={1}
                          onChange={(e) => updateArray(arr.id, { modules_per_string: parseInt(e.target.value) })} className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="input-label">{language === "tr" ? "Dizi Sayısı" : "Strings"}</label>
                        <input type="number" value={arr.strings} min={1}
                          onChange={(e) => updateArray(arr.id, { strings: parseInt(e.target.value) })} className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="input-label">{language === "tr" ? "Modül Tipi" : "Module Type"}</label>
                        <select value={arr.module_type}
                          onChange={(e) => updateArray(arr.id, { module_type: e.target.value })} className="select-field text-sm">
                          <option value="glass_polymer">Glass / Polymer</option>
                          <option value="glass_glass">Glass / Glass</option>
                        </select>
                      </div>
                      <div>
                        <label className="input-label">{language === "tr" ? "Albedo (isteğe bağlı)" : "Albedo (optional)"}</label>
                        <input type="number" step="0.01" value={arr.albedo} min={0} max={1}
                          onChange={(e) => updateArray(arr.id, { albedo: e.target.value })} className="input-field text-sm"
                          placeholder="0.25" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/[0.06] pt-3">
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-2">🔆 {language === "tr" ? "Modül" : "Module"}</h5>
                        <ModulePanel
                          config={arr.module}
                          onChange={(m) => updateArray(arr.id, { module: m })}
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-2">🌡️ {language === "tr" ? "Sıcaklık" : "Temp Model"}</h5>
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
            <h2 className="section-heading text-lg mb-4">⚡ {language === "tr" ? "Evirici (Sistem Düzeyi)" : "Inverter (System Level)"}</h2>
            <InverterPanel config={inverter} onChange={setInverter} />
          </GlassCard>

          {/* ── ModelChain Config ── */}
          <GlassCard>
            <button type="button" className="flex items-center justify-between w-full"
              onClick={() => setShowMCConfig(!showMCConfig)}>
              <h2 className="section-heading text-lg">⚙️ {language === "tr" ? "ModelChain Konfigürasyonu" : "ModelChain Configuration"}</h2>
              {showMCConfig ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>
            {showMCConfig && (
              <div className="mt-4 space-y-3 animate-fade-in">
                <div className="p-3 rounded-xl bg-blue-400/[0.06] border border-blue-400/20 flex gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400">
                    {language === "tr"
                      ? "pvlib modül/evirici parametrelerine göre modeli otomatik algılayabilir. Veritabanı seçimlerinize göre öneri otomatik yapılır."
                      : "pvlib can auto-detect models from parameter sets. Suggestions are auto-applied based on your DB selections."}
                  </p>
                </div>
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

          {/* ── Weather Source ── */}
          <GlassCard>
            <h2 className="section-heading text-lg mb-4">🌤️ {language === "tr" ? "Hava Verisi Kaynağı" : "Weather Data Source"}</h2>

            {/* TMY / POA ana seçenekler */}
            <div className="flex gap-3 mb-4">
              {[
                { value: "pvgis_tmy", label: "PVGIS TMY", desc: language === "tr" ? "Tipik Meteorolojik Yıl" : "Typical Meteorological Year" },
                { value: "pvgis_poa", label: "PVGIS POA", desc: language === "tr" ? "Çok Yıllı Saatlik · SARAH-2" : "Multi-Year Hourly · SARAH-2" },
              ].map((s) => (
                <button key={s.value} type="button"
                  onClick={() => { setWeatherSource(s.value); setShowClearsky(false); }}
                  className={`flex-1 p-3 rounded-xl border text-left text-sm transition-all ${
                    weatherSource === s.value && !isClearsky
                      ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-300"
                      : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
                  }`}>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>

            {/* Gelişmiş: Clear-Sky toggle */}
            <button type="button" onClick={() => setShowClearsky((v) => !v)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showClearsky ? "rotate-180" : ""}`} />
              {language === "tr" ? "Gelişmiş: Clear-Sky Modelleri" : "Advanced: Clear-Sky Models"}
            </button>

            {showClearsky && (
              <div className="mb-4 space-y-3">
                <div className="p-3 rounded-xl bg-orange-400/[0.06] border border-orange-400/20 flex gap-2">
                  <Info className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400">
                    {language === "tr"
                      ? "Clear-sky modeller bulutsuz gökyüzü varsayar. Gerçek üretim bu değerlerin çok altında olacaktır."
                      : "Clear-sky models assume a cloudless sky. Actual production will be significantly lower than these values."}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CLEARSKY_SOURCES.map((s) => (
                    <button key={s.value} type="button"
                      onClick={() => setWeatherSource(s.value)}
                      className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                        weatherSource === s.value
                          ? "border-orange-400/40 bg-orange-400/[0.08] text-orange-300"
                          : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
                      }`}>
                      <p className="font-semibold">{s.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tarih aralığı (TMY dışı) ve Zaman Dilimi */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {weatherSource !== "pvgis_tmy" && (
                  <>
                    <div>
                      <label className="input-label">{language === "tr" ? "Başlangıç Tarihi" : "Start Date"}</label>
                      <input type="date" value={startDate} min="2005-01-01" max="2025-12-31"
                        onChange={(e) => setStartDate(e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className="input-label">
                        {language === "tr" ? "Bitiş Tarihi" : "End Date"}
                        {weatherSource === "pvgis_poa" && (
                          <span className="ml-2 text-[10px] text-amber-400/80">max. 2023</span>
                        )}
                      </label>
                      <input type="date" value={endDate} min="2005-01-01" max={maxEndDate}
                        onChange={(e) => setEndDate(e.target.value)} className="input-field" />
                    </div>
                  </>
                )}
                <div className={weatherSource === "pvgis_tmy" ? "col-span-1 sm:col-span-3" : ""}>
                  <label className="input-label">{language === "tr" ? "Zaman Dilimi (Timezone)" : "Timezone"}</label>
                  <select value={tz} onChange={(e) => setTz(e.target.value)} className="select-field">
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {weatherSource !== "pvgis_tmy" && dateRangeError && (
                <p className="text-xs text-red-400">⚠️ {dateRangeError}</p>
              )}
            </div>
          </GlassCard>

          {/* ── Submit ── */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div className="text-center">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full sm:w-2/3 md:w-1/2 mx-auto mt-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-xl shadow-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <><Loader2 className="h-6 w-6 animate-spin" /> {language === "tr" ? "Çalışıyor…" : "Running…"}</> : <><Play className="h-6 w-6" /> {language === "tr" ? "Simülasyonu Başlat" : "Run Simulation"}</>}
            </button>
          </div>

          {/* ── Results ── */}
          {results && !!(results as Record<string, unknown>).simulation_results && (
            <>
              {/* Show chart for TMY */}
              {weatherSource === "pvgis_tmy" ? (
                <ModelChainChart
                  simulation_results={(results as Record<string, unknown>).simulation_results as Record<string, unknown>}
                />
              ) : (
                /* Show summary box for POA / Clearsky where chart is not supported yet */
                <div className="mb-6 flex flex-wrap gap-3">
                  {Object.keys((results as Record<string, unknown>).simulation_results as Record<string, unknown>).map((strat) => {
                    const ac = ((results as Record<string, unknown>).simulation_results as Record<string, any>)[strat]?.ac;
                    if (!ac) return null;
                    let total = 0;
                    for (const val of Object.values(ac)) {
                      if (typeof val === "number" && isFinite(val)) total += val / 1000;
                    }
                    const labelText = strat === "simple_mean" 
                      ? (language === "tr" ? "Toplam AC Üretim" : "Total AC Production") 
                      : (strat === "tmy" ? (language === "tr" ? "Toplam AC Üretim" : "Total AC Production") : strat);
                      
                    return (
                      <div key={strat} className="flex-1 min-w-[200px] glass-card p-4 flex items-center justify-center border border-amber-400/20 bg-amber-400/[0.06]">
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-amber-400" />
                          <p className="text-sm text-slate-300 font-semibold uppercase">
                            {labelText}:
                          </p>
                          <p className="text-xl font-bold text-white">
                            {total < 100 ? total.toFixed(2) : Math.round(total).toLocaleString()} 
                            <span className="text-xs font-medium text-amber-400 ml-1.5">{language === "tr" ? "kWh/yıl" : "kWh/year"}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <ResultsPanel data={results} error={null} isLoading={false} />
        </div>
      </div>
    </div>
  );
}
