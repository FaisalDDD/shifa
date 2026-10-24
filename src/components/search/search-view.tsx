"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Search, Map as MapIcon, List as ListIcon, SlidersHorizontal, X as XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductResultCard } from "./product-result-card";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { useLanguage } from "@/lib/i18n";
import type { ProductSearchHit, SortOption, StockDisplay } from "@/types";
import type { MapPharmacy } from "@/components/maps/pharmacy-map";

const PharmacyMap = dynamic(
  () => import("@/components/maps/pharmacy-map").then((m) => m.PharmacyMap),
  { ssr: false },
);
const LocationPicker = dynamic(
  () => import("@/components/maps/location-picker").then((m) => m.LocationPicker),
  { ssr: false },
);

interface Geo {
  latitude: number;
  longitude: number;
}

type ApiResult =
  | { ok: true; data: ProductSearchHit[] }
  | { ok: false; error: { message: string } };

function bestAcross(stocks: (StockDisplay | null)[]): StockDisplay | null {
  const usable = stocks.filter((s): s is StockDisplay => !!s && s.hasUsableData);
  if (usable.length === 0) return null;
  const rank = { AVAILABLE: 3, UNKNOWN: 1, OUT_OF_STOCK: 0 } as const;
  return usable.sort((a, b) => rank[b.availability] - rank[a.availability])[0];
}

function buildMapPharmacies(hits: ProductSearchHit[]): MapPharmacy[] {
  const map = new Map<string, { p: ProductSearchHit["pharmacies"][number]; stocks: (StockDisplay | null)[] }>();
  for (const hit of hits) {
    for (const ph of hit.pharmacies) {
      const existing = map.get(ph.id);
      if (existing) existing.stocks.push(ph.stock);
      else map.set(ph.id, { p: ph, stocks: [ph.stock] });
    }
  }
  return Array.from(map.values()).map(({ p, stocks }) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    distance_m: p.distance_m,
    stock: bestAcross(stocks),
  }));
}

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const { t } = useLanguage();
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<ProductSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Geo | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const [radius, setRadius] = useState(10);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [view, setView] = useState<"list" | "map">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (query: string, loc: Geo | null) => {
      if (query.trim() === "") {
        setHits([]);
        setLoading(false);
        setSearched(false);
        return;
      }
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const params = new URLSearchParams({ q: query, sort });
        if (loc) {
          params.set("latitude", String(loc.latitude));
          params.set("longitude", String(loc.longitude));
          params.set("radius", String(radius));
        }
        if (strength) params.set("strength", strength);
        if (dosageForm) params.set("dosage_form", dosageForm);

        const res = await fetch(`/api/products/search?${params.toString()}`);
        const json = (await res.json()) as ApiResult;
        if (!json.ok) {
          setError(json.error.message);
          setHits([]);
        } else {
          setHits(json.data);
        }
      } catch {
        setError("__network__");
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [radius, sort, strength, dosageForm],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q, location), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, location, radius, sort, strength, dosageForm, runSearch]);

  const suggestions = hits.slice(0, 6).map((h) => ({
    id: h.product.id,
    label: `${h.product.canonical_name}${h.product.strength ? ` ${h.product.strength}` : ""}`,
  }));

  const mapPharmacies = buildMapPharmacies(hits);
  const center = location ?? { latitude: 52.52, longitude: 13.405 };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm">
          <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={t("search.placeholder")}
            className="h-11 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            aria-label={t("search.ariaSearch")}
            autoFocus={!initialQuery}
          />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label={t("search.toggleFilters")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-label={view === "list" ? t("search.showMapView") : t("search.showListView")}
          >
            {view === "list" ? <MapIcon className="h-4 w-4" /> : <ListIcon className="h-4 w-4" />}
            <span className="hidden sm:inline">{view === "list" ? t("search.map") : t("search.list")}</span>
          </button>
        </div>

        {showSuggestions && q.trim() !== "" && suggestions.length > 0 ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={() => {
                  setQ(s.label);
                  setShowSuggestions(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Filters + location */}
      {showFilters ? (
        <div className="mt-3 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t("search.strength")}</span>
            <Input
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              placeholder={t("search.strengthPlaceholder")}
              className="mt-1 h-9"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t("search.dosageForm")}</span>
            <Input
              value={dosageForm}
              onChange={(e) => setDosageForm(e.target.value)}
              placeholder={t("search.dosagePlaceholder")}
              className="mt-1 h-9"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t("search.radius")}</span>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
            >
              {[1, 5, 10, 25, 50].map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t("search.sortBy")}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="relevance">{t("search.sort.relevance")}</option>
              <option value="distance">{t("search.sort.distance")}</option>
              <option value="freshness">{t("search.sort.freshness")}</option>
            </select>
          </label>
        </div>
      ) : null}

      {/* Location */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {location ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm text-teal-800">
            {t("search.near", {
              coords: `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`,
            })}
            <button
              type="button"
              onClick={() => setLocation(null)}
              aria-label={t("search.clearLocation")}
              className="text-teal-600 hover:text-teal-800"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setShowLocation((v) => !v)}>
            {t("search.setLocation")}
          </Button>
        )}
        {showLocation && !location ? (
          <div className="w-full rounded-xl border border-slate-200 bg-white p-4 md:max-w-md">
            <LocationPicker value={location} onChange={setLocation} />
          </div>
        ) : null}
      </div>

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <LoadingState label={t("search.searching")} />
        ) : error ? (
          <ErrorState
            title={t("search.failed")}
            description={error === "__network__" ? t("search.couldNotReach") : error}
          />
        ) : !searched || q.trim() === "" ? (
          <EmptyState
            title={t("search.empty.title")}
            description={t("search.empty.desc")}
          />
        ) : hits.length === 0 ? (
          <EmptyState
            title={t("search.noResults.title")}
            description={t("search.noResults.desc")}
          />
        ) : view === "list" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hits.map((hit) => (
              <ProductResultCard key={hit.product.id} hit={hit} />
            ))}
          </div>
        ) : (
          <div>
            <PharmacyMap
              pharmacies={mapPharmacies}
              center={{ lat: center.latitude, lng: center.longitude }}
              height="440px"
            />
            <p className="mt-2 text-xs text-slate-500">
              {t("search.mapCaption")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
