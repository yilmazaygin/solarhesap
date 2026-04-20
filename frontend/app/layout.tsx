import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata: Metadata = {
  title: "Solarhesap — High-Fidelity Solar Simulation Engine",
  description:
    "Advanced solar irradiance modeling, multi-model data orchestration, and photovoltaic simulations. A TÜBİTAK 2209 project.",
  keywords: [
    "solar simulation",
    "PV modeling",
    "irradiance",
    "PVGIS",
    "pvlib",
    "Bird model",
    "TÜBİTAK",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen flex flex-col">
        <LanguageProvider>
          <Navbar />
          <main className="flex-1 pt-20">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
