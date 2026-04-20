import { Sun } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-auto" id="main-footer">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-slate-400">
              <span className="font-semibold text-slate-300">Solarhesap</span> v0.2
            </span>
          </div>
          <p className="text-xs text-slate-500 text-center">
            TÜBİTAK 2209-A — Üniversite Öğrencileri Araştırma Projeleri Destekleme Programı
          </p>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Solarhesap
          </p>
        </div>
      </div>
    </footer>
  );
}
