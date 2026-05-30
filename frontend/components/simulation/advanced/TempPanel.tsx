"use client";

import { Database, Edit3 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { TEMP_MODEL_CONFIGS, TEMP_MODELS } from "@/lib/constants";
import { TempConfig } from "@/lib/advanced-types";

export default function TempPanel({
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
              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
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
              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
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
            <label className="input-label">{language === "tr" ? "Yapılandırma" : "Configuration"}</label>
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
          <label className="input-label flex items-center justify-between">
            {language === "tr" ? "Sıcaklık Parametreleri (JSON)" : "Temp. Parameters (JSON)"}
            <span className="ml-2 text-[10px] text-[var(--text-muted)]">sapm: {"{a, b, deltaT}"} · pvsyst: {"{u_c, u_v, eta_m, alpha_absorption}"}</span>
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
