"use client";

import { Database, Edit3 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { SAM_INVERTER_DBS, AC_MODEL_HINTS } from "@/lib/constants";
import { InverterConfig } from "@/lib/advanced-types";
import SAMSearch from "./SAMSearch";

export default function InverterPanel({
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
              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
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
              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
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
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              {config.db_name === "CECInverter" || config.db_name === "SandiaInverter"
                ? (language === "tr" ? "ac_model: sandia önerilir" : "Recommended ac_model: sandia")
                : (language === "tr" ? "ac_model: adr önerilir" : "Recommended ac_model: adr")}
            </p>
          </div>
          <div>
            <label className="input-label">{language === "tr" ? "Evirici (İnvertör)" : "Inverter"}</label>
            <SAMSearch
              db={config.db_name}
              placeholder={language === "tr" ? "İnvertör ara…" : "Search inverter…"}
              selectedName={config.inverter_name}
              selectedDisplay={config.inverter_display}
              onSelect={(name, display) => onChange({ ...config, inverter_name: name, inverter_display: display })}
              onClear={() => onChange({ ...config, inverter_name: "", inverter_display: "" })}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="input-label flex items-center justify-between">
            {language === "tr" ? "İnvertör Parametreleri (JSON)" : "Inverter Parameters (JSON)"}
            <span className="ml-2 text-[10px] text-[var(--text-muted)]">pvwatts: {"{pdc0, eta_inv_nom}"} · sandia: {"{Paco, Pdco, …}"}</span>
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
