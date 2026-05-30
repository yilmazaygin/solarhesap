"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  subMessage?: string;
}

export default function LoadingOverlay({
  visible,
  message,
  subMessage,
}: LoadingOverlayProps) {
  const { language } = useLanguage();
  const [msgIndex, setMsgIndex] = useState(0);

  const CYCLING_MESSAGES = language === "tr" ? [
    "Simülasyon Çalışıyor",
    "Meteorolojik Veriler Alınıyor",
    "Işınım Modelleri Koşturuluyor",
    "Ortalama Yıl Stratejileri Uygulanıyor",
    "Sonuçlar Analiz Ediliyor",
    "Çıktı Verileri Derleniyor",
  ] : [
    "Processing Simulation",
    "Fetching Meteorological Data",
    "Running Irradiance Models",
    "Applying Average-year Strategies",
    "Analyzing Results",
    "Compiling Output Data",
  ];

  const defaultSubMessage = language === "tr" 
    ? "Karmaşık hesaplamalar için bu işlem birkaç dakika sürebilir." 
    : "This may take up to a few minutes for complex calculations.";

  const finalSubMessage = subMessage || defaultSubMessage;

  useEffect(() => {
    if (!visible) {
      setMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % CYCLING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const displayMessage = message || CYCLING_MESSAGES[msgIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col items-center gap-6 p-8">
        {/* Solar spinner */}
        <div className="solar-spinner">
          <div className="orbit-ring">
            <div className="planet" />
          </div>
          <div className="sun" />
        </div>

        {/* Messages — dynamic cycling */}
        <div className="text-center">
          <p className="text-lg font-semibold text-white transition-opacity duration-500">
            {displayMessage}
          </p>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">{finalSubMessage}</p>
        </div>

        {/* Pulsing dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-amber-400"
              style={{
                animation: "pulseGlow 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
