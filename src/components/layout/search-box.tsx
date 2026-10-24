"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

interface Hit {
  id: string;
  name: string;
}

export function SearchBox() {
  const router = useRouter();
  const { t } = useLanguage();
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await supabase.rpc("search_products", {
          search_term: term,
          result_limit: 8,
        });
        setResults(
          (data ?? []).map((p: { id: string; canonical_name: string }) => ({
            id: p.id,
            name: p.canonical_name,
          })),
        );
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 focus-within:border-teal-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100">
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (q.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results.length > 0) {
              setOpen(false);
              setQ("");
              router.push(`/products/${results[0].id}`);
            }
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("search.ariaSearch")}
          className="h-7 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      {open && results.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {loading ? (
            <p className="px-4 py-2 text-xs text-slate-400">…</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={() => {
                  setOpen(false);
                  setQ("");
                  router.push(`/products/${r.id}`);
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-teal-50"
              >
                {r.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
