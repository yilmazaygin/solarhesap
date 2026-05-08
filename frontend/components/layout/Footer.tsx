"use client";

import { Sun, Linkedin, Globe, Github } from "lucide-react";

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

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-auto" id="main-footer">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Mobile layout */}
        <div className="sm:hidden flex flex-col items-center gap-6">
          {/* Brand + GitHub */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-slate-200">Solarhesap</span>
              <span className="text-xs text-slate-500">v0.2</span>
            </div>
            <a href="https://github.com/yilmaygin/solarhesap"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
          </div>

          {/* Team row */}
          <div className="w-full flex items-start justify-between">
            {/* Eray — left */}
            <div className="flex flex-col items-start gap-1.5">
              <p className="text-sm font-semibold text-slate-300">{TEAM[0].name}</p>
              <div className="flex items-center gap-3">
                <a href={TEAM[0].linkedin} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </a>
                <a href={TEAM[0].website} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                  <Globe className="h-3.5 w-3.5" /> Web
                </a>
              </div>
            </div>

            {/* Aygın — right */}
            <div className="flex flex-col items-end gap-1.5">
              <p className="text-sm font-semibold text-slate-300">{TEAM[1].name}</p>
              <div className="flex items-center gap-3">
                <a href={TEAM[1].linkedin} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </a>
                <a href={TEAM[1].website} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                  <Globe className="h-3.5 w-3.5" /> Web
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop layout (sm+) */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-8 items-start">

          {/* Left — Yılmaz Eray */}
          <div className="flex flex-col items-start gap-1.5">
            <p className="text-sm font-semibold text-slate-300">{TEAM[0].name}</p>
            <div className="flex items-center gap-3 mt-1">
              <a href={TEAM[0].linkedin} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
              </a>
              <a href={TEAM[0].website} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                <Globe className="h-3.5 w-3.5" /> Web
              </a>
            </div>
          </div>

          {/* Center — Brand + GitHub */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-slate-200">Solarhesap</span>
              <span className="text-xs text-slate-500">v0.2</span>
            </div>
            <a href="https://github.com/yilmaygin/solarhesap"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mt-1">
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
          </div>

          {/* Right — Yılmaz Aygın */}
          <div className="flex flex-col items-end gap-1.5">
            <p className="text-sm font-semibold text-slate-300">{TEAM[1].name}</p>
            <div className="flex items-center gap-3 mt-1">
              <a href={TEAM[1].linkedin} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
              </a>
              <a href={TEAM[1].website} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                <Globe className="h-3.5 w-3.5" /> Web
              </a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
