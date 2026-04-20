import { BookOpen, GraduationCap, FlaskConical, ExternalLink } from "lucide-react";
import GlassCard from "@/components/shared/GlassCard";

const REFERENCES = [
  {
    title: "Bird & Hulstrom (1981)",
    description:
      "Bird and Hulstrom's Solar Irradiance Model. A Simplified Clear Sky Model for Direct and Diffuse Insolation on Horizontal Surfaces. SERI/TR-642-761, Solar Energy Research Institute, Golden, Colorado, USA, February 1981.",
    link: "https://instesre.org/Solar/BirdModelNew.htm",
    linkText: "instesre.org implementation notes",
    tags: ["Clear-Sky", "Broadband", "INSTESRE"],
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
    title: "pvlib python (Historical, 2018)",
    description:
      "Holmgren, W., Hansen, C., and Mikofski, M. pvlib python: a python package for modeling solar energy systems. Journal of Open Source Software, 3(29), 884.",
    link: "https://doi.org/10.21105/joss.00884",
    linkText: "DOI: 10.21105/joss.00884",
    tags: ["Framework", "Historical"],
  },
  {
    title: "PVGIS — European Commission JRC",
    description:
      "Photovoltaic Geographical Information System. Raw solar projections derived from the Joint Research Centre API.",
    link: "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en",
    linkText: "Official JRC PVGIS Portal",
    tags: ["TMY", "POA", "SARAH2", "API"],
  },
  {
    title: "Open-Meteo — Zippenfenig (2023)",
    description:
      "Open-Meteo.com Weather API. Seamless historical dataset API serving boundary atmospheric datasets.",
    link: "https://open-meteo.com/",
    linkText: "open-meteo.com",
    tags: ["Weather Data", "Archive"],
  },
  {
    title: "Jean Meeus (1991)",
    description:
      "Astronomical Algorithms. Julian Day, Solar Position, Equation of Time, Earth-Sun distance calculations.",
    tags: ["Astronomy", "Solar Position"],
  },
  {
    title: "Spencer (1971)",
    description:
      "Fourier series representation of the position of the sun for solar declination calculations.",
    tags: ["Declination", "Fourier"],
  },
];

const METHODS = [
  {
    title: "INSTESRE Bird Model",
    description:
      "A foundational clear-sky model based on Bird & Hulstrom (1981). Computes GHI, DNI, and DHI using broadband aerosol transmissions, Rayleigh scattering, ozone absorption, and precipitable water dynamics.",
  },
  {
    title: "Ineichen/Perez Model",
    description:
      "Resolves accurate broadband optical thickness variations using climatological Linke Turbidity factor derivatives. Auto-loaded from pvlib's built-in database.",
  },
  {
    title: "Simplified Solis Model",
    description:
      "Fits atmospheric transmissivity to the sophisticated Solis spectral parameterization using AOD boundary conditions at 700nm.",
  },
  {
    title: "Average Year Pipeline",
    description:
      "Multi-year data is compressed using Simple Mean, Trimmed Mean (percentile cutoffs), Exponential Weighted Mean (recent bias), and Consensus algorithms to create idealized reference years.",
  },
  {
    title: "PVLib ModelChain",
    description:
      "End-to-end PV simulation pipeline: weather data → clear-sky irradiance → plane-of-array transposition → DC power → AC power output. Supports SAPM, CEC, PVWatts models.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-mesh">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12 animate-fade-in text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            About <span className="text-gradient-solar">Solarhesap</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            High-fidelity solar irradiance simulation engine — a TÜBİTAK 2209-A
            research project for advanced photovoltaic modeling.
          </p>
        </div>

        {/* TÜBİTAK Section */}
        <section className="mb-12 animate-slide-up">
          <GlassCard>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 flex-shrink-0">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-200 mb-2">
                  TÜBİTAK 2209-A Project
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Solarhesap is developed under the TÜBİTAK 2209-A University
                  Students Research Projects Support Program. The project aims to
                  create a comprehensive, scientifically validated solar simulation
                  platform that can serve as a foundation for commercial and academic
                  feasibility studies in Turkey&apos;s growing renewable energy sector.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-2xl font-bold text-gradient-solar">6</p>
                    <p className="text-xs text-slate-500 mt-1">Simulation Models</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-2xl font-bold text-gradient-solar">15</p>
                    <p className="text-xs text-slate-500 mt-1">Calculation Tools</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-2xl font-bold text-gradient-solar">4+</p>
                    <p className="text-xs text-slate-500 mt-1">Avg-Year Strategies</p>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Methodologies */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <FlaskConical className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold text-slate-200">
              Solar Calculation Methodologies
            </h2>
          </div>
          <div className="space-y-4">
            {METHODS.map((method, i) => (
              <GlassCard
                key={i}
                className="animate-slide-up"
              >
                <h3 className="text-sm font-bold text-amber-400 mb-2">
                  {method.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {method.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Academic References */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold text-slate-200">
              Academic References
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REFERENCES.map((ref, i) => (
              <GlassCard key={i}>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  {ref.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {ref.description}
                  {/* @ts-ignore */}
                  {ref.link && (
                    <span className="block mt-1.5">
                      {/* @ts-ignore */}
                      <a href={ref.link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                        {/* @ts-ignore */}
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
        </section>

        {/* Tech Stack */}
        <section className="animate-slide-up">
          <GlassCard>
            <h2 className="text-lg font-bold text-slate-200 mb-4">
              Technology Stack
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        </section>
      </div>
    </div>
  );
}
