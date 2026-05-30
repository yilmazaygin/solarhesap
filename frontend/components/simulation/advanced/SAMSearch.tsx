"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Database, Search, X } from "lucide-react";
import { searchSamComponents } from "@/lib/api";

interface SAMSearchProps {
  db: string;
  placeholder?: string;
  selectedName: string;
  selectedDisplay: string;
  onSelect: (name: string, display: string, entry: Record<string, unknown>) => void;
  onClear: () => void;
}

export default function SAMSearch({ db, placeholder, selectedName, selectedDisplay, onSelect, onClear }: SAMSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await searchSamComponents(db, q, 60);
      setResults((data as { results: Record<string, unknown>[] }).results || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [db]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  if (selectedName) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle-2)]">
        <Database className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{selectedDisplay || selectedName}</span>
        <button type="button" onClick={onClear} className="text-[var(--text-muted)] hover:text-red-400 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative z-10">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
          placeholder={placeholder || `Search in ${db}…`}
          className="input-field pl-9 text-sm"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-[9999] mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] shadow-2xl">
          {results.map((r) => {
            const name = r.name as string;
            const parts = name.split("_").join(" ").replace(/\s+/g, " ").trim();
            return (
              <button
                key={name}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-subtle)] transition-colors border-b border-[var(--border)] last:border-0"
                onClick={() => {
                  onSelect(name, parts, r);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                <p className="text-[var(--text-primary)] font-medium truncate">{parts}</p>
                <p className="text-[var(--text-muted)] mt-0.5">
                  {Object.entries(r)
                    .filter(([k]) => k !== "name")
                    .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : String(v)}`)
                    .join(" · ")}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
