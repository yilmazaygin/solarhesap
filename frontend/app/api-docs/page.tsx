"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight, Zap, Wrench, Activity, BookOpen } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const BASE_URL = "https://solarhesap.net.tr/api/v1";

// ── Types ────────────────────────────────────────────────────────────────────

interface Field {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  desc_en: string;
  desc_tr: string;
}

interface Endpoint {
  method: "POST" | "GET";
  path: string;
  summary_en: string;
  summary_tr: string;
  desc_en: string;
  desc_tr: string;
  fields?: Field[];
  example?: object;
}

interface Category {
  id: string;
  label_en: string;
  label_tr: string;
  icon: React.ReactNode;
  endpoints: Endpoint[];
}

// ── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    id: "production",
    label_en: "Production Estimate",
    label_tr: "Üretim Tahmini",
    icon: <Zap className="h-4 w-4" />,
    endpoints: [
      {
        method: "POST",
        path: "/solar-simulation/basic-electric",
        summary_en: "Basic Electric Production Estimate",
        summary_tr: "Temel Elektrik Üretim Tahmini",
        desc_en: "Simple solar electricity estimate given location and available area. Auto-selects panel and inverter from the efficiency tier. Weather source is always PVGIS TMY.",
        desc_tr: "Konum ve kullanılabilir alana göre basit güneş enerjisi tahmini. Panel ve inverter, verimlilik kademesinden otomatik seçilir. Hava verisi kaynağı her zaman PVGIS TMY'dir.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude in decimal degrees (−90 to 90)", desc_tr: "Ondalık derece cinsinden enlem (−90 – 90)" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude in decimal degrees (−180 to 180)", desc_tr: "Ondalık derece cinsinden boylam (−180 – 180)" },
          { name: "elevation", type: "float", required: false, default: "0.0", desc_en: "Elevation above sea level in metres (0–8850)", desc_tr: "Deniz seviyesinden yükseklik (m)" },
          { name: "efficiency_tier", type: "string", required: true, desc_en: "Panel efficiency preset: very_low | low | medium | medium_high | high", desc_tr: "Panel verimlilik kademesi: very_low | low | medium | medium_high | high" },
          { name: "area_m2", type: "float", required: false, desc_en: "Total available area in m². Use this OR area_a + area_b", desc_tr: "Toplam kullanılabilir alan (m²). Ya bunu ya da area_a + area_b girin" },
          { name: "area_a", type: "float", required: false, desc_en: "Area dimension A in metres", desc_tr: "Alan boyutu A (metre)" },
          { name: "area_b", type: "float", required: false, desc_en: "Area dimension B in metres", desc_tr: "Alan boyutu B (metre)" },
          { name: "surface_tilt", type: "float", required: false, desc_en: "Panel tilt angle (°). Auto-calculated from latitude if omitted", desc_tr: "Panel eğim açısı (°). Boş bırakılırsa enlemden otomatik hesaplanır" },
          { name: "surface_azimuth", type: "float", required: false, desc_en: "Panel azimuth (° from North, 180=South)", desc_tr: "Panel azimut açısı (Kuzeyden °, 180=Güney)" },
        ],
        example: {
          latitude: 39.93,
          longitude: 32.86,
          elevation: 900,
          efficiency_tier: "medium",
          area_m2: 50,
          surface_tilt: 30,
          surface_azimuth: 180,
        },
      },
      {
        method: "POST",
        path: "/solar-simulation/historical/basic",
        summary_en: "Historical Basic Production Simulation",
        summary_tr: "Tarihsel Temel Üretim Simülasyonu",
        desc_en: "Simulate solar production for a specific historical year (2005–2022) using actual PVGIS hourly POA data instead of TMY. System layout is auto-configured from the efficiency tier.",
        desc_tr: "TMY yerine gerçek PVGIS saatlik POA verilerini kullanarak belirli bir tarihsel yıl (2005–2022) için güneş üretimini simüle eder. Sistem düzeni verimlilik kademesinden otomatik yapılandırılır.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude (−90 to 90)", desc_tr: "Enlem (−90 – 90)" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude (−180 to 180)", desc_tr: "Boylam (−180 – 180)" },
          { name: "elevation", type: "float", required: false, default: "0.0", desc_en: "Elevation in metres", desc_tr: "Yükseklik (m)" },
          { name: "year", type: "int", required: true, desc_en: "Calendar year for simulation (2005–2022)", desc_tr: "Simülasyon yılı (2005–2022)" },
          { name: "efficiency_tier", type: "string", required: true, desc_en: "Panel efficiency: very_low | low | medium | medium_high | high", desc_tr: "Panel verimi: very_low | low | medium | medium_high | high" },
          { name: "area_m2", type: "float", required: false, desc_en: "Total area in m² (or use area_a + area_b)", desc_tr: "Toplam alan m² (veya area_a + area_b)" },
          { name: "area_a", type: "float", required: false, desc_en: "Area dimension A (m)", desc_tr: "Alan boyutu A (m)" },
          { name: "area_b", type: "float", required: false, desc_en: "Area dimension B (m)", desc_tr: "Alan boyutu B (m)" },
        ],
        example: {
          latitude: 39.93,
          longitude: 32.86,
          elevation: 900,
          year: 2020,
          efficiency_tier: "medium",
          area_m2: 50,
        },
      },
      {
        method: "POST",
        path: "/solar-simulation/historical/advanced",
        summary_en: "Historical Advanced Production Simulation",
        summary_tr: "Tarihsel Gelişmiş Üretim Simülasyonu",
        desc_en: "Like historical/basic but accepts a full ModelChain configuration (module, inverter, DC/AC models) for higher accuracy. Weather is always PVGIS hourly POA for the chosen year.",
        desc_tr: "Tarihsel/temel gibi ancak daha yüksek doğruluk için tam ModelChain yapılandırmasını (modül, inverter, DC/AC modelleri) kabul eder. Hava her zaman seçilen yıl için PVGIS saatlik POA'dır.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude", desc_tr: "Enlem" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude", desc_tr: "Boylam" },
          { name: "elevation", type: "float", required: false, default: "0.0", desc_en: "Elevation in metres", desc_tr: "Yükseklik (m)" },
          { name: "year", type: "int", required: true, desc_en: "Historical year (2005–2022)", desc_tr: "Tarihsel yıl (2005–2022)" },
          { name: "use_arrays", type: "bool", required: false, default: "false", desc_en: "If true, use arrays[] instead of flat_system", desc_tr: "True ise flat_system yerine arrays[] kullanılır" },
          { name: "flat_system", type: "object", required: false, desc_en: "Flat system config (required if use_arrays=false)", desc_tr: "Düz sistem yapılandırması (use_arrays=false ise zorunlu)" },
          { name: "arrays", type: "array", required: false, desc_en: "Array configs (required if use_arrays=true)", desc_tr: "Dizi yapılandırmaları (use_arrays=true ise zorunlu)" },
          { name: "inverter", type: "object", required: true, desc_en: "Inverter configuration (source: database | manual)", desc_tr: "İnverter yapılandırması (source: database | manual)" },
          { name: "modelchain_config", type: "object", required: false, desc_en: "Optional ModelChain overrides (dc_model, ac_model, etc.)", desc_tr: "İsteğe bağlı ModelChain geçersiz kılmaları" },
        ],
        example: {
          latitude: 39.93,
          longitude: 32.86,
          year: 2020,
          use_arrays: false,
          flat_system: {
            surface_tilt: 30,
            surface_azimuth: 180,
            module: { source: "database", db_name: "CECMod", module_name: "Canadian_Solar_Inc__CS6K_275P" },
            temperature_model: { source: "lookup", model: "sapm", config: "open_rack_glass_glass" },
            modules_per_string: 10,
            strings_per_inverter: 2,
          },
          inverter: { source: "database", db_name: "CECInverter", inverter_name: "ABB__MICRO_0_25_I_OUTD_US_208__208V_" },
        },
      },
    ],
  },
  {
    id: "modelchain",
    label_en: "ModelChain & Irradiance",
    label_tr: "ModelChain & Işınım",
    icon: <Activity className="h-4 w-4" />,
    endpoints: [
      {
        method: "POST",
        path: "/solar-simulation/run-modelchain",
        summary_en: "Run PVLib ModelChain Simulation",
        summary_tr: "PVLib ModelChain Simülasyonu Çalıştır",
        desc_en: "Full PVLib ModelChain simulation. Generates clearsky weather data using the selected model, applies avg-year strategies, then runs a complete PV simulation. Returns hourly AC/DC power and energy summaries.",
        desc_tr: "Tam PVLib ModelChain simülasyonu. Seçilen modeli kullanarak açık gökyüzü hava verisi oluşturur, yıl ortalaması stratejilerini uygular ve tam PV simülasyonu çalıştırır.",
        fields: [
          { name: "location", type: "object", required: true, desc_en: "{ latitude, longitude, timezone?, altitude?, name? }", desc_tr: "{ latitude, longitude, timezone?, altitude?, name? }" },
          { name: "pvsystem", type: "object", required: true, desc_en: "PV system: surface_tilt, surface_azimuth, module_parameters, inverter_parameters, temperature_model_parameters, modules_per_string, strings_per_inverter", desc_tr: "PV sistemi: panel eğimi, azimut, modül parametreleri, inverter parametreleri vb." },
          { name: "modelchain_config", type: "object", required: false, desc_en: "DC/AC model overrides (dc_model, ac_model, aoi_model, spectral_model, losses_model)", desc_tr: "DC/AC model geçersiz kılmaları" },
          { name: "weather_source", type: "string", required: false, default: "ineichen", desc_en: "instesre_bird | ineichen | simplified_solis | pvlib_bird | pvgis_tmy | pvgis_poa", desc_tr: "Hava kaynağı: instesre_bird | ineichen | simplified_solis | pvlib_bird | pvgis_tmy | pvgis_poa" },
          { name: "start_year", type: "int", required: false, default: "2015", desc_en: "First year of analysis (2005–2025)", desc_tr: "Analizin başlangıç yılı" },
          { name: "end_year", type: "int", required: false, default: "2020", desc_en: "Last year of analysis (2005–2025)", desc_tr: "Analizin bitiş yılı" },
          { name: "timezone", type: "string", required: false, default: "UTC", desc_en: "IANA timezone string", desc_tr: "IANA saat dilimi" },
          { name: "avg_year_strategies", type: "string[]", required: false, default: '["combined"]', desc_en: "simple_mean | trimmed_mean | exponential_weighted | combined | super_avg_year | all", desc_tr: "Yıl ortalaması stratejileri" },
          { name: "decay", type: "float", required: false, default: "0.90", desc_en: "Exponential decay factor for exponential_weighted strategy (0–1)", desc_tr: "Üstel ağırlıklı strateji için azalma faktörü" },
        ],
        example: {
          location: { latitude: 39.93, longitude: 32.86 },
          pvsystem: {
            surface_tilt: 30,
            surface_azimuth: 180,
            module_parameters: { pdc0: 250, gamma_pdc: -0.004 },
            inverter_parameters: { pdc0: 5000, eta_inv_nom: 0.96 },
            temperature_model_parameters: { a: -3.56, b: -0.075, deltaT: 3 },
          },
          modelchain_config: { dc_model: "pvwatts", ac_model: "pvwatts", aoi_model: "no_loss", spectral_model: "no_loss" },
          weather_source: "pvgis_tmy",
        },
      },
      {
        method: "POST",
        path: "/solar-simulation/run-modelchain-advanced",
        summary_en: "Advanced PVLib ModelChain Simulation",
        summary_tr: "Gelişmiş PVLib ModelChain Simülasyonu",
        desc_en: "Advanced version with SAM database module/inverter selection, multi-array support, and full pvlib DC model options (cec, sapm, desoto, pvsyst, pvwatts) and AC models (pvwatts, sandia, adr).",
        desc_tr: "SAM veritabanından modül/inverter seçimi, çoklu dizi desteği ve tam pvlib DC/AC model seçenekleri (cec, sapm, desoto, pvsyst) ile gelişmiş sürüm.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude", desc_tr: "Enlem" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude", desc_tr: "Boylam" },
          { name: "elevation", type: "float", required: false, default: "0.0", desc_en: "Elevation in metres", desc_tr: "Yükseklik (m)" },
          { name: "weather_source", type: "string", required: false, default: "pvgis_tmy", desc_en: "Same options as run-modelchain", desc_tr: "run-modelchain ile aynı seçenekler" },
          { name: "use_arrays", type: "bool", required: false, default: "false", desc_en: "Multi-array mode: each array gets its own orientation and module params", desc_tr: "Çoklu dizi modu: her dizinin kendi yönelimi ve modül parametreleri vardır" },
          { name: "flat_system", type: "object", required: false, desc_en: "Classic single-system config (required if use_arrays=false)", desc_tr: "Klasik tek sistem yapılandırması" },
          { name: "arrays", type: "array", required: false, desc_en: "Array list (required if use_arrays=true)", desc_tr: "Dizi listesi (use_arrays=true ise zorunlu)" },
          { name: "inverter", type: "object", required: true, desc_en: "Inverter config: { source: 'database'|'manual', db_name?, inverter_name?, parameters? }", desc_tr: "İnverter yapılandırması" },
          { name: "modelchain_config", type: "object", required: false, desc_en: "ModelChain overrides", desc_tr: "ModelChain geçersiz kılmaları" },
          { name: "start_year / end_year", type: "int", required: false, default: "2015 / 2020", desc_en: "Analysis year range (ignored for pvgis_tmy)", desc_tr: "Analiz yıl aralığı (pvgis_tmy için yoksayılır)" },
        ],
        example: {
          latitude: 39.93,
          longitude: 32.86,
          weather_source: "pvgis_tmy",
          use_arrays: false,
          flat_system: {
            surface_tilt: 30,
            surface_azimuth: 180,
            module: { source: "database", db_name: "CECMod", module_name: "Canadian_Solar_Inc__CS6K_275P" },
            temperature_model: { source: "lookup", model: "sapm", config: "open_rack_glass_glass" },
            modules_per_string: 10,
            strings_per_inverter: 2,
          },
          inverter: { source: "database", db_name: "CECInverter", inverter_name: "ABB__MICRO_0_25_I_OUTD_US_208__208V_" },
          modelchain_config: { dc_model: "cec", ac_model: "sandia" },
        },
      },
      {
        method: "POST",
        path: "/solar-simulation/generate-irradiance",
        summary_en: "Generate Raw Irradiance Timeseries",
        summary_tr: "Ham Işınım Zaman Serisi Oluştur",
        desc_en: "Generate raw hourly irradiance data for a location and time range. No avg-year strategies — returns full timeseries. For PVGIS TMY, also includes simplified records keyed by day_of_year + hour.",
        desc_tr: "Bir konum ve zaman aralığı için ham saatlik ışınım verisi oluşturur. Yıl ortalaması stratejisi uygulanmaz, tam zaman serisi döndürülür.",
        fields: [
          { name: "model", type: "string", required: true, desc_en: "instesre_bird | ineichen | simplified_solis | pvlib_bird | pvgis_tmy | pvgis_poa", desc_tr: "Kullanılacak ışınım modeli" },
          { name: "latitude", type: "float", required: true, desc_en: "Latitude", desc_tr: "Enlem" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude", desc_tr: "Boylam" },
          { name: "elevation", type: "float", required: false, default: "0.0", desc_en: "Elevation in metres", desc_tr: "Yükseklik (m)" },
          { name: "timezone", type: "string", required: false, default: "UTC", desc_en: "IANA timezone", desc_tr: "IANA saat dilimi" },
          { name: "start_date", type: "string", required: false, desc_en: "ISO date YYYY-MM-DD (preferred over start_year)", desc_tr: "ISO tarih YYYY-MM-DD (start_year yerine tercih edilir)" },
          { name: "end_date", type: "string", required: false, desc_en: "ISO date YYYY-MM-DD", desc_tr: "ISO tarih YYYY-MM-DD" },
          { name: "start_year", type: "int", required: false, desc_en: "Start year fallback (2005–2025)", desc_tr: "Başlangıç yılı (yedek)" },
          { name: "end_year", type: "int", required: false, desc_en: "End year fallback (2005–2025)", desc_tr: "Bitiş yılı (yedek)" },
          { name: "surface_tilt", type: "float", required: false, default: "0.0", desc_en: "Panel tilt for PVGIS POA", desc_tr: "PVGIS POA için panel eğimi" },
          { name: "surface_azimuth", type: "float", required: false, default: "180.0", desc_en: "Panel azimuth for PVGIS POA", desc_tr: "PVGIS POA için panel azimut" },
        ],
        example: {
          model: "pvgis_tmy",
          latitude: 39.93,
          longitude: 32.86,
          elevation: 900,
          timezone: "Europe/Istanbul",
        },
      },
      {
        method: "POST",
        path: "/solar-simulation/pvgis-tmy",
        summary_en: "PVGIS Typical Meteorological Year",
        summary_tr: "PVGIS Tipik Meteorolojik Yıl",
        desc_en: "Fetch the PVGIS TMY for the given location. Already a representative year — no avg-year processing applied.",
        desc_tr: "Verilen konum için PVGIS TMY'sini getirir. Zaten temsili bir yıldır, ortalama yıl işlemi uygulanmaz.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude", desc_tr: "Enlem" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude", desc_tr: "Boylam" },
          { name: "elevation", type: "float", required: false, default: "0.0", desc_en: "Elevation in metres", desc_tr: "Yükseklik (m)" },
          { name: "startyear", type: "int", required: false, desc_en: "TMY calculation start year (optional)", desc_tr: "TMY hesaplama başlangıç yılı (isteğe bağlı)" },
          { name: "endyear", type: "int", required: false, desc_en: "TMY calculation end year (optional)", desc_tr: "TMY hesaplama bitiş yılı (isteğe bağlı)" },
          { name: "usehorizon", type: "bool", required: false, default: "true", desc_en: "Include horizon shading", desc_tr: "Ufuk gölgelemesini dahil et" },
        ],
        example: { latitude: 39.93, longitude: 32.86, elevation: 900, usehorizon: true },
      },
      {
        method: "POST",
        path: "/solar-simulation/pvgis-poa",
        summary_en: "PVGIS Hourly POA Irradiance",
        summary_tr: "PVGIS Saatlik POA Işınımı",
        desc_en: "Fetch multi-year PVGIS hourly POA data and apply avg-year strategies. SARAH2 data available 2005–2023.",
        desc_tr: "Çok yıllı PVGIS saatlik POA verisi getirir ve ortalama yıl stratejilerini uygular. SARAH2 verisi 2005–2023 için kullanılabilir.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude", desc_tr: "Enlem" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude", desc_tr: "Boylam" },
          { name: "start_year", type: "int", required: false, default: "2015", desc_en: "First year (2005–2023)", desc_tr: "Başlangıç yılı (2005–2023)" },
          { name: "end_year", type: "int", required: false, default: "2020", desc_en: "Last year (max 2023)", desc_tr: "Bitiş yılı (max 2023)" },
          { name: "surface_tilt", type: "float", required: false, default: "0.0", desc_en: "Panel tilt angle (°)", desc_tr: "Panel eğim açısı (°)" },
          { name: "surface_azimuth", type: "float", required: false, default: "180.0", desc_en: "Panel azimuth (0=N, 180=S)", desc_tr: "Panel azimut (0=K, 180=G)" },
          { name: "avg_year_strategies", type: "string[]", required: false, default: '["combined"]', desc_en: "Averaging strategies to apply", desc_tr: "Uygulanacak ortalama yıl stratejileri" },
        ],
        example: { latitude: 39.93, longitude: 32.86, start_year: 2015, end_year: 2022, surface_tilt: 30, surface_azimuth: 180, avg_year_strategies: ["combined"] },
      },
      {
        method: "POST",
        path: "/solar-simulation/deep-comparison",
        summary_en: "Deep Model Comparison",
        summary_tr: "Derin Model Karşılaştırması",
        desc_en: "Run all selected solar simulation models with all selected avg-year strategies and return a comparison matrix.",
        desc_tr: "Seçilen tüm güneş simülasyon modellerini tüm ortalama yıl stratejileriyle çalıştırır ve bir karşılaştırma matrisi döndürür.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude", desc_tr: "Enlem" },
          { name: "longitude", type: "float", required: true, desc_en: "Longitude", desc_tr: "Boylam" },
          { name: "start_year / end_year", type: "int", required: false, default: "2015 / 2020", desc_en: "Analysis range", desc_tr: "Analiz aralığı" },
          { name: "models", type: "string[]", required: false, default: '["instesre_bird","ineichen","simplified_solis","pvlib_bird"]', desc_en: "Models to include", desc_tr: "Dahil edilecek modeller" },
          { name: "include_pvgis_tmy", type: "bool", required: false, default: "true", desc_en: "Include PVGIS TMY in comparison", desc_tr: "Karşılaştırmaya PVGIS TMY'yi dahil et" },
          { name: "avg_year_strategies", type: "string[]", required: false, default: '["combined"]', desc_en: "Strategies to apply", desc_tr: "Uygulanacak stratejiler" },
        ],
        example: { latitude: 39.93, longitude: 32.86, start_year: 2015, end_year: 2020, models: ["instesre_bird", "ineichen", "pvlib_bird"], include_pvgis_tmy: true, avg_year_strategies: ["combined"] },
      },
    ],
  },
  {
    id: "clearsky",
    label_en: "Clear-Sky Models",
    label_tr: "Açık Gökyüzü Modelleri",
    icon: <BookOpen className="h-4 w-4" />,
    endpoints: [
      {
        method: "POST",
        path: "/solar-simulation/instesre-bird",
        summary_en: "INSTESRE Bird Clear Sky",
        summary_tr: "INSTESRE Bird Açık Gökyüzü",
        desc_en: "Compute INSTESRE Bird clearsky irradiance with OpenMeteo atmospheric data, then apply the selected avg-year strategies.",
        desc_tr: "OpenMeteo atmosferik verileriyle INSTESRE Bird açık gökyüzü ışınımını hesaplar ve seçilen ortalama yıl stratejilerini uygular.",
        fields: [
          { name: "latitude / longitude / elevation", type: "float", required: true, desc_en: "Location", desc_tr: "Konum" },
          { name: "start_year / end_year", type: "int", required: false, default: "2015 / 2020", desc_en: "Analysis range (2005–2025)", desc_tr: "Analiz aralığı" },
          { name: "avg_year_strategies", type: "string[]", required: false, default: '["combined"]', desc_en: "Averaging strategies", desc_tr: "Ortalama stratejileri" },
          { name: "ozone", type: "float", required: false, default: "0.3", desc_en: "Ozone column (atm-cm, 0–1)", desc_tr: "Ozon kolonu (atm-cm)" },
          { name: "aod500", type: "float", required: false, default: "0.1", desc_en: "Aerosol Optical Depth at 500 nm", desc_tr: "500 nm'de Aerosol Optik Derinliği" },
          { name: "aod380", type: "float", required: false, default: "0.15", desc_en: "Aerosol Optical Depth at 380 nm", desc_tr: "380 nm'de Aerosol Optik Derinliği" },
          { name: "albedo", type: "float", required: false, default: "0.2", desc_en: "Surface albedo (0–1)", desc_tr: "Yüzey albedosu (0–1)" },
        ],
        example: { latitude: 39.93, longitude: 32.86, start_year: 2015, end_year: 2020, avg_year_strategies: ["combined"], ozone: 0.3, aod500: 0.1, albedo: 0.2 },
      },
      {
        method: "POST",
        path: "/solar-simulation/pvlib-ineichen",
        summary_en: "pvlib Ineichen/Perez Clear Sky",
        summary_tr: "pvlib Ineichen/Perez Açık Gökyüzü",
        desc_en: "Compute Ineichen/Perez clearsky irradiance with auto-loaded Linke turbidity and OpenMeteo atmospheric data.",
        desc_tr: "Otomatik yüklenen Linke türbidite ve OpenMeteo atmosferik verileriyle Ineichen/Perez açık gökyüzü ışınımı hesaplar.",
        fields: [
          { name: "latitude / longitude / elevation", type: "float", required: true, desc_en: "Location", desc_tr: "Konum" },
          { name: "start_year / end_year", type: "int", required: false, default: "2015 / 2020", desc_en: "Analysis range", desc_tr: "Analiz aralığı" },
          { name: "avg_year_strategies", type: "string[]", required: false, default: '["combined"]', desc_en: "Averaging strategies", desc_tr: "Ortalama stratejileri" },
          { name: "timezone", type: "string", required: false, default: "UTC", desc_en: "IANA timezone", desc_tr: "IANA saat dilimi" },
        ],
        example: { latitude: 39.93, longitude: 32.86, start_year: 2015, end_year: 2020, timezone: "Europe/Istanbul" },
      },
      {
        method: "POST",
        path: "/solar-simulation/pvlib-solis",
        summary_en: "pvlib Simplified Solis Clear Sky",
        summary_tr: "pvlib Simplified Solis Açık Gökyüzü",
        desc_en: "Compute Simplified Solis clearsky irradiance with OpenMeteo atmospheric data.",
        desc_tr: "OpenMeteo atmosferik verileriyle Simplified Solis açık gökyüzü ışınımı hesaplar.",
        fields: [
          { name: "latitude / longitude / elevation", type: "float", required: true, desc_en: "Location", desc_tr: "Konum" },
          { name: "start_year / end_year", type: "int", required: false, default: "2015 / 2020", desc_en: "Analysis range", desc_tr: "Analiz aralığı" },
          { name: "aod700", type: "float", required: false, default: "0.1", desc_en: "AOD at 700 nm (0–0.45)", desc_tr: "700 nm'de AOD (0–0.45)" },
        ],
        example: { latitude: 39.93, longitude: 32.86, start_year: 2015, end_year: 2020, aod700: 0.1 },
      },
      {
        method: "POST",
        path: "/solar-simulation/pvlib-bird",
        summary_en: "pvlib Bird Clear Sky",
        summary_tr: "pvlib Bird Açık Gökyüzü",
        desc_en: "Compute pvlib Bird clearsky irradiance. Same Bird model as INSTESRE, pvlib implementation.",
        desc_tr: "pvlib Bird açık gökyüzü ışınımı hesaplar. INSTESRE ile aynı Bird modeli, pvlib uygulaması.",
        fields: [
          { name: "latitude / longitude / elevation", type: "float", required: true, desc_en: "Location", desc_tr: "Konum" },
          { name: "ozone / aod500 / aod380 / albedo", type: "float", required: false, desc_en: "Atmospheric parameters (same defaults as instesre-bird)", desc_tr: "Atmosferik parametreler (instesre-bird ile aynı varsayılanlar)" },
          { name: "asymmetry", type: "float", required: false, default: "0.85", desc_en: "Aerosol asymmetry factor (0–1)", desc_tr: "Aerosol asimetri faktörü (0–1)" },
        ],
        example: { latitude: 39.93, longitude: 32.86, start_year: 2015, end_year: 2020, ozone: 0.3, aod500: 0.1, asymmetry: 0.85 },
      },
    ],
  },
  {
    id: "tools",
    label_en: "Solar Tools",
    label_tr: "Güneş Araçları",
    icon: <Wrench className="h-4 w-4" />,
    endpoints: [
      {
        method: "POST",
        path: "/solar-tools/solar-position",
        summary_en: "Solar Position",
        summary_tr: "Güneş Konumu",
        desc_en: "Compute zenith, elevation, azimuth, declination, hour angle, equation of time, and Earth-Sun distance for a location and timestamp.",
        desc_tr: "Bir konum ve zaman damgası için zenit, yükseklik, azimut, sapma, saat açısı, zaman denklemi ve Dünya-Güneş mesafesini hesaplar.",
        fields: [
          { name: "latitude / longitude", type: "float", required: true, desc_en: "Location", desc_tr: "Konum" },
          { name: "year / month / day", type: "int", required: true, desc_en: "Date", desc_tr: "Tarih" },
          { name: "hour / minute / second", type: "int", required: false, default: "12 / 0 / 0", desc_en: "Time of day", desc_tr: "Gün saati" },
        ],
        example: { latitude: 39.93, longitude: 32.86, year: 2024, month: 6, day: 21, hour: 12 },
      },
      {
        method: "POST",
        path: "/solar-tools/sunrise-sunset",
        summary_en: "Sunrise / Sunset / Day Length",
        summary_tr: "Gündoğumu / Günbatımı / Gün Uzunluğu",
        desc_en: "Calculate sunrise, sunset, solar noon (UTC), and day length. Handles polar day and polar night.",
        desc_tr: "Gündoğumu, günbatımı, güneş öğlesini (UTC) ve gün uzunluğunu hesaplar. Kutup günü ve kutup gecesini destekler.",
        fields: [
          { name: "latitude / longitude", type: "float", required: true, desc_en: "Location", desc_tr: "Konum" },
          { name: "year / month / day", type: "int", required: true, desc_en: "Date", desc_tr: "Tarih" },
        ],
        example: { latitude: 39.93, longitude: 32.86, year: 2024, month: 6, day: 21 },
      },
      {
        method: "POST",
        path: "/solar-tools/optimal-tilt",
        summary_en: "Optimal Panel Tilt",
        summary_tr: "Optimal Panel Eğimi",
        desc_en: "Estimate optimal fixed panel tilt angles (annual, summer, winter) from latitude using empirical correlations.",
        desc_tr: "Ampirik korelasyonlar kullanarak enlemden optimum sabit panel eğim açılarını (yıllık, yaz, kış) tahmin eder.",
        fields: [
          { name: "latitude", type: "float", required: true, desc_en: "Latitude (−90 to 90)", desc_tr: "Enlem (−90 – 90)" },
        ],
        example: { latitude: 39.93 },
      },
      {
        method: "POST",
        path: "/solar-tools/airmass",
        summary_en: "Optical Air Mass",
        summary_tr: "Optik Hava Kütlesi",
        desc_en: "Calculate relative optical air mass from zenith angle. Models: Kasten-Young (default), Kasten, Simple.",
        desc_tr: "Zenit açısından göreli optik hava kütlesini hesaplar. Modeller: Kasten-Young (varsayılan), Kasten, Basit.",
        fields: [
          { name: "zenith_deg", type: "float", required: true, desc_en: "Solar zenith angle in degrees (0–180)", desc_tr: "Güneş zenit açısı (derece, 0–180)" },
          { name: "model", type: "string", required: false, default: "kastenyoung", desc_en: "kastenyoung | kasten | simple", desc_tr: "Kullanılacak model" },
        ],
        example: { zenith_deg: 45.0, model: "kastenyoung" },
      },
      {
        method: "POST",
        path: "/solar-tools/extraterrestrial",
        summary_en: "Extraterrestrial Irradiance",
        summary_tr: "Atmosfer Dışı Işınım",
        desc_en: "Calculate extraterrestrial normal irradiance (ETR) for a given date, accounting for Earth-Sun distance variation.",
        desc_tr: "Dünya-Güneş mesafe değişimini hesaba katarak belirli bir tarih için atmosfer dışı normal ışınımı (ETR) hesaplar.",
        fields: [
          { name: "year / month / day", type: "int", required: true, desc_en: "Date", desc_tr: "Tarih" },
        ],
        example: { year: 2024, month: 6, day: 21 },
      },
      {
        method: "POST",
        path: "/solar-tools/angle-of-incidence",
        summary_en: "Angle of Incidence",
        summary_tr: "Geliş Açısı",
        desc_en: "Calculate the angle of incidence of sunlight on a tilted panel.",
        desc_tr: "Eğik bir panel üzerindeki güneş ışığının geliş açısını hesaplar.",
        fields: [
          { name: "surface_tilt", type: "float", required: true, desc_en: "Panel tilt (°)", desc_tr: "Panel eğimi (°)" },
          { name: "surface_azimuth", type: "float", required: true, desc_en: "Panel azimuth (°)", desc_tr: "Panel azimut (°)" },
          { name: "solar_zenith", type: "float", required: true, desc_en: "Solar zenith angle (°)", desc_tr: "Güneş zenit açısı (°)" },
          { name: "solar_azimuth", type: "float", required: true, desc_en: "Solar azimuth angle (°)", desc_tr: "Güneş azimut açısı (°)" },
        ],
        example: { surface_tilt: 30, surface_azimuth: 180, solar_zenith: 30, solar_azimuth: 200 },
      },
      {
        method: "POST",
        path: "/solar-tools/poa-irradiance",
        summary_en: "POA Irradiance (Isotropic)",
        summary_tr: "POA Işınımı (İzotropik)",
        desc_en: "Calculate plane-of-array irradiance on a tilted surface using the isotropic sky model (Liu & Jordan).",
        desc_tr: "Liu & Jordan izotropik gökyüzü modeli kullanarak eğik bir yüzey üzerindeki düzlem ışınımını hesaplar.",
        fields: [
          { name: "surface_tilt", type: "float", required: true, desc_en: "Surface tilt (°)", desc_tr: "Yüzey eğimi (°)" },
          { name: "surface_azimuth", type: "float", required: true, desc_en: "Surface azimuth (°)", desc_tr: "Yüzey azimut (°)" },
          { name: "solar_zenith", type: "float", required: true, desc_en: "Solar zenith (°)", desc_tr: "Güneş zeniti (°)" },
          { name: "solar_azimuth", type: "float", required: true, desc_en: "Solar azimuth (°)", desc_tr: "Güneş azimut (°)" },
          { name: "ghi", type: "float", required: true, desc_en: "Global Horizontal Irradiance (W/m²)", desc_tr: "Yatay Global Işınım (W/m²)" },
          { name: "dhi", type: "float", required: true, desc_en: "Diffuse Horizontal Irradiance (W/m²)", desc_tr: "Yatay Diffüz Işınım (W/m²)" },
          { name: "dni", type: "float", required: true, desc_en: "Direct Normal Irradiance (W/m²)", desc_tr: "Direkt Normal Işınım (W/m²)" },
        ],
        example: { surface_tilt: 30, surface_azimuth: 180, solar_zenith: 30, solar_azimuth: 200, ghi: 800, dhi: 100, dni: 750 },
      },
      {
        method: "POST",
        path: "/solar-tools/erbs-decomposition",
        summary_en: "Erbs GHI Decomposition",
        summary_tr: "Erbs GHI Ayrıştırma",
        desc_en: "Decompose measured GHI into DNI and DHI using the Erbs (1982) model. Returns clearness index and diffuse fraction.",
        desc_tr: "Ölçülen GHI'yı Erbs (1982) modelini kullanarak DNI ve DHI'ya ayıştırır.",
        fields: [
          { name: "ghi", type: "float", required: true, desc_en: "Measured GHI (W/m²)", desc_tr: "Ölçülen GHI (W/m²)" },
          { name: "solar_zenith", type: "float", required: true, desc_en: "Solar zenith angle (°)", desc_tr: "Güneş zenit açısı (°)" },
          { name: "datetime_or_doy", type: "int", required: true, desc_en: "Day of year (1–366)", desc_tr: "Yılın günü (1–366)" },
        ],
        example: { ghi: 800, solar_zenith: 30, datetime_or_doy: 172 },
      },
      {
        method: "GET",
        path: "/solar-tools/list-sam-components",
        summary_en: "Search SAM Database Components",
        summary_tr: "SAM Veritabanı Bileşenlerini Ara",
        desc_en: "Search and list modules or inverters from SAM databases (CECMod, SandiaMod, CECInverter, SandiaInverter, ADRInverter) with key parameters.",
        desc_tr: "SAM veritabanlarından (CECMod, SandiaMod, CECInverter, SandiaInverter, ADRInverter) modül veya inverterleri temel parametrelerle arar ve listeler.",
        fields: [
          { name: "db", type: "string (query)", required: true, desc_en: "Database: CECMod | SandiaMod | CECInverter | SandiaInverter | ADRInverter", desc_tr: "Veritabanı seçimi" },
          { name: "search", type: "string (query)", required: false, desc_en: "Case-insensitive search string", desc_tr: "Büyük/küçük harf duyarsız arama terimi" },
          { name: "limit", type: "int (query)", required: false, default: "50", desc_en: "Max results (1–200)", desc_tr: "Maksimum sonuç sayısı (1–200)" },
          { name: "offset", type: "int (query)", required: false, default: "0", desc_en: "Pagination offset", desc_tr: "Sayfalama ofseti" },
        ],
        example: {},
      },
      {
        method: "GET",
        path: "/solar-tools/temperature-model-configs",
        summary_en: "List pvlib Temperature Model Configs",
        summary_tr: "pvlib Sıcaklık Model Yapılandırmaları",
        desc_en: "Return all available pvlib named temperature model configurations (sapm, pvsyst) for use with run-modelchain-advanced.",
        desc_tr: "run-modelchain-advanced ile kullanmak için mevcut tüm pvlib adlandırılmış sıcaklık modeli yapılandırmalarını döndürür.",
        fields: [],
        example: {},
      },
      {
        method: "GET",
        path: "/solar-tools/sam-component-detail",
        summary_en: "Get Full SAM Component Parameters",
        summary_tr: "Tam SAM Bileşen Parametrelerini Al",
        desc_en: "Retrieve all parameters for a specific module or inverter from a SAM database by exact name.",
        desc_tr: "Tam adıyla bir SAM veritabanındaki belirli bir modül veya inverter için tüm parametreleri getirir.",
        fields: [
          { name: "db", type: "string (query)", required: true, desc_en: "Database name", desc_tr: "Veritabanı adı" },
          { name: "name", type: "string (query)", required: true, desc_en: "Exact component name", desc_tr: "Tam bileşen adı" },
        ],
        example: {},
      },
    ],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: "POST" | "GET" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
      method === "GET"
        ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/20"
        : "bg-blue-400/15 text-blue-400 border border-blue-400/20"
    }`}>
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}

function EndpointCard({ ep, isTr }: { ep: Endpoint; isTr: boolean }) {
  const [open, setOpen] = useState(false);

  const curlExample = ep.method === "GET"
    ? `curl "${BASE_URL}${ep.path}?db=CECMod&search=canadian&limit=10"`
    : `curl -X POST "${BASE_URL}${ep.path}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(ep.example, null, 2)}'`;

  return (
    <div className="glass-card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <MethodBadge method={ep.method} />
        <code className="text-sm font-mono text-amber-300/90 flex-1 truncate">{ep.path}</code>
        <span className="text-xs text-slate-500 hidden sm:block flex-shrink-0">
          {isTr ? ep.summary_tr : ep.summary_en}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/[0.04] space-y-4">
          <p className="text-sm text-slate-400 mt-4 leading-relaxed">
            {isTr ? ep.desc_tr : ep.desc_en}
          </p>

          {ep.fields && ep.fields.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                {isTr ? "İstek Alanları" : "Request Fields"}
              </h4>
              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/[0.03] text-slate-400 border-b border-white/[0.06]">
                      <th className="px-3 py-2 text-left font-medium">{isTr ? "Alan" : "Field"}</th>
                      <th className="px-3 py-2 text-left font-medium">{isTr ? "Tip" : "Type"}</th>
                      <th className="px-3 py-2 text-left font-medium">{isTr ? "Zorunlu" : "Required"}</th>
                      <th className="px-3 py-2 text-left font-medium">{isTr ? "Varsayılan" : "Default"}</th>
                      <th className="px-3 py-2 text-left font-medium">{isTr ? "Açıklama" : "Description"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.fields.map((f, i) => (
                      <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 font-mono text-amber-300/80">{f.name}</td>
                        <td className="px-3 py-2 text-blue-300/70">{f.type}</td>
                        <td className="px-3 py-2">
                          {f.required
                            ? <span className="text-red-400 font-semibold">{isTr ? "Evet" : "Yes"}</span>
                            : <span className="text-slate-500">{isTr ? "Hayır" : "No"}</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">{f.default ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-400">{isTr ? f.desc_tr : f.desc_en}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ep.example && Object.keys(ep.example).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {isTr ? "Örnek İstek (curl)" : "Example Request (curl)"}
                </h4>
                <CopyButton text={curlExample} />
              </div>
              <pre className="bg-slate-950/60 border border-white/[0.06] rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all sm:break-normal">
                {curlExample}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const { language } = useLanguage();
  const isTr = language === "tr";
  const [activeCategory, setActiveCategory] = useState("production");

  const activeData = CATEGORIES.find((c) => c.id === activeCategory)!;

  const healthCurl = `curl "${BASE_URL}/health"`;

  return (
    <main className="min-h-screen page-bg">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── Hero ── */}
        <div className="glass-card space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-amber-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-100">
                {isTr ? "API Dokümantasyonu" : "API Documentation"}
              </h1>
              <p className="text-sm text-slate-400">
                {isTr
                  ? "Solarhesap REST API'si, güneş enerjisi simülasyonu ve hesaplama araçlarına programatik erişim sağlar."
                  : "The Solarhesap REST API provides programmatic access to solar energy simulation and calculation tools."}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <div className="flex-1 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                {isTr ? "Temel URL" : "Base URL"}
              </p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono text-amber-300">{BASE_URL}</code>
                <CopyButton text={BASE_URL} />
              </div>
            </div>
            <div className="sm:w-48 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                {isTr ? "İçerik Türü" : "Content-Type"}
              </p>
              <code className="text-sm font-mono text-blue-300">application/json</code>
            </div>
            <div className="sm:w-48 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                {isTr ? "Kimlik Doğrulama" : "Authentication"}
              </p>
              <span className="text-sm text-emerald-400 font-medium">
                {isTr ? "Gerekmiyor" : "None required"}
              </span>
            </div>
          </div>

          {/* Health check */}
          <div className="p-3 rounded-lg bg-emerald-400/[0.04] border border-emerald-400/[0.12]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">
                  {isTr ? "Sağlık Kontrolü" : "Health Check"}
                </span>
                <code className="text-xs font-mono text-slate-400">GET /health</code>
              </div>
              <CopyButton text={healthCurl} />
            </div>
            <pre className="text-xs font-mono text-slate-400">{healthCurl}</pre>
          </div>
        </div>

        {/* ── Category tabs ── */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeCategory === cat.id
                  ? "bg-amber-400 text-slate-900"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {cat.icon}
              {isTr ? cat.label_tr : cat.label_en}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeCategory === cat.id ? "bg-slate-900/30" : "bg-white/[0.08] text-slate-500"
              }`}>
                {cat.endpoints.length}
              </span>
            </button>
          ))}
        </div>

        {/* ── Endpoints ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
            {activeData.icon}
            {isTr ? activeData.label_tr : activeData.label_en}
            <span className="text-slate-600 font-normal">
              — {activeData.endpoints.length} {isTr ? "endpoint" : "endpoints"}
            </span>
          </h2>
          {activeData.endpoints.map((ep) => (
            <EndpointCard key={ep.path} ep={ep} isTr={isTr} />
          ))}
        </div>

        {/* ── Avg-year strategy reference ── */}
        <div className="glass-card space-y-3">
          <h3 className="text-sm font-bold text-slate-200">
            {isTr ? "Ortalama Yıl Stratejileri" : "Average-Year Strategies"}
          </h3>
          <p className="text-xs text-slate-400">
            {isTr
              ? "Çoklu yıl verisini tek bir temsili yıla indirgemek için kullanılır. avg_year_strategies alanını kabul eden tüm endpointlerde geçerlidir."
              : "Used to reduce multi-year data to a single representative year. Applies to all endpoints that accept avg_year_strategies."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: "simple_mean", en: "Arithmetic mean across years", tr: "Yıllar arası aritmetik ortalama" },
              { key: "trimmed_mean", en: "Mean with outlier years removed (uses lower/upper percentile)", tr: "Aykırı yıllar çıkarılmış ortalama (lower/upper percentile ile)" },
              { key: "exponential_weighted", en: "Exponential decay weighting — recent years count more (uses decay factor)", tr: "Üstel ağırlıklandırma — yakın yıllar daha fazla ağırlıklı (decay faktörü)" },
              { key: "combined", en: "Equal blend of the three base strategies (recommended)", tr: "Üç temel stratejinin eşit karışımı (önerilen)" },
              { key: "super_avg_year", en: "Weighted blend using per-month best-strategy selection", tr: "Aylık bazda en iyi strateji seçimi ile ağırlıklı karışım" },
              { key: "all", en: "Shorthand: expands to all 5 strategies above", tr: "Kısayol: yukarıdaki 5 stratejinin tamamına genişler" },
            ].map((s) => (
              <div key={s.key} className="flex gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <code className="text-[10px] font-mono text-amber-300/80 flex-shrink-0 w-36">{s.key}</code>
                <span className="text-xs text-slate-400">{isTr ? s.tr : s.en}</span>
              </div>
            ))}
          </div>
        </div>


      </div>
    </main>
  );
}
