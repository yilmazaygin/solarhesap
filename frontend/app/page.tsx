"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sun,
  Layers,
  Zap,
  ArrowRight,
  Shield,
  BookOpen,
  FlaskConical,
  ExternalLink,
  BarChart2,
  Github,
  CheckCircle,
  Code,
  Globe2,
  Database,
  Settings,
  ChevronDown
} from "lucide-react";
import GlassCard from "@/components/shared/GlassCard";
import SpaceBackground from "@/components/shared/SpaceBackground";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

export default function HomePage() {
  const { t, language } = useLanguage();
  const REFERENCES = [
    {
      title: "Bird & Hulstrom (1981)",
      description: (translations[language].home as any).references[0].desc,
      link: "https://instesre.org/Solar/BirdModelNew.htm",
      linkText: "instesre.org implementation notes",
    },
    {
      title: "pvlib-python (Anderson et al., 2023)",
      description:
        "Anderson K., Hansen C., Holmgren W., Jensen A., Mikofski M., Driesse A. — Journal of Open Source Software, 8(92), 5994. Also: Jensen A. et al., open-source Python functions for solar irradiance data access. Solar Energy, 266, 112092.",
      link: "https://doi.org/10.21105/joss.05994",
      linkText: "DOI: 10.21105/joss.05994",
    },
    {
      title: "PVGIS — European Commission JRC",
      description: (translations[language].home as any).references[1].desc,
      link: "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en",
      linkText: "Official JRC PVGIS Portal",
    },
    {
      title: "Open-Meteo — Zippenfenig (2023)",
      description: (translations[language].home as any).references[2].desc,
      link: "https://open-meteo.com/",
      linkText: "open-meteo.com",
    },
  ];

  const METHODS = translations[language].home.methods;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <SpaceBackground isGlobal={false} className="absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-hero-glow opacity-60" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-32 pb-5 sm:pt-36 sm:pb-16">
          <div className="text-center animate-fade-in">

            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6">
              <span>{t("home.heroTitleLine1")}</span>
              <br />
              <span>{t("home.heroTitleLine2")}</span>
              <br />
              <span className="text-slate-400 text-2xl sm:text-4xl lg:text-6xl font-bold">
                {t("home.heroTitleLine3")}
              </span>
            </h1>

            <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t("home.heroSubtitle")}
            </p>

            <div className="flex flex-col items-center justify-center gap-4 mt-4">
              <Link href="/estimate" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-lg font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] group relative overflow-hidden" id="cta-simulation">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Zap className="h-5 w-5 relative z-10" />
                <span className="relative z-10">{t("home.ctaSimulation")}</span>
                <ArrowRight className="h-5 w-5 relative z-10 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="https://github.com/yilmazaygin/solarhesap" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-100 text-sm font-bold transition-all duration-300 hover:bg-slate-300 dark:hover:bg-white/10 hover:text-black dark:hover:text-white hover:scale-105 group" id="cta-github">
                <Github className="h-4 w-4" />
                <span>GitHub</span>
                <ArrowRight className="h-4 w-4 transition-all group-hover:translate-x-1 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0" />
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-500 flex items-center justify-center gap-2">
              <Globe2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {language === "tr" ? "100% Özgür ve Açık Kaynaklı Yazılım (FOSS)" : "100% Free and Open Source Software (FOSS)"}
            </p>
          </div>

          {/* Top-right solar system */}
        <div className="absolute top-16 right-10 hidden xl:block opacity-40">
          <div className="relative w-40 h-40">
            {/* Outer faint ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-white/[0.04]" />
            {/* Orbit track */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] rounded-full border border-amber-400/20" />
            {/* Sun */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_0_30px_rgba(251,191,36,0.5)] animate-pulse-glow" />
            {/* Planet — positioned at center via calc so orbit animation doesn't conflict */}
            <div
              className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-orbit"
              style={{ top: "calc(50% - 6px)", left: "calc(50% - 6px)" }}
            />
          </div>
        </div>

        {/* Bottom-left — blue center, yellow (inner) + mars (outer) */}
        <div className="absolute bottom-12 left-10 hidden xl:block opacity-25">
          <div className="relative w-36 h-36">
            {/* Inner orbit track — radius 40px */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] h-[80px] rounded-full border border-amber-400/20" />
            {/* Outer orbit track — radius 70px */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full border border-orange-700/20" />
            {/* Blue center dot — 24×1.04=25px */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25px] h-[25px] rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.65)]" />
            {/* Yellow — 18×0.96=17px */}
            <div
              className="absolute w-[17px] h-[17px] rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-orbit-inner"
              style={{ top: "calc(50% - 8.5px)", left: "calc(50% - 8.5px)" }}
            />
            {/* Mars — 14×0.96=13px */}
            <div
              className="absolute w-[13px] h-[13px] rounded-full bg-orange-700 shadow-[0_0_8px_rgba(194,65,12,0.8)] animate-orbit-outer"
              style={{ top: "calc(50% - 6.5px)", left: "calc(50% - 6.5px)", animationDelay: "-6s" }}
            />
          </div>
        </div>
        </div>
      </section>

      {/* Capabilities Overview Section */}
      <section className="relative py-16 sm:py-24 border-t border-white/[0.04] bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {language === "tr" ? "Tam Kapsamlı ve Açık Kaynaklı Çözüm" : "Comprehensive & Open-Source Solution"}
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {language === "tr" 
                ? "SolarHesap, sadece basit bir hesaplayıcı değil; bilimsel temellere dayanan, şeffaf ve topluluk destekli bir simülasyon aracıdır." 
                : "SolarHesap is not just a basic calculator; it's a scientifically grounded, transparent, and community-driven simulation tool."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassCard className="flex flex-col items-center text-center p-6 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 animate-slide-up">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500 dark:text-amber-400 mb-4 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                <Globe2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold mb-3">{language === "tr" ? "Ücretsiz ve Şeffaf" : "Free & Transparent"}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {language === "tr" 
                  ? "Tamamen açık kaynaklıdır (MIT). Gizli maliyet yok, kara kutu algoritmalar yok. Kodun her satırı incelenebilir." 
                  : "Completely open-source (MIT). No hidden costs, no black-box algorithms. Every line of code is available."}
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col items-center text-center p-6 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 animate-slide-up animate-delay-100">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-600 dark:text-sky-400 mb-4 shadow-[0_0_20px_rgba(56,189,248,0.1)]">
                <Code className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold mb-3">{language === "tr" ? "API-İlk Yaklaşım" : "API-First Approach"}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {language === "tr" 
                  ? "Tüm hesaplama motoru, sınırlandırma olmadan herkesin kullanabileceği 100% açık REST API olarak çalışır." 
                  : "The entire calculation engine runs as a 100% open REST API, freely available for everyone to use without limits."}
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col items-center text-center p-6 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 animate-slide-up animate-delay-200">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-600 dark:text-violet-400 mb-4 shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                <Database className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold mb-3">{language === "tr" ? "Geniş Donanım Veritabanı" : "Extensive Hardware"}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {language === "tr" 
                  ? "SAM ve CEC veritabanlarında yer alan 20.000'den fazla güneş paneli ve invertör modeli sisteme entegredir." 
                  : "Over 20,000 solar module and inverter models from the SAM and CEC databases are integrated."}
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col items-center text-center p-6 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 animate-slide-up animate-delay-300">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <Settings className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold mb-3">{language === "tr" ? "Esnek Senaryolar" : "Flexible Scenarios"}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {language === "tr" 
                  ? "Basit çatı sistemlerinden karmaşık çoklu-dizi ticari sistemlere kadar geniş bir yelpazede konfigürasyon yapın." 
                  : "Configure a wide range of systems, from simple residential roofs to complex multi-array commercial setups."}
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Scientifically Validated Section */}
      <section className="relative overflow-hidden py-16 border-y border-slate-200 dark:border-white/[0.04] bg-slate-50/30 dark:bg-white/[0.01]">
        <SpaceBackground isGlobal={false} className="absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 z-10">
          <div className="flex flex-col items-center justify-center text-center animate-slide-up">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-slate-200/50 dark:bg-emerald-500/20 blur-xl rounded-full scale-150" />
              <Shield className="h-14 w-14 text-slate-800 dark:text-emerald-400 relative z-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-emerald-300 dark:to-emerald-500">
              {language === "tr" ? "Bilimsel Olarak Doğrulanmış" : "Scientifically Validated"}
            </h2>
            <p className="text-sm sm:text-base text-slate-400 dark:text-emerald-400/80 font-medium max-w-2xl mx-auto leading-relaxed">
              {language === "tr"
                ? "Tüm altyapı hakemli bilimsel yöntemlerle çalışır. Endüstri standardı modellerle sıfır kara kutu."
                : "All infrastructure runs on peer-reviewed scientific methods. Zero black boxes with industry-standard models."}
            </p>
          </div>
        </div>
      </section>

      {/* Advanced Modeling Section */}
      <section className="relative py-16 sm:py-24 bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {language === "tr" ? "Gelişmiş ModelChain Altyapısı" : "Advanced ModelChain Infrastructure"}
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {language === "tr" 
                ? "Sadece bir alan hesabı değil. Bileşen bazında, yüksek çözünürlüklü fiziksel FV simülasyonu." 
                : "Not just an area calculation. Component-level, high-fidelity physical PV simulation."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GlassCard className="flex flex-col items-center text-center p-6 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1">
              <h3 className="text-lg font-bold mb-3">{language === "tr" ? "DC ve AC Modelleri" : "DC & AC Models"}</h3>
              <p className="text-sm font-medium text-slate-400 leading-relaxed mb-4">
                 {language === "tr" ? "SAPM, CEC, PVWatts, Sandia ve ADR gibi saygın termodinamik ve elektriksel algoritmaları özgürce kombine edin." : "Freely combine respected thermodynamic and electrical algorithms like SAPM, CEC, PVWatts, Sandia, and ADR."}
              </p>
            </GlassCard>
            <GlassCard className="flex flex-col items-center text-center p-6 transition-all duration-300 hover:-translate-y-1 border-blue-500/30 dark:border-amber-500/30 bg-blue-500/[0.02] dark:bg-amber-500/[0.02] hover:bg-blue-500/[0.05] dark:hover:bg-amber-500/[0.05] shadow-[0_0_15px_rgba(59,130,246,0.15)] dark:shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <h3 className="text-lg font-bold mb-3">{language === "tr" ? "Manuel Bileşen (JSON)" : "Manual Component (JSON)"}</h3>
              <p className="text-sm font-medium text-slate-400 leading-relaxed mb-4">
                 {language === "tr" ? "Ticari yazılımlarda bile nadir görülen bir özellik: Veritabanında olmayan prototip panellerin I-V eğrisi ve termal katsayılarını JSON formatında doğrudan sisteme girin!" : "A rare feature even in commercial software: Inject the I-V curves and thermal coefficients of unreleased prototype panels directly into the system via JSON!"}
              </p>
            </GlassCard>
            <GlassCard className="flex flex-col items-center text-center p-6 hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-all duration-300 hover:-translate-y-1">
              <h3 className="text-lg font-bold mb-3">{language === "tr" ? "Fiziksel Kayıp Modelleri" : "Physical Loss Models"}</h3>
              <p className="text-sm font-medium text-slate-400 leading-relaxed mb-4">
                 {language === "tr" ? "Geliş açısına (AOI) bağlı optik kayıpları ve spektral değişimleri ASHRAE, Martin-Ruiz ve First Solar metotlarıyla milimetrik hesaplayın." : "Calculate Angle of Incidence (AOI) optical losses and spectral shifts down to the millimeter using ASHRAE, Martin-Ruiz, and First Solar methods."}
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* API Ecosystem Section */}
      <section className="relative py-16 sm:py-24 border-t border-white/[0.04] overflow-hidden">
        <SpaceBackground isGlobal={false} className="absolute inset-0 opacity-50" />
        {/* Ambient background glow for API section */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
           <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 animate-slide-right w-full">
                {/* Header */}
                <div className="text-center lg:text-left mb-6">
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center lg:text-left">
                    {language === "tr" ? "Özgür API Sistemi" : "Free API Ecosystem"}
                  </h2>
                </div>

                {/* Content */}
                <div>
                  <p className="text-lg text-slate-400 leading-relaxed mb-6 text-center lg:text-left">
                    {language === "tr" 
                      ? "Solarhesap sadece görsel bir arayüz değildir. Devasa hesaplama motorumuz, yetkilendirme (auth) veya ücret duvarı engeli olmadan, 100% açık REST API olarak hizmet verir." 
                      : "Solarhesap is not just a visual interface. Our massive calculation engine serves as a 100% open REST API with no authentication barriers or paywalls."}
                  </p>
                  <ul className="space-y-4 mb-8 mx-auto lg:mx-0 w-fit">
                    {[
                      language === "tr" ? "IoT ve Akıllı Ev Sistemleri Entegrasyonu" : "IoT and Smart Home Integration",
                      language === "tr" ? "Yapay Zeka (AI) ve Makine Öğrenmesi İçin Veri Sağlama" : "Data provider for AI and Machine Learning",
                      language === "tr" ? "Akıllı Şebeke (Smart Grid) Optimizasyonları" : "Smart Grid Optimizations"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start justify-start gap-3 text-slate-400">
                        <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-400/20 flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="font-medium text-left">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-center lg:justify-start">
                    <Link href="/api-docs" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                      <Code className="h-5 w-5" />
                      {language === "tr" ? "API Dokümantasyonunu İncele" : "Explore API Documentation"}
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Mock Code Block Container */}
              <div className="flex-1 w-full max-w-lg lg:max-w-none animate-slide-left group mt-8 lg:mt-0">
                 <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0f172a]/90 backdrop-blur-xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
                    {/* Mac-style Window Header */}
                    <div className="flex items-center px-4 py-3 bg-white/[0.04] border-b border-white/[0.05]">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <div className="ml-4 text-xs text-slate-400 font-mono tracking-wider">POST /api/v1/solar-simulation/run-modelchain</div>
                    </div>
                    {/* Code Content */}
                    <div className="p-5 sm:p-6 text-sm font-mono text-slate-300 overflow-x-auto">
                      <pre className="text-sky-300"><code>{`{
  "system": {
    "surface_tilt": 30,
    "surface_azimuth": 180,
    "dc_model": "cec",
    "ac_model": "sandia",
    "module_parameters": { ... },
    "inverter_parameters": { ... }
  },
  "weather": "pvgis-tmy"
}`}</code></pre>
                      <div className="mt-5 pt-5 border-t border-white/[0.05] text-emerald-400">
                        {`// Response: 8760 hourly AC power values (W)`}
                        <br/>
                        <span className="text-slate-400 block mt-2">{`"ac_power": [0, 0, 0, 120.4, 450.2, 890.1, 1024.5, ... ]`}</span>
                      </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </section>


      {/* About Section */}
      <section id="about" className="relative border-t border-slate-200 dark:border-white/[0.04] overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 z-10">

          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4">
              {language === "tr" ? "Solarhesap" : "About"}{" "}
              <span>{language === "tr" ? "Hakkında" : "Solarhesap"}</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {t("home.about.subtitle")}
            </p>
          </div>

          {/* Models & Algorithms paragraphs */}
          <div className="mb-10 sm:mb-16">
            <div className="max-w-4xl mx-auto space-y-6 text-center">
              {METHODS.map((method: any, i: number) => (
                <div key={i} className="animate-slide-up">
                  <h4 className="text-lg font-bold mb-1">{method.title}</h4>
                  <p className="text-base text-slate-400 leading-relaxed">{method.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech-stack" className="relative border-t border-slate-200 dark:border-white/[0.04] overflow-hidden">
        <SpaceBackground isGlobal={false} className="absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 z-10">
          
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {t("home.about.techStackTitle")}
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {language === "tr" 
                ? "Platformumuz, hız ve ölçeklenebilirlik için günümüzün en güçlü açık kaynaklı teknolojileri üzerine inşa edilmiştir." 
                : "Our platform is built upon today's most powerful open-source technologies for speed and scalability."}
            </p>
          </div>

          <div className="animate-slide-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: language === "tr" ? "Backend" : "Backend",
                  items: [
                    { name: "FastAPI", desc: language === "tr" ? "REST API çatısı" : "REST API framework" },
                    { name: "pvlib-python", desc: language === "tr" ? "PV & ışınım modelleme" : "PV & irradiance modeling" },
                    { name: "Pydantic v2", desc: language === "tr" ? "Veri doğrulama" : "Data validation" },
                    { name: "pandas / NumPy", desc: language === "tr" ? "Sayısal hesaplama" : "Numerical computation" },
                    { name: "Tenacity", desc: language === "tr" ? "Yeniden deneme mantığı" : "Retry logic" },
                  ],
                },
                {
                  title: language === "tr" ? "Frontend" : "Frontend",
                  items: [
                    { name: "Next.js 14", desc: language === "tr" ? "React uygulama çatısı" : "React application framework" },
                    { name: "Tailwind CSS", desc: language === "tr" ? "Stil sistemi" : "Utility-first styling" },
                    { name: "Recharts", desc: language === "tr" ? "Veri görselleştirme" : "Data visualization" },
                    { name: "Leaflet", desc: language === "tr" ? "İnteraktif harita" : "Interactive maps" },
                    { name: "Zod", desc: language === "tr" ? "Şema doğrulama" : "Schema validation" },
                  ],
                },
                {
                  title: language === "tr" ? "Altyapı" : "Infrastructure",
                  items: [
                    { name: "Docker", desc: language === "tr" ? "Konteynerleştirme" : "Containerization" },
                    { name: "Nginx", desc: language === "tr" ? "Ters proxy & hız sınırı" : "Reverse proxy & rate limiting" },
                    { name: "PVGIS API", desc: language === "tr" ? "JRC uydu verisi" : "JRC satellite data" },
                    { name: "Open-Meteo", desc: language === "tr" ? "Tarihsel hava verisi" : "Historical weather data" },
                    { name: "SAM / CEC DB", desc: language === "tr" ? "Modül & evirici veritabanı" : "Module & inverter database" },
                  ],
                },
              ].map((section) => (
                <GlassCard key={section.title} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.03]">
                  <h4 className="text-sm font-bold mb-3 text-center">{section.title}</h4>
                  <ul className="divide-y divide-slate-200 dark:divide-white/[0.04]">
                    {section.items.map((item) => (
                      <li key={item.name} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                        <span className="text-xs font-bold w-32 flex-shrink-0">{item.name}</span>
                        <span className="text-xs font-medium text-slate-400">{item.desc}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* References Section */}
      <section id="references" className="relative border-t border-slate-200 dark:border-white/[0.04] bg-white dark:bg-white/[0.01]">
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 z-10">
          <div className="animate-slide-up">
            <div className="flex items-center justify-center gap-3 mb-8">
              <BookOpen className="h-6 w-6 text-amber-500 dark:text-amber-400" />
              <h3 className="text-2xl font-bold">
                {language === "tr" ? "Kaynakça" : "References"}
              </h3>
            </div>
            <div className="max-w-4xl mx-auto text-left">
              <ul className="space-y-4 list-disc list-outside pl-6 text-slate-400 text-sm sm:text-base font-medium">
                {REFERENCES.map((ref, i) => (
                  <li key={i} className="leading-relaxed">
                    <strong className="font-bold text-slate-200">{ref.title}:</strong>{" "}
                    <span className="text-slate-400">{ref.description}</span>
                    {ref.link && (
                      <span className="inline-block ml-2">
                        <a href={ref.link} target="_blank" rel="noreferrer"
                          className="text-blue-700 dark:text-cyan-400 hover:text-blue-900 dark:hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition-colors font-bold">
                          <ExternalLink className="w-3 h-3" />
                          {ref.linkText || ref.link}
                        </a>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
