"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Sun, Moon, Menu, X, Globe, BookOpen, ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileAdvancedOpen, setMobileAdvancedOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mainLinks = [
    { href: "/estimate", label: language === "tr" ? "Üretim Tahmini" : "Production Estimate" },
    { href: "/comparison", label: language === "tr" ? "Model Kıyası" : "Model Comparison" },
    { href: "/historical", label: language === "tr" ? "Tarihsel & Kıyas" : "Historical & Comparison" },
  ];

  const advancedLinks = [
    { href: "/irradiance", label: language === "tr" ? "Işınım Üretici" : "Irradiance Generator" },
    { href: "/irradiance-comparison", label: language === "tr" ? "Işınım Kıyası" : "Irradiance Comparison" },
    { href: "/modelchain", label: language === "tr" ? "Gelişmiş Tahmin" : "Advanced Forecast" },
    { href: "/calculation", label: t("nav.calculation") },
    { href: "/api-docs", label: language === "tr" ? "API" : "API", icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  const linkBase = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200";
  const linkActive = "text-amber-400 bg-amber-400/10";
  const linkInactive = "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]";
  const dropdownActive = "text-amber-400 bg-amber-400/10";
  const dropdownInactive = "text-slate-300 hover:text-amber-400 hover:bg-white/[0.06]";

  const iconBtn =
    "flex items-center justify-center h-9 px-2.5 rounded-lg transition-all duration-200 " +
    "text-slate-400 hover:text-slate-200 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06]";

  const iconBtnSmall =
    "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 " +
    "text-slate-400 hover:text-slate-200 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06]";

  const isAdvancedActive = advancedLinks.some(link => pathname === link.href);

  return (
    <nav className="glass-navbar" id="main-navbar" ref={navRef}>
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
            {mainLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  id={`nav-${link.href.replace("/", "") || "home"}`}
                  className={`${linkBase} ${isActive ? linkActive : linkInactive} flex items-center gap-1.5`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Advanced Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`${linkBase} ${isAdvancedActive ? linkActive : linkInactive} flex items-center gap-1.5`}
              >
                {language === "tr" ? "Gelişmiş" : "Advanced"}
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-white/[0.08] bg-slate-900/95 backdrop-blur-xl shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-0.5">
                    {advancedLinks.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setDropdownOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? dropdownActive : dropdownInactive
                          }`}
                        >
                          {"icon" in link && link.icon}
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="ml-2 pl-2 border-l border-white/[0.08] flex items-center gap-1.5">
              {/* Language toggle */}
              <button
                onClick={() => setLanguage(language === "en" ? "tr" : "en")}
                className={iconBtn}
                title="Dil Değiştir / Switch Language"
              >
                <Globe className="h-3.5 w-3.5 text-amber-400 mx-1" />
                <span className="text-[11px] font-bold pr-0.5">{language === "en" ? "TR" : "EN"}</span>
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={iconBtnSmall}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {theme === "dark"
                  ? <Sun className="h-4 w-4 text-amber-400" />
                  : <Moon className="h-4 w-4 text-slate-500" />
                }
              </button>
            </div>
          </div>

          {/* Mobile controls */}
          <div className="md:hidden flex items-center gap-2">
            {/* Language */}
            <button
              onClick={() => setLanguage(language === "en" ? "tr" : "en")}
              className={iconBtn}
            >
              <Globe className="h-3.5 w-3.5 text-amber-400 mx-1" />
              <span className="text-[10px] font-bold pr-0.5">{language === "en" ? "TR" : "EN"}</span>
            </button>

            {/* Theme */}
            <button
              onClick={toggleTheme}
              className={iconBtnSmall}
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? <Sun className="h-4 w-4 text-amber-400" />
                : <Moon className="h-4 w-4 text-slate-500" />
              }
            </button>

            {/* Hamburger */}
            <button
              className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
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
              {mainLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? linkActive : linkInactive
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              
              <div className="h-px bg-white/[0.06] my-1" />
              <button 
                onClick={() => setMobileAdvancedOpen(!mobileAdvancedOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isAdvancedActive || mobileAdvancedOpen ? linkActive : linkInactive
                }`}
              >
                <span>{language === "tr" ? "Gelişmiş" : "Advanced"}</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${mobileAdvancedOpen ? "rotate-180" : ""}`} />
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${mobileAdvancedOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="flex flex-col gap-1 mt-1">
                  {advancedLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => {
                          setMobileOpen(false);
                          setMobileAdvancedOpen(false); // also reset drawer state on close
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 ml-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive ? linkActive : linkInactive
                        }`}
                      >
                        {"icon" in link && link.icon}
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
