"use client";
import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  text: string;
  width?: number;
  align?: "center" | "left" | "right";
}

export function InfoTooltip({ text, width = 220, align = "center" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const xClass =
    align === "left" ? "left-0 translate-x-0" :
    align === "right" ? "right-0 translate-x-0" :
    "left-1/2 -translate-x-1/2";

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.07] text-[10px] font-bold text-slate-500 hover:bg-white/[0.15] hover:text-slate-300 transition-colors"
        aria-label="More info"
      >
        ?
      </button>
      {open && (
        <span
          style={{
            width: `${width}px`,
            background: "var(--tooltip-bg)",
            borderColor: "var(--tooltip-border)",
            color: "var(--tooltip-text)",
          }}
          className={`absolute bottom-full ${xClass} mb-2 px-3 py-2 rounded-xl border backdrop-blur-xl text-xs leading-relaxed shadow-xl z-50 pointer-events-none`}
        >
          {text}
          {/* Arrow */}
          <span
            style={{ borderTopColor: "var(--tooltip-bg)" }}
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
          />
        </span>
      )}
    </span>
  );
}
