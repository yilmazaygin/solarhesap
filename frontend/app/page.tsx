"use client";

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
  Linkedin,
  Globe,
} from "lucide-react";
import GlassCard from "@/components/shared/GlassCard";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

const TEAM = [
  {
    name: "Yılmaz Eray",
    linkedin: "https://linkedin.com/in/yilmaz-eray",
    website: "#",
  },
  {
    name: "Yılmaz Aygın",
    linkedin: "https://linkedin.com/in/yilmaz-aygin",
    website: "#",
  },
];

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
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-hero-glow opacity-60" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 pb-10 sm:pt-28 sm:pb-32">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-400/20 bg-amber-400/[0.06] text-amber-400 text-xs font-semibold mb-8">
              <Sun className="h-3 w-3" />
              {t("home.badge")}
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6">
              <span className="text-slate-100">{t("home.heroTitleLine1")}</span>
              <br />
              <span className="text-gradient-solar">{t("home.heroTitleLine2")}</span>
              <br />
              <span className="text-slate-300 text-2xl sm:text-4xl lg:text-6xl font-bold">
                {t("home.heroTitleLine3")}
              </span>
            </h1>

            <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t("home.heroSubtitle")}
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:gap-3">
              <Link href="/simulation" className="btn-primary text-lg px-10 py-4 group" id="cta-simulation">
                <Zap className="h-5 w-5" />
                {t("home.ctaSimulation")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/calculation" className="btn-secondary text-sm px-6 py-3" id="cta-calculation">
                {t("home.ctaCalculation")}
              </Link>
            </div>
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

      {/* Team Bar */}
      <section className="relative border-y border-white/[0.04] bg-surface-950/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-0">

            {/* Yılmaz Eray — mobile: name top, links below; desktop: [Web][LinkedIn] Name */}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 animate-slide-up">
              <p className="text-xl sm:text-2xl font-bold text-slate-100 order-first sm:order-last">{TEAM[0].name}</p>
              <div className="flex items-center gap-3 order-last sm:order-first">
                <a href={TEAM[0].website} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors">
                  <Globe className="h-4 w-4" /> Web
                </a>
                <a href={TEAM[0].linkedin} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
              </div>
            </div>

            {/* Divider — horizontal on mobile, vertical on desktop */}
            <div className="w-16 h-px sm:w-px sm:h-14 bg-white/[0.08] sm:mx-8" />

            {/* Yılmaz Aygın — mobile: name top, links below; desktop: Name [LinkedIn][Web] */}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 animate-slide-up" style={{ animationDelay: "120ms" }}>
              <p className="text-xl sm:text-2xl font-bold text-slate-100">{TEAM[1].name}</p>
              <div className="flex items-center gap-3">
                <a href={TEAM[1].linkedin} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
                <a href={TEAM[1].website} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors">
                  <Globe className="h-4 w-4" /> Web
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              <span className="text-gradient-solar">
                {language === "tr" ? "Güneş Analizi İçin Her Şey" : "Everything for Solar Analysis"}
              </span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              {t("home.features.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 — Clear-Sky Models */}
            <GlassCard className="animate-slide-up flex flex-col items-center text-center" id="feature-simulation">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 mb-4">
                <Sun className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">
                {t("home.features.feature1Title")}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t("home.features.feature1Desc")}
              </p>
              <Link href="/simulation"
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                {t("home.features.feature1Link")} <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>

            {/* Feature 2 — PV System Simulation */}
            <GlassCard className="animate-slide-up animate-delay-100 flex flex-col items-center text-center" id="feature-modelchain">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400 mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">
                {t("home.features.feature2Title")}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t("home.features.feature2Desc")}
              </p>
              <Link href="/modelchain"
                className="inline-flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                {t("home.features.feature2Link")} <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>

            {/* Feature 3 — Historical Production & Comparison */}
            <GlassCard className="animate-slide-up animate-delay-200 flex flex-col items-center text-center" id="feature-historical">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-400/10 text-violet-400 mb-4">
                <BarChart2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">
                {t("home.features.feature3Title")}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t("home.features.feature3Desc")}
              </p>
              <Link href="/historical"
                className="inline-flex items-center gap-1 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">
                {t("home.features.feature3Link")} <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Validation Section */}
      <section className="relative border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-20">
          <GlassCard className="animate-slide-up">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400 flex-shrink-0">
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200 mb-2">
                  {t("home.validation.title")}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {t("home.validation.desc")}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">

          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4">
              {language === "tr" ? "Solarhesap" : "About"}{" "}
              <span className="text-gradient-solar">{language === "tr" ? "Hakkında" : "Solarhesap"}</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {t("home.about.subtitle")}
            </p>
          </div>

          {/* Models & Algorithms — centered heading */}
          <div className="mb-10 sm:mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <FlaskConical className="h-5 w-5 text-amber-400" />
              <h3 className="text-xl font-bold text-slate-200">
                {t("home.about.methodologyTitle")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {METHODS.map((method: any, i: number) => (
                <GlassCard key={i} className="animate-slide-up text-center">
                  <h4 className="text-sm font-bold text-amber-400 mb-2">{method.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{method.desc}</p>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Academic References — centered heading */}
          <div className="mb-10 sm:mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <BookOpen className="h-5 w-5 text-amber-400" />
              <h3 className="text-xl font-bold text-slate-200">
                {t("home.about.referencesTitle")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REFERENCES.map((ref, i) => (
                <GlassCard key={i} className="text-center">
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">{ref.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {ref.description}
                    {ref.link && (
                      <span className="block mt-1.5">
                        <a href={ref.link} target="_blank" rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          {ref.linkText || ref.link}
                        </a>
                      </span>
                    )}
                  </p>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Tech Stack — same card format as Methods & References */}
          <div className="animate-slide-up">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Layers className="h-5 w-5 text-amber-400" />
              <h3 className="text-xl font-bold text-slate-200">
                {t("home.about.techStackTitle")}
              </h3>
            </div>
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
                <GlassCard key={section.title}>
                  <h4 className="text-sm font-bold text-amber-400 mb-3 text-center">{section.title}</h4>
                  <ul className="divide-y divide-white/[0.04]">
                    {section.items.map((item) => (
                      <li key={item.name} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                        <span className="text-xs font-semibold text-slate-200 w-32 flex-shrink-0">{item.name}</span>
                        <span className="text-xs text-slate-500">{item.desc}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              ))}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
