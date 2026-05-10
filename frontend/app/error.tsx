"use client";

import { useEffect } from "react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-400/10 border border-red-400/20">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-200 mb-3">Something went wrong</h1>
        <p className="text-slate-500 text-sm mb-2">
          An unexpected error occurred. You can try again or go back to the home page.
        </p>
        {error.digest && (
          <p className="text-[11px] text-slate-700 font-mono mb-6">Error ID: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.1] text-slate-300 font-medium text-sm hover:border-white/[0.2] hover:text-white transition-colors"
          >
            <Home className="h-4 w-4" />
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
