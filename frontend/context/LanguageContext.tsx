"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, TranslationKey, Language } from "../lib/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to 'tr' as per user request
  const [language, setLanguageState] = useState<Language>("tr");

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language;
    if (saved && (saved === "en" || saved === "tr")) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    document.documentElement.lang = lang;
  };

  const t = (path: TranslationKey): string => {
    const keys = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = translations[language];

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        console.warn(`Translation key not found: ${path} for language: ${language}`);
        return path;
      }
    }

    return typeof current === "string" ? current : path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
