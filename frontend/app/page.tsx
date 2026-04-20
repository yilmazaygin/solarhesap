"use client";

import Link from "next/link";
import {
  Sun,
  Layers,
  Zap,
  Calculator,
  ArrowRight,
  Globe,
  BarChart3,
  Shield,
  BookOpen,
  GraduationCap,
  FlaskConical,
  ExternalLink,
} from "lucide-react";
import GlassCard from "@/components/shared/GlassCard";
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
      tags: [t("common.clearsky"), "Broadband", "INSTESRE"],
    },
    {
      title: "pvlib python: 2023 project update",
      description:
        "Anderson, K., Hansen, C., Holmgren, W., Jensen, A., Mikofski, M., and Driesse, A. Journal of Open Source Software, 8(92), 5994, (2023).",
      link: "https://doi.org/10.21105/joss.05994",
      linkText: "DOI: 10.21105/joss.05994",
      tags: ["Framework", "pvlib"],
    },
    {
      title: "pvlib iotools (2023)",
      description:
        "Jensen, A., Anderson, K., Holmgren, W., Mikofski, M., Hansen, C., Boeman, L., Loonen, R. Open-source Python functions for seamless access to solar irradiance data. Solar Energy, 266, 112092.",
      link: "https://doi.org/10.1016/j.solener.2023.112092",
      linkText: "DOI: 10.1016/j.solener.2023.112092",
      tags: ["Weather Data", "pvlib"],
    },
    {
      title: "PVGIS — European Commission JRC",
      description: (translations[language].home as any).references[1].desc,
      link: "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en",
      linkText: "Official JRC PVGIS Portal",
      tags: ["TMY", "POA", "SARAH2", "API"],
    },
    {
      title: "Open-Meteo — Zippenfenig (2023)",
      description: (translations[language].home as any).references[2].desc,
      link: "https://open-meteo.com/",
      linkText: "open-meteo.com",
      tags: ["Weather Data", "Archive"],
    },
  ];

  const METHODS = translations[language].home.methods;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-hero-glow opacity-60" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <div className="text-center animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-400/20 bg-amber-400/[0.06] text-amber-400 text-xs font-semibold mb-8">
              <Sun className="h-3 w-3" />
              {t("home.badge")}
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
              <span className="text-slate-100">{t("home.heroTitleLine1")}</span>
              <br />
              <span className="text-gradient-solar">{t("home.heroTitleLine2")}</span>
              <br />
              <span className="text-slate-300 text-3xl sm:text-5xl lg:text-6xl font-bold">
                {t("home.heroTitleLine3")}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t("home.heroSubtitle")}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/simulation" className="btn-primary text-base px-8 py-4 group" id="cta-simulation">
                <Zap className="h-5 w-5" />
                {t("home.ctaSimulation")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/calculation" className="btn-secondary text-base px-8 py-4" id="cta-calculation">
                <Calculator className="h-5 w-5" />
                {t("home.ctaCalculation")}
              </Link>
            </div>
          </div>

          {/* Animated solar system decoration */}
          <div className="absolute top-20 right-10 hidden xl:block opacity-30">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 animate-pulse-glow" />
              <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-spin-slow" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 animate-orbit" style={{ animationDelay: "0s" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative border-y border-white/[0.04] bg-surface-950/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: "6", label: t("home.stats.models"), icon: Layers },
              { value: "15", label: t("home.stats.tools"), icon: Calculator },
              { value: "4+", label: t("home.stats.strategies"), icon: BarChart3 },
              { value: "20y", label: t("home.stats.dataRange"), icon: Globe },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <Icon className="h-5 w-5 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl sm:text-3xl font-bold text-gradient-solar">
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              <span className="text-gradient-solar"> {language === "tr" ? "Güneş Analizi" : "Solar Analysis"} {language === "tr" ? "İçin Her Şey" : "Suite"}</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              {t("home.features.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <GlassCard className="animate-slide-up" id="feature-simulation">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 mb-4">
                <Sun className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">
                {t("home.features.feature1Title")}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t("home.features.feature1Desc")}
              </p>
              <Link
                href="/simulation"
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                {t("home.features.feature1Link")} <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>

            {/* Feature 2 */}
            <GlassCard className="animate-slide-up animate-delay-100" id="feature-modelchain">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400 mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">
                {t("home.features.feature2Title")}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t("home.features.feature2Desc")}
              </p>
              <Link
                href="/simulation"
                className="inline-flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {t("home.features.feature2Link")} <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>

            {/* Feature 3 */}
            <GlassCard className="animate-slide-up animate-delay-200" id="feature-tools">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-400/10 text-violet-400 mb-4">
                <Calculator className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">
                {t("home.features.feature3Title")}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t("home.features.feature3Desc")}
              </p>
              <Link
                href="/calculation"
                className="inline-flex items-center gap-1 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                {t("home.features.feature3Link")} <ArrowRight className="h-3 w-3" />
              </Link>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Validation Section */}
      <section className="relative border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {language === "tr" ? "Solarhesap" : "About"} <span className="text-gradient-solar">{language === "tr" ? "Hakkında" : "Solarhesap"}</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {t("home.about.subtitle")}
            </p>
          </div>

          {/* TÜBİTAK Section */}
          <div className="mb-16 animate-slide-up">
            <GlassCard>
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 flex-shrink-0">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-200 mb-2">
                    {t("home.about.tubitakTitle")}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    {t("home.about.tubitakDesc")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-2xl font-bold text-gradient-solar">6</p>
                      <p className="text-xs text-slate-500 mt-1">{t("home.stats.models")}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-2xl font-bold text-gradient-solar">15</p>
                      <p className="text-xs text-slate-500 mt-1">{t("home.stats.tools")}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-2xl font-bold text-gradient-solar">4+</p>
                      <p className="text-xs text-slate-500 mt-1">{t("home.stats.strategies")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Methodologies */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <FlaskConical className="h-5 w-5 text-amber-400" />
              <h3 className="text-xl font-bold text-slate-200">
                {t("home.about.methodologyTitle")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {METHODS.map((method: any, i: number) => (
                <GlassCard key={i} className="animate-slide-up">
                  <h4 className="text-sm font-bold text-amber-400 mb-2">
                    {method.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {method.desc}
                  </p>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Academic References */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="h-5 w-5 text-amber-400" />
              <h3 className="text-xl font-bold text-slate-200">
                {t("home.about.referencesTitle")}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REFERENCES.map((ref, i) => (
                <GlassCard key={i}>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">
                    {ref.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {ref.description}
                    {ref.link && (
                      <span className="block mt-1.5">
                        <a href={ref.link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          {ref.linkText || ref.link}
                        </a>
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {ref.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="animate-slide-up">
            <GlassCard>
              <h3 className="text-lg font-bold text-slate-200 mb-6">
                {t("home.about.techStackTitle")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {[
                  { name: "FastAPI", desc: "Backend API" },
                  { name: "pvlib", desc: "PV Modeling" },
                  { name: "Pydantic", desc: "Validation" },
                  { name: "Docker", desc: "Containerization" },
                  { name: "Next.js", desc: "Frontend" },
                  { name: "React Hook Form", desc: "Forms" },
                  { name: "Zod", desc: "Schema Validation" },
                  { name: "Recharts", desc: "Data Visualization" },
                  { name: "Leaflet", desc: "Maps" },
                  { name: "Tailwind CSS", desc: "Styling" },
                ].map((tech) => (
                  <div
                    key={tech.name}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center"
                  >
                    <p className="text-sm font-semibold text-slate-200">
                      {tech.name}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {tech.desc}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

        </div>
      </section>
    </div>
  );
}
