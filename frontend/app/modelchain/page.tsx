"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Zap, Database, Edit3, ChevronDown, ChevronUp,
  Plus, Trash2, Play, Search, X, Info, RotateCcw,
} from "lucide-react";
import GlassCard from "@/components/shared/GlassCard";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import WarningBanner from "@/components/shared/WarningBanner";
import MapPicker from "@/components/simulation/MapPicker";
import ResultsPanel from "@/components/simulation/ResultsPanel";
import ModelChainChart from "@/components/charts/ModelChainChart";
import {
  SOLAR_MODELS, DC_MODELS, AC_MODELS,
  AOI_MODELS, SPECTRAL_MODELS, LOSSES_MODELS, TIMEZONES, DEFAULTS,
  SAM_MODULE_DBS, SAM_INVERTER_DBS, TEMP_MODEL_CONFIGS, TEMP_MODELS,
  DC_MODEL_HINTS, AC_MODEL_HINTS,
} from "@/lib/constants";
import { runModelChainAdvanced, searchSamComponents } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

/* ─── Types ─────────────────────────────────────────── */

interface ModuleConfig {
  source: "database" | "manual";
  db_name: string;
  module_name: string;
  module_display: string; // display label
  manual_params_json: string;
}

interface TempConfig {
  source: "lookup" | "manual";
  model: string;
  config: string;
  manual_params_json: string;
}

interface InverterConfig {
  source: "database" | "manual";
  db_name: string;
  inverter_name: string;
  inverter_display: string;
  manual_params_json: string;
}

interface ArrayState {
  id: string;
  name: string;
  surface_tilt: number;
  surface_azimuth: number;
  modules_per_string: number;
  strings: number;
  module_type: string;
  albedo: string;
  module: ModuleConfig;
  temperature_model: TempConfig;
}

function defaultModuleConfig(): ModuleConfig {
  return {
    source: "database",
    db_name: "CECMod",
    module_name: "",
    module_display: "",
    manual_params_json: '{"pdc0": 250, "gamma_pdc": -0.004}',
  };
}

const DEFAULT_FLAT_MODULE: ModuleConfig = {
  source: "database",
  db_name: "CECMod",
  module_name: "Canadian_Solar_Inc__CS6K_300MS",
  module_display: "Canadian Solar CS6K-300MS",
  manual_params_json: '{"pdc0": 300, "gamma_pdc": -0.004}',
};

const DEFAULT_INVERTER: InverterConfig = {
  source: "database",
  db_name: "CECInverter",
  inverter_name: "Fronius_USA__IG_Plus_3_0_1_UNI__208V_",
  inverter_display: "Fronius IG Plus 3.0 UNI",
  manual_params_json: '{"pdc0": 3000, "eta_inv_nom": 0.96}',
};

function defaultTempConfig(): TempConfig {
  return {
    source: "lookup",
    model: "sapm",
    config: "open_rack_glass_polymer",
    manual_params_json: '{"a": -3.56, "b": -0.075, "deltaT": 3}',
  };
}

function defaultArray(id?: string): ArrayState {
  return {
    id: id || String(Date.now()),
    name: "",
    surface_tilt: 30,
    surface_azimuth: 180,
    modules_per_string: 10,
    strings: 2,
    module_type: "glass_polymer",
    albedo: "",
    module: defaultModuleConfig(),
    temperature_model: defaultTempConfig(),
  };
}

/* ─── SAMSearch Component ───────────────────────────── */

interface SAMSearchProps {
  db: string;
  placeholder?: string;
  selectedName: string;
  selectedDisplay: string;
  onSelect: (name: string, display: string, entry: Record<string, unknown>) => void;
  onClear: () => void;
}

function SAMSearch({ db, placeholder, selectedName, selectedDisplay, onSelect, onClear }: SAMSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await searchSamComponents(db, q, 60);
      setResults((data as { results: Record<string, unknown>[] }).results || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [db]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  if (selectedName) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.06]">
        <Database className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-slate-200 flex-1 truncate">{selectedDisplay || selectedName}</span>
        <button type="button" onClick={onClear} className="text-slate-500 hover:text-red-400 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative z-10">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
          placeholder={placeholder || `Search in ${db}…`}
          className="input-field pl-9 text-sm"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-[9999] mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-white/[0.12] bg-slate-900 shadow-2xl">
          {results.map((r) => {
            const name = r.name as string;
            const parts = name.split("_").join(" ").replace(/\s+/g, " ").trim();
            return (
              <button
                key={name}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
                onClick={() => {
                  onSelect(name, parts, r);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                <p className="text-slate-200 font-medium truncate">{parts}</p>
                <p className="text-slate-500 mt-0.5">
                  {Object.entries(r)
                    .filter(([k]) => k !== "name")
                    .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : String(v)}`)
                    .join(" · ")}
                </p>
              </button>
            );
          })}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-[9999] mt-1 w-full rounded-xl border border-white/[0.12] bg-slate-900 p-3 text-xs text-slate-500 text-center">
          No results for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

/* ─── ModuleConfigPanel ─────────────────────────────── */

function ModuleConfigPanel({
  config,
  onChange,
  label = "Module",
}: {
  config: ModuleConfig;
  onChange: (c: ModuleConfig) => void;
  label?: string;
}) {
  const { language } = useLanguage();
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...config, source: "database" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            config.source === "database"
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
              : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
          }`}
        >
          <Database className="h-3 w-3" />
          {language === "tr" ? "Veritabanından" : "From Database"}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...config, source: "manual" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            config.source === "manual"
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
              : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
          }`}
        >
          <Edit3 className="h-3 w-3" />
          {language === "tr" ? "Manuel" : "Manual"}
        </button>
      </div>

      {config.source === "database" ? (
        <div className="space-y-2">
          <div>
            <label className="input-label">{language === "tr" ? "Veritabanı" : "Database"}</label>
            <select
              value={config.db_name}
              onChange={(e) => onChange({ ...config, db_name: e.target.value, module_name: "", module_display: "" })}
              className="select-field text-sm"
            >
              {SAM_MODULE_DBS.map((db) => (
                <option key={db.value} value={db.value}>{db.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              {config.db_name === "CECMod"
                ? (language === "tr" ? "dc_model: cec önerilir" : "Recommended dc_model: cec")
                : (language === "tr" ? "dc_model: sapm önerilir" : "Recommended dc_model: sapm")}
            </p>
          </div>
          <div>
            <label className="input-label">{label}</label>
            <SAMSearch
              db={config.db_name}
              placeholder={language === "tr" ? "Modül ara…" : "Search module…"}
              selectedName={config.module_name}
              selectedDisplay={config.module_display}
              onSelect={(name, display) => onChange({ ...config, module_name: name, module_display: display })}
              onClear={() => onChange({ ...config, module_name: "", module_display: "" })}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="input-label">
            {language === "tr" ? "Modül Parametreleri (JSON)" : "Module Parameters (JSON)"}
            <span className="ml-2 text-[10px] text-slate-500">pvwatts: {"{pdc0, gamma_pdc}"} · cec: {"{a_ref, I_L_ref, …}"}</span>
          </label>
          <textarea
            value={config.manual_params_json}
            onChange={(e) => onChange({ ...config, manual_params_json: e.target.value })}
            rows={3}
            className="input-field font-mono text-xs resize-none"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

/* ─── TempConfigPanel ───────────────────────────────── */

function TempConfigPanel({
  config,
  onChange,
}: {
  config: TempConfig;
  onChange: (c: TempConfig) => void;
}) {
  const { language } = useLanguage();
  const configs = TEMP_MODEL_CONFIGS[config.model] || [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...config, source: "lookup" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            config.source === "lookup"
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
              : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
          }`}
        >
          <Database className="h-3 w-3" />
          pvlib {language === "tr" ? "Tablosundan" : "Lookup"}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...config, source: "manual" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            config.source === "manual"
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
              : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
          }`}
        >
          <Edit3 className="h-3 w-3" />
          {language === "tr" ? "Manuel" : "Manual"}
        </button>
      </div>

      {config.source === "lookup" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">{language === "tr" ? "Model" : "Model"}</label>
            <select
              value={config.model}
              onChange={(e) => {
                const newModel = e.target.value;
                const firstCfg = TEMP_MODEL_CONFIGS[newModel]?.[0]?.value || "";
                onChange({ ...config, model: newModel, config: firstCfg });
              }}
              className="select-field text-sm"
            >
              {TEMP_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">{language === "tr" ? "Konfig" : "Config"}</label>
            <select
              value={config.config}
              onChange={(e) => onChange({ ...config, config: e.target.value })}
              className="select-field text-sm"
            >
              {configs.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="input-label">
            {language === "tr" ? "Parametreler (JSON)" : "Parameters (JSON)"}
            <span className="ml-2 text-[10px] text-slate-500">sapm: {"{a, b, deltaT}"} · pvsyst: {"{u_c, u_v}"}</span>
          </label>
          <textarea
            value={config.manual_params_json}
            onChange={(e) => onChange({ ...config, manual_params_json: e.target.value })}
            rows={2}
            className="input-field font-mono text-xs resize-none"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

/* ─── InverterConfigPanel ───────────────────────────── */

function InverterConfigPanel({
  config,
  onChange,
}: {
  config: InverterConfig;
  onChange: (c: InverterConfig) => void;
}) {
  const { language } = useLanguage();
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...config, source: "database" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            config.source === "database"
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
              : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
          }`}
        >
          <Database className="h-3 w-3" />
          {language === "tr" ? "Veritabanından" : "From Database"}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...config, source: "manual" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            config.source === "manual"
              ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
              : "border-white/[0.08] text-slate-400 hover:border-white/[0.15]"
          }`}
        >
          <Edit3 className="h-3 w-3" />
          {language === "tr" ? "Manuel" : "Manual"}
        </button>
      </div>

      {config.source === "database" ? (
        <div className="space-y-2">
          <div>
            <label className="input-label">{language === "tr" ? "Evirici Veritabanı" : "Inverter Database"}</label>
            <select
              value={config.db_name}
              onChange={(e) => onChange({ ...config, db_name: e.target.value, inverter_name: "", inverter_display: "" })}
              className="select-field text-sm"
            >
              {SAM_INVERTER_DBS.map((db) => (
                <option key={db.value} value={db.value}>{db.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              {language === "tr"
                ? `ac_model: ${AC_MODEL_HINTS[config.db_name] || "sandia"} önerilir`
                : `Recommended ac_model: ${AC_MODEL_HINTS[config.db_name] || "sandia"}`}
            </p>
          </div>
          <div>
            <label className="input-label">{language === "tr" ? "Evirici Seç" : "Select Inverter"}</label>
            <SAMSearch
              db={config.db_name}
              placeholder={language === "tr" ? "Evirici ara…" : "Search inverter…"}
              selectedName={config.inverter_name}
              selectedDisplay={config.inverter_display}
              onSelect={(name, display) => onChange({ ...config, inverter_name: name, inverter_display: display })}
              onClear={() => onChange({ ...config, inverter_name: "", inverter_display: "" })}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="input-label">
            {language === "tr" ? "Evirici Parametreleri (JSON)" : "Inverter Parameters (JSON)"}
            <span className="ml-2 text-[10px] text-slate-500">pvwatts: {"{pdc0, eta_inv_nom}"} · sandia: {"{Paco, Pdco, Vdco, C0…}"}</span>
          </label>
          <textarea
            value={config.manual_params_json}
            onChange={(e) => onChange({ ...config, manual_params_json: e.target.value })}
            rows={3}
            className="input-field font-mono text-xs resize-none"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

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

  // Location
  const [lat, setLat] = useState(38.358);
  const [lng, setLng] = useState(27.155);
  const [altitude, setAltitude] = useState<string>("40");
  const [locTz, setLocTz] = useState("Europe/Istanbul");
  const [locName, setLocName] = useState("DEÜ Fen Fakültesi");

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
    setLocName("DEÜ Fen Fakültesi");
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
    setLoadingMsg(language === "tr" ? "Simülasyon çalışıyor…" : "Running simulation…");

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
          name: locName || undefined,
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
    <div className="min-h-screen bg-mesh">
      <LoadingOverlay visible={loading} message={loadingMsg} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 animate-fade-in flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">
              {language === "tr" ? "Gelişmiş" : "Advanced"} <span className="text-gradient-solar">{language === "tr" ? "Tahmin" : "Forecast"}</span>
            </h1>
            <p className="text-slate-400 max-w-2xl text-sm">
              {language === "tr"
                ? "SAM veritabanlarından modül/evirici seç, çoklu array konfigürasyonu oluştur ve tam pvlib simülasyonu çalıştır."
                : "Select modules and inverters from SAM databases, configure multi-array systems, and run a full pvlib ModelChain simulation."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex-shrink-0 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] transition-all mt-1"
            title={language === "tr" ? "Tüm değerleri sıfırla" : "Reset all values"}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {language === "tr" ? "Sıfırla" : "Reset"}
          </button>
        </div>

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
                <label className="input-label">{language === "tr" ? "Yükseklik (m)" : "Altitude (m)"}</label>
                <input type="number" step="any" value={altitude}
                  onChange={(e) => setAltitude(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="input-label">{language === "tr" ? "Saat Dilimi" : "Timezone"}</label>
                <select value={locTz} onChange={(e) => setLocTz(e.target.value)} className="select-field">
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <label className="input-label">{language === "tr" ? "Saha Adı (isteğe bağlı)" : "Site Name (optional)"}</label>
                <input type="text" value={locName}
                  onChange={(e) => setLocName(e.target.value)} className="input-field" placeholder="e.g. Izmir Plant" />
              </div>
            </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
                  <ModuleConfigPanel config={flatModule} onChange={setFlatModule} />
                </div>
                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    🌡️ {language === "tr" ? "Sıcaklık Modeli" : "Temperature Model"}
                  </h3>
                  <TempConfigPanel config={flatTemp} onChange={setFlatTemp} />
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
                        <ModuleConfigPanel
                          config={arr.module}
                          onChange={(m) => updateArray(arr.id, { module: m })}
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-2">🌡️ {language === "tr" ? "Sıcaklık" : "Temp Model"}</h5>
                        <TempConfigPanel
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
            <InverterConfigPanel config={inverter} onChange={setInverter} />
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

            {/* Tarih aralığı (TMY dışı) */}
            {weatherSource !== "pvgis_tmy" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>
                {dateRangeError && (
                  <p className="text-xs text-red-400">⚠️ {dateRangeError}</p>
                )}
              </div>
            )}

            {/* Zaman dilimi */}
            <div className="mt-4">
              <label className="input-label">{language === "tr" ? "Zaman Dilimi" : "Timezone"}</label>
              <select value={tz} onChange={(e) => setTz(e.target.value)} className="select-field max-w-xs">
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </GlassCard>

          {/* ── Submit ── */}
          {error && (
            <div className="p-4 rounded-xl border border-red-400/30 bg-red-400/[0.06] text-sm text-red-300">
              ⚠️ {error}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary text-base px-8 py-3.5 flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {language === "tr" ? "Simülasyonu Başlat" : "Run Simulation"}
            </button>
          </div>

          {/* ── Results ── */}
          {results && !!(results as Record<string, unknown>).simulation_results && weatherSource === "pvgis_tmy" && (
            <ModelChainChart
              simulation_results={(results as Record<string, unknown>).simulation_results as Record<string, unknown>}
            />
          )}
          <ResultsPanel data={results} error={null} isLoading={false} />
        </div>
      </div>
    </div>
  );
}
