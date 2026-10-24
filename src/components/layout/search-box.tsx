"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

interface Hit {
  id: string;
  name: string;
  count: number;
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
        const hits = (data ?? []) as {
          id: string;
          canonical_name: string;
          strength: string | null;
        }[];
        const ids = hits.map((p) => p.id);
        const counts = new Map<string, number>();
        if (ids.length) {
          const { data: inv } = await supabase
            .from("pharmacy_inventory_public")
            .select("product_id, pharmacy_id")
            .in("product_id", ids)
            .in("availability_status", ["AVAILABLE", "LOW_STOCK"]);
          const seen = new Map<string, Set<string>>();
          for (const r of (inv ?? []) as { product_id: string; pharmacy_id: string }[]) {
            if (!seen.has(r.product_id)) seen.set(r.product_id, new Set());
            seen.get(r.product_id)!.add(r.pharmacy_id);
          }
          for (const [pid, s] of seen) counts.set(pid, s.size);
        }
        setResults(
          hits.map((p) => ({
            id: p.id,
            name: p.strength ? `${p.canonical_name} ${p.strength}` : p.canonical_name,
            count: counts.get(p.id) ?? 0,
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
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-teal-50"
              >
                <span className="truncate">{r.name}</span>
                {r.count > 0 ? (
                  <span className="shrink-0 text-xs text-slate-400">
                    {r.count === 1 ? t("search.pharmacyCountOne") : t("search.pharmacyCount", { count: r.count })}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
