"use client";

import { useState, useMemo } from "react";
import { Download, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface ResultsPanelProps {
  data: AnyRecord | null;
  error: string | null;
  isLoading: boolean;
}

/* ── Build a CLEAN summary — no Object Object, no hourly dumps ── */
function buildCleanSummary(data: AnyRecord, t: (key: string) => string): [string, string][] {
  const entries: [string, string][] = [];

  // Top-level simple scalars
  const SKIP_KEYS = new Set([
    "hourly", "ac", "dc", "total_irrad", "comparison", "results",
    "summary_matrix",
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (SKIP_KEYS.has(key)) continue;

    if (value === null || value === undefined) {
      entries.push([key, "—"]);
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const display = typeof value === "number"
        ? (Number.isInteger(value) ? value.toString() : value.toFixed(4))
        : String(value);
      entries.push([key, display]);
    } else if (Array.isArray(value)) {
      if (value.length <= 5 && value.every((v) => typeof v !== "object")) {
        entries.push([key, value.join(", ")]);
      } else {
        entries.push([key, `[${value.length} ${t("simulation.results.items")}]`]);
      }
    } else if (typeof value === "object") {
      // Only flatten ONE level — show flat children as "parent.child"
      for (const [subKey, subVal] of Object.entries(value)) {
        if (subVal === null || subVal === undefined) {
          entries.push([`${key}.${subKey}`, "—"]);
        } else if (typeof subVal === "string" || typeof subVal === "number" || typeof subVal === "boolean") {
          const display = typeof subVal === "number"
            ? (Number.isInteger(subVal) ? subVal.toString() : subVal.toFixed(2))
            : String(subVal);
          entries.push([`${key}.${subKey}`, display]);
        }
        // Skip nested objects/arrays at this level — no "Object Object"
      }
    }
  }

  // Strategy-level summaries (from individual model results)
  if (data.results && typeof data.results === "object") {
    for (const [stratName, stratData] of Object.entries(data.results)) {
      const sd = stratData as AnyRecord;
      if (sd?.summary && typeof sd.summary === "object") {
        for (const [sKey, sVal] of Object.entries(sd.summary)) {
          if (typeof sVal === "number") {
            entries.push([`${stratName}.${sKey}`, sVal.toFixed(2)]);
          }
        }
      }
      if (sd?.hourly && Array.isArray(sd.hourly)) {
        entries.push([`${stratName}.hourly_records`, `${sd.hourly.length} ${t("simulation.results.dataPoints")}`]);
      }
    }
  }

  // Deep comparison summary matrix
  if (data.summary_matrix && typeof data.summary_matrix === "object") {
    entries.push(["", ""]); // spacer
    entries.push([t("simulation.results.comparisonSpacer"), ""]);
    for (const [model, strats] of Object.entries(data.summary_matrix)) {
      if (typeof strats === "object" && strats !== null && !(strats as AnyRecord).error) {
        for (const [strat, val] of Object.entries(strats as AnyRecord)) {
          if (typeof val === "number") {
            entries.push([`${model}.${strat}`, val.toFixed(2) + " kWh/m²"]);
          }
        }
      }
    }
  }

  // ModelChain summary
  if (data.summary && typeof data.summary === "object" && !data.results) {
    for (const [sKey, sVal] of Object.entries(data.summary)) {
      if (typeof sVal === "number") {
        entries.push([sKey, sVal.toFixed(2)]);
      }
    }
  }

  // Data size indicators (for transparency)
  if (data.ac && typeof data.ac === "object") {
    entries.push(["ac_timeseries", `${Object.keys(data.ac).length} ${t("simulation.results.dataPoints")}`]);
  }
  if (data.multi_year_rows) {
    entries.push(["multi_year_rows", String(data.multi_year_rows)]);
  }

  return entries;
}

function downloadJSON(data: AnyRecord, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultsPanel({ data, error, isLoading }: ResultsPanelProps) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const summaryEntries = useMemo(() => {
    if (!data) return [];
    return buildCleanSummary(data, t);
  }, [data, t]);

  if (isLoading) {
    return (
      <div className="glass-card animate-pulse">
        <div className="h-4 bg-white/[0.06] rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-3 bg-white/[0.04] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card border-red-500/20">
        <h3 className="text-sm font-semibold text-red-400 mb-2">Error</h3>
        <p className="text-sm text-red-300/80">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const model = data.model || "simulation";
    downloadJSON(data, `solarhesap_${model}_${Date.now()}`);
  };

  return (
    <div className="glass-card" id="results-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-heading text-lg">📋 {t("simulation.results.title")}</h3>
      </div>

      {summaryEntries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="results-table">
            <thead>
              <tr>
                <th>{t("simulation.results.parameter")}</th>
                <th>{t("simulation.results.value")}</th>
              </tr>
            </thead>
            <tbody>
              {summaryEntries.map(([key, value], i) => {
                if (key === "" && value === "") {
                  return <tr key={i}><td colSpan={2} className="h-2" /></tr>;
                }
                if (value === "") {
                  return (
                    <tr key={i}>
                      <td colSpan={2} className="font-semibold text-xs text-slate-300 pt-2">{key}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={i}>
                    <td className="font-mono text-xs text-amber-400/80">{key}</td>
                    <td className="font-mono text-xs">{value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}



      <div className="mt-6 border-t border-white/[0.06] pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">{language === "tr" ? "Sonuçları İndir" : "Download Results"}</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <button type="button" onClick={handleDownload}
            className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-400/10">
              <Download className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{t("simulation.results.downloadJson")}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{`solarhesap_${data.model || "simulation"}_${Date.now()}.json`}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
