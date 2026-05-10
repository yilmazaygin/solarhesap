"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative inline-block mb-6">
          <p className="text-[120px] font-black text-slate-800 leading-none select-none">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="h-14 w-14 text-amber-400/40" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-200 mb-3">Page not found</h1>
        <p className="text-slate-500 text-sm mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
