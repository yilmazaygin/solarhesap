"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sun, Menu, X, Globe } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/irradiance", label: language === "tr" ? "Irradiance" : "Irradiance" },
    { href: "/modelchain", label: "ModelChain" },
    { href: "/calculation", label: t("nav.calculation") },
  ];

  return (
    <nav className="glass-navbar" id="main-navbar">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group" id="navbar-logo">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-glow transition-shadow duration-300 group-hover:shadow-glow-lg">
              <Sun className="h-5 w-5 text-slate-900" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-solar">Solar</span>
              <span className="text-slate-300">hesap</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  id={`nav-${link.href.replace("/", "") || "home"}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-amber-400 bg-amber-400/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Language Switcher */}
            <div className="ml-2 pl-2 border-l border-white/[0.08] flex items-center gap-1">
               <button
                onClick={() => setLanguage(language === "en" ? "tr" : "en")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300"
                title="Dil Değiştir / Switch Language"
              >
                <Globe className="h-3.5 w-3.5 text-amber-400" />
                <span className="w-5 text-center">{language.toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === "en" ? "tr" : "en")}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors border border-white/[0.06]"
            >
              <span className="text-[10px] font-bold">{language.toUpperCase()}</span>
            </button>
            <button
              className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              id="mobile-menu-toggle"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 animate-fade-in">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-amber-400 bg-amber-400/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
