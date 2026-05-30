"use client";

import { Sun, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="glass-footer mt-auto relative z-10" id="main-footer">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-bold text-slate-200">Solarhesap</span>
            <span className="text-xs text-slate-500">v0.3</span>
          </div>
          <a
            href="https://github.com/yilmazaygin/solarhesap"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-slate-100 transition-colors"
          >
            <Github className="h-3.5 w-3.5" /> GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
