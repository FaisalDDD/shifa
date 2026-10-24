"use client";

import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { StockBadge } from "@/components/inventory/stock-badge";
import { PharmacyContactActions } from "@/components/pharmacy/pharmacy-contact-actions";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { distanceLocalized, useLanguage } from "@/lib/i18n";
import type { PharmacyWithInventory } from "@/types";

type ApiResult =
  | { ok: true; data: PharmacyWithInventory[] }
  | { ok: false; error: { message: string } };

export function AvailabilityPanel({ productId }: { productId: string }) {
  const { t, lang } = useLanguage();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pharmacies, setPharmacies] = useState<PharmacyWithInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/products/${productId}/availability?latitude=${location!.latitude}&longitude=${location!.longitude}&radius=10`,
        );
        const json = (await res.json()) as ApiResult;
        if (cancelled) return;
        if (json.ok) setPharmacies(json.data);
        else setError(json.error.message);
      } catch {
        if (!cancelled) setError("__load__");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [location, productId]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoStatus(t("avail.geoUnsupported"));
      return;
    }
    setGeoStatus(t("avail.requesting"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setTried(true);
        setGeoStatus(null);
      },
      (err) => {
        setTried(true);
        setGeoStatus(err.code === 1 ? t("avail.geoDenied") : t("avail.geoError"));
      },
    );
  }

  return (
    <div>
      {!tried && !location ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            {t("avail.setLocationPrompt")}
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Crosshair className="h-4 w-4" aria-hidden />
            {t("avail.useMyLocation")}
          </button>
          {geoStatus ? <p className="mt-2 text-xs text-amber-600">{geoStatus}</p> : null}
        </div>
      ) : loading ? (
        <LoadingState label={t("avail.finding")} />
      ) : error ? (
        <ErrorState
          title={t("avail.loadError")}
          description={error === "__load__" ? t("avail.loadErrorMsg") : error}
        />
      ) : pharmacies.length === 0 ? (
        <EmptyState
          title={t("avail.empty.title")}
          description={t("avail.empty.desc")}
        />
      ) : (
        <ul className="space-y-3">
          {pharmacies.map((p) => (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <a
                    href={`/pharmacies/${p.slug}`}
                    className="font-semibold text-teal-700 hover:underline"
                  >
                    {p.name}
                  </a>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {p.address}
                    {p.distance_m != null ? ` · ${distanceLocalized(p.distance_m, lang)}` : ""}
                  </p>
                </div>
                {p.verification_status !== "verified" ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {t("avail.pendingVerification")}
                  </span>
                ) : null}
              </div>

              <div className="mt-2">
                {p.stock ? <StockBadge stock={p.stock} /> : (
                  <span className="text-sm text-slate-500">{t("stock.unknown")}</span>
                )}
              </div>

              <div className="mt-3">
                <PharmacyContactActions
                  phone={p.phone}
                  latitude={p.latitude}
                  longitude={p.longitude}
                  name={p.name}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
