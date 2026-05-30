"use client";

import { useState, useCallback } from "react";
import {
  MapPin, Settings, Zap, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Download, Calculator, FileJson
} from "lucide-react";
import dynamic from "next/dynamic";
import EnergyDrillChart from "@/components/charts/EnergyDrillChart";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import Modal from "@/components/shared/Modal";
import { runBasicElectric } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import GlassCard from "@/components/shared/GlassCard";

const MapPicker = dynamic(
  () => import("@/components/simulation/MapPicker"),
  { ssr: false }
);

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const TIERS = [
  { id: "very_low",   label: { en: "Very Low (~14%)",       tr: "Çok Düşük (~14%)" } },
  { id: "low",        label: { en: "Low (~15%)",            tr: "Düşük (~15%)" } },
  { id: "medium",     label: { en: "Medium (~18%)",         tr: "Orta (~18%)" } },
  { id: "medium_high",label: { en: "Medium-High (~20%)",    tr: "Orta-Yüksek (~20%)" } },
  { id: "high",       label: { en: "High (~22%)",           tr: "Yüksek (~22%)" } },
] as const;

type TierId = (typeof TIERS)[number]["id"];

/* ── Summary card ──────────────────────────────────── */
function SummaryCard({ label, value, unit, sub, tooltip }: {
  label: string; value: string; unit: string; sub?: string; tooltip?: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <p className="text-2xl font-bold text-slate-100">
        {value}
        <span className="text-sm font-medium text-slate-400 ml-1">{unit}</span>
      </p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResult = Record<string, any>;

export default function EstimatePage() {
  const { t, language } = useLanguage();

  /* ── Form state ─────────────────────────────────────── */
  const [lat, setLat] = useState(38.4192);
  const [lng, setLng] = useState(27.1287);
  const [areaMode, setAreaMode] = useState<"m2" | "ab">("m2");
  const [areaM2, setAreaM2] = useState(10);
  const [areaA, setAreaA] = useState(5);
  const [areaB, setAreaB] = useState(10);
  const [tier, setTier] = useState<TierId>("medium");
  const [tilt, setTilt] = useState(35);
  const [azimuth, setAzimuth] = useState(180);
  const effectiveArea = areaMode === "m2" ? areaM2 : areaA * areaB;

  /* ── Result state ───────────────────────────────────── */
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const handleMapChange = useCallback((la: number, lo: number) => {
    setLat(la);
    setLng(lo);
    // Auto-update tilt to latitude-based optimal
    const autoTilt = Math.min(Math.abs(la), 60);
    setTilt(Math.round(autoTilt));
    setAzimuth(la >= 0 ? 180 : 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await runBasicElectric({
        latitude: lat,
        longitude: lng,
        elevation: 0,
        efficiency_tier: tier,
        ...(areaMode === "m2" ? { area_m2: areaM2 } : { area_a: areaA, area_b: areaB }),
        surface_tilt: tilt,
        surface_azimuth: azimuth,
      });
      setResult(data as ApiResult);
      // Scroll to results
      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  /* ── Derived display values ─────────────────────────── */
  const sys = result?.system_info;
  const sum = result?.summary;
  const hourly: { datetime: string; ac_kw: number }[] = result?.hourly ?? [];
  const annualKwh: number = sum?.annual_energy_kwh ?? 0;

  /* ── Downloads ──────────────────────────────────────── */
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    if (!result) return;
    triggerDownload(
      new Blob([JSON.stringify({ generated: new Date().toISOString(), ...result }, null, 2)], { type: "application/json" }),
      `solarhesap_${lat.toFixed(4)}_${lng.toFixed(4)}.json`,
    );
  };

  const downloadCSV = () => {
    if (!result) return;
    const rows: any[][] = [
      ["# Solar Production Estimate — Solarhesap"],
      ["# Annual Energy (kWh)", sum.annual_energy_kwh],
      ["# Specific Yield (kWh/kWp)", sum.specific_yield_kwh_kwp],
      ["# Capacity Factor (%)", sum.capacity_factor_pct],
      [],
      ["Month", "Energy (kWh)"],
      ...(result.monthly ?? []).map((m: any) => [m.month_name as string, String(m.energy_kwh)]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    triggerDownload(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `solarhesap_${lat.toFixed(4)}_${lng.toFixed(4)}.csv`,
    );
  };

  const tr = (en: string, trStr: string) => language === "tr" ? trStr : en;

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">

        {/* ════ Header ════ */}
        <div className="mb-10 animate-fade-in flex flex-col items-center justify-center text-center gap-4 relative">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              {tr("Energy", "Üretim")} <span>{tr("Estimate", "Tahmini")}</span>
            </h1>
            <p className="text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
              {tr(
                "Perform a basic yet scientifically accurate estimation of the annual AC energy yield. This tool utilizes PVGIS TMY weather data and standard PV system parameters to deliver rapid insights into your solar potential.",
                "Yıllık AC enerji üretiminizin temel ancak bilimsel olarak doğru bir tahminini gerçekleştirin. Bu araç, güneş enerjisi potansiyelinize dair hızlı ve güvenilir içgörüler sunmak için PVGIS TMY (Tipik Meteorolojik Yıl) hava verilerini ve standart PV sistem parametrelerini kullanır."
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

        <Modal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} title={tr("How to Use: Energy Estimate", "Nasıl Kullanılır: Üretim Tahmini")}>
          <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            <p>
              {tr(
                "The Energy Estimate module provides a quick and reliable way to calculate the expected AC energy yield of a solar PV system.",
                "Üretim Tahmini modülü, bir güneş enerjisi sisteminin beklenen AC enerji verimini hesaplamak için hızlı ve güvenilir bir yol sunar."
              )}
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{tr("Location:", "Konum:")}</strong> {tr("Select your site on the map or enter latitude/longitude. The optimal tilt is auto-calculated based on latitude.", "Haritadan sahanızı seçin veya enlem/boylam girin. Optimum eğim, enleme göre otomatik hesaplanır.")}</li>
              <li><strong>{tr("Area:", "Alan:")}</strong> {tr("Define the available roof or land area. You can input direct square meters or A×B dimensions.", "Mevcut çatı veya arazi alanını belirleyin. Doğrudan metrekare veya A×B boyutları girebilirsiniz.")}</li>
              <li><strong>{tr("Panel Type:", "Panel Tipi:")}</strong> {tr("Choose the efficiency tier of your panels (Very Low to High). This affects how much power fits into the area.", "Panellerinizin verimlilik seviyesini seçin. Bu, alana ne kadar güç sığacağını etkiler.")}</li>
              <li><strong>{tr("Orientation:", "Yönelim:")}</strong> {tr("Adjust the Tilt (angle from horizontal) and Azimuth (direction: 180° is South).", "Eğim (yataydan açı) ve Azimut (yön: 180° Güney) ayarlarını yapın.")}</li>
            </ul>
            <p className="text-slate-400 text-xs mt-4">
              {tr(
                "Note: This tool uses PVGIS TMY data and standard default loss assumptions (16%). For detailed multi-array setups with specific SAM components, use the Advanced Forecast module.",
                "Not: Bu araç PVGIS TMY verilerini ve standart kayıp varsayımlarını (%16) kullanır. Belirli SAM bileşenleriyle detaylı çoklu dizi kurulumları için Gelişmiş Tahmin modülünü kullanın."
              )}
            </p>
          </div>
        </Modal>

        <div className="mt-6 space-y-6 animate-slide-up">
          {/* ── Location ── */}
          <GlassCard>
            <h2 className="section-heading text-lg mb-4">📍 {tr("Location", "Konum")}</h2>
            <MapPicker
              latitude={lat}
              longitude={lng}
              onLocationChange={handleMapChange}
            />
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <GlassCard>
              <h2 className="section-heading text-lg mb-4">⚙️ {tr("System Configuration", "Sistem Konfigürasyonu")}</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Area */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-1 mb-1.5 min-h-[32px]">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
                      <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                        {tr("Roof Area", "Panel Alanı")}
                      </span>
                      <InfoTooltip text={t("estimate.ttPackingFactor")} align="left" width={200} />
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

                {/* Panel tier */}
                <div className="flex flex-col">
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 min-h-[32px]">
                    <Zap className="h-3 w-3 text-amber-400" />
                    {tr("Panel Type", "Panel Tipi")}
                  </label>
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

                {/* Tilt */}
                  <div className="flex flex-col">
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 min-h-[32px] whitespace-nowrap">
                      <span className="text-amber-400 text-[10px] font-bold">∠</span>
                      {tr("Tilt (°)", "Eğim Açısı (°)")}
                      <InfoTooltip text={tr("Panel tilt from horizontal. Default is your latitude — optimal for annual yield.", "Panelin yataydan eğim açısı. Varsayılan enlem değeridir — yıllık enerji için optimaldir.")} />
                    </label>
                      <input
                      type="number" step="1" min={0} max={90} value={tilt}
                      onChange={(e) => setTilt(parseInt(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 min-h-[32px] whitespace-nowrap">
                      <span className="text-amber-400 text-[10px] font-bold">⊙</span>
                      {tr("Azimuth (°)", "Azimut Açısı (°)")}
                      <InfoTooltip text={tr("0° = North, 90° = East, 180° = South. South-facing (180°) is optimal in Northern Hemisphere.", "0° = Kuzey, 90° = Doğu, 180° = Güney. Kuzey yarımkürede güneye yönelik (180°) optimaldir.")} />
                    </label>
                      <input
                        type="number" step="1" min={0} max={360} value={azimuth}
                        onChange={(e) => setAzimuth(parseInt(e.target.value) || 0)}
                        className="input-field"
                      />
                  </div>
              </div>
            </GlassCard>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="text-center">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-2/3 md:w-1/2 mx-auto mt-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-lg bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-xl shadow-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><Loader2 className="h-6 w-6 animate-spin" />{t("estimate.calculating")}</>
                  : <><Calculator className="h-6 w-6" />{tr("Start Simulation", "Simülasyonu Başlat")}</>
                }
              </button>
            </div>
          </form>
        </div>

        {/* ════ Results section (below map+panel) ════ */}
        {(loading || result) && (
          <div id="results-section" className="mt-6 space-y-5">

            {loading && (
              <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="h-10 w-10 text-amber-400 animate-spin mb-4" />
                <p className="text-slate-400 text-sm">
                  {tr("Fetching TMY weather + Running Simulation", "TMY verisi alınıyor + Simülasyon Çalışıyor")}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  {tr("~10–20 seconds", "~10–20 saniye sürer")}
                </p>
              </div>
            )}

            {result && (
              <>


                {/* System at a glance */}
                <div className="glass-card">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    {t("estimate.systemGlance")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: t("estimate.panels"), value: `${sys?.n_panels ?? "—"}`, sub: `${sys?.modules_per_string}S × ${sys?.n_strings}str` },
                      { label: "DC / AC", value: `${sys?.dc_ac_ratio?.toFixed(2) ?? "—"}`, sub: `${sys?.total_dc_kw} kWp / ${sys?.total_ac_kw} kW` },
                      { label: tr("Tier", "Verimlilik"), value: sys?.tier_label?.split("(")[0]?.trim() ?? "—", sub: sys?.module_efficiency_pct ? `${sys.module_efficiency_pct}%` : "" },
                      { label: tr("Tilt / Azimuth", "Eğim / Azimut"), value: `${sys?.surface_tilt_deg ?? "—"}°`, sub: sys?.surface_azimuth_deg === 180 ? t("estimate.southFacing") : t("estimate.northFacing") },
                    ].map((item) => (
                      <div key={item.label} className="bg-white/[0.02] rounded-lg px-3 py-2.5 border border-white/[0.04]">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wide">{item.label}</p>
                        <p className="text-base font-bold text-slate-200 mt-0.5">{item.value}</p>
                        {item.sub && <p className="text-[10px] text-slate-600">{item.sub}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SummaryCard
                    label={t("estimate.annualEnergy")}
                    value={annualKwh >= 1000 ? (annualKwh / 1000).toFixed(1) : annualKwh.toFixed(0)}
                    unit={annualKwh >= 1000 ? "MWh" : "kWh"}
                    sub={tr("per year (TMY)", "yıllık (TMY)")}
                    tooltip={t("estimate.ttTmy")}
                  />
                  <SummaryCard
                    label={t("estimate.specificYield")}
                    value={sum?.specific_yield_kwh_kwp?.toFixed(0) ?? "—"}
                    unit="kWh/kWp"
                    sub={tr("per kW installed", "kurulu kW başına")}
                    tooltip={t("estimate.ttSpecificYield")}
                  />
                  <SummaryCard
                    label={t("estimate.acCapacity")}
                    value={sys?.total_ac_kw?.toFixed(1) ?? "—"}
                    unit="kW"
                    sub={`${sys?.n_inverters ?? 1}× ${sys?.inverter_paco_kw ?? 5} kW`}
                  />
                  <SummaryCard
                    label={t("estimate.capacityFactor")}
                    value={sum?.capacity_factor_pct?.toFixed(1) ?? "—"}
                    unit="%"
                    sub={tr("Annual / (AC × 8760)", "yıllık / (AC × 8760)")}
                    tooltip={t("estimate.ttCapacityFactor")}
                  />
                </div>

                {/* Chart */}
                <EnergyDrillChart hourlyData={hourly} annualKwh={annualKwh} />

                {/* Full details — collapsible */}
                <div className="glass-card">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((o) => !o)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t("estimate.fullDetails")}
                    </h3>
                    {detailsOpen
                      ? <ChevronUp className="h-4 w-4 text-slate-500" />
                      : <ChevronDown className="h-4 w-4 text-slate-500" />
                    }
                  </button>

                  {detailsOpen && sys && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        ["Module", sys.module_name?.replace(/_/g, " ")],
                        [tr("Module Power (STC)", "Modül Gücü (STC)"), `${sys.module_stc_w} W`],
                        [tr("Module Efficiency", "Modül Verimliliği"), `${sys.module_efficiency_pct} %`],
                        [tr("Module Dimensions", "Modül Boyutları"), `${sys.module_dimensions_m} m`],
                        ["Inverter", sys.inverter_name?.replace(/_/g, " ")],
                        [tr("Inverter Rating", "İnvertör Gücü"), `${sys.inverter_paco_kw} kW AC`],
                        [tr("Panels", "Panel Sayısı"), sys.n_panels],
                        [tr("Modules / String", "String başına modül"), sys.modules_per_string],
                        [tr("Strings", "String sayısı"), sys.n_strings],
                        [tr("Inverters", "İnvertör sayısı"), sys.n_inverters],
                        [tr("Total DC", "DC Kapasite"), `${sys.total_dc_kw} kWp`],
                        [tr("Total AC", "AC Kapasite"), `${sys.total_ac_kw} kW`],
                        ["DC / AC", sys.dc_ac_ratio?.toFixed(2)],
                        [tr("Panel Area", "Panel Alanı"), `${sys.panel_area_m2} m²`],
                        [tr("Total Panel Area", "Toplam Panel Alanı"), `${sys.total_panel_area_m2} m²`],
                        [tr("Input Area", "Giriş Alanı"), `${sys.input_area_m2} m²`],
                        [tr("Tilt", "Eğim"), `${sys.surface_tilt_deg}°`],
                        [tr("Azimuth", "Azimut"), `${sys.surface_azimuth_deg}°`],
                        [tr("System Losses", "Sistem Kayıpları"), `${sum?.system_loss_pct ?? 16} %`],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex items-start justify-between gap-2 py-1.5 border-b border-white/[0.04]">
                          <span className="text-[11px] text-slate-500">{label}</span>
                          <span className="text-[11px] text-slate-300 font-medium text-right break-all max-w-[55%]">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer note */}
                <p className="text-[10px] text-slate-600 text-center">
                  {tr(
                    `Weather: PVGIS TMY · System losses: ${sum?.system_loss_pct ?? 16}% applied (soiling, wiring, mismatch).`,
                    `Hava: PVGIS TMY · Sistem kayıpları: ${sum?.system_loss_pct ?? 16}% uygulandı (kirlenme, kablo, uyumsuzluk).`,
                  )}
                </p>

                {/* Downloads */}
                <div className="glass-card mt-6">
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
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{`solarhesap_${lat.toFixed(4)}_${lng.toFixed(4)}.json`}</p>
                      </div>
                    </button>
                    <button type="button" onClick={downloadCSV}
                      className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.04] transition-all text-left">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10">
                        <Download className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{tr("Download CSV", "CSV İndir")}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{`solarhesap_${lat.toFixed(4)}_${lng.toFixed(4)}.csv`}</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* DC/AC warning (moved below downloads) */}
                {sys?.dc_ac_warning && sys.dc_ac_ratio !== undefined && (
                  <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs leading-relaxed mt-4">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {sys.dc_ac_ratio < 0.90
                        ? tr(
                            `DC/AC ratio is ${sys.dc_ac_ratio.toFixed(2)}. The system is significantly under-invertered. Note: This warning is based on auto-generated system assumptions. For detailed analysis and custom inverter sizing, please use the "Advanced Forecast" module.`,
                            `DC/AC oranı ${sys.dc_ac_ratio.toFixed(2)}. Sistem kayda değer ölçüde yetersiz invertörlü (büyük invertör seçilmiş). Not: Bu uyarı, otomatik oluşturulan sistem varsayımlarına dayanmaktadır. Daha detaylı analiz ve kendi invertörünüzü belirlemek için lütfen "Gelişmiş Tahmin" sayfasına gidin.`
                          )
                        : tr(
                            `DC/AC ratio is ${sys.dc_ac_ratio.toFixed(2)}. Significant clipping losses are expected during peak hours. Note: This warning is based on auto-generated system assumptions. For detailed analysis and custom inverter sizing, please use the "Advanced Forecast" module.`,
                            `DC/AC oranı ${sys.dc_ac_ratio.toFixed(2)}. Pik saatlerde önemli miktarda kırpma (clipping) kaybı bekleniyor. Not: Bu uyarı, otomatik oluşturulan sistem varsayımlarına dayanmaktadır. Daha detaylı analiz ve kendi invertörünüzü belirlemek için lütfen "Gelişmiş Tahmin" sayfasına gidin.`
                          )
                      }
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
