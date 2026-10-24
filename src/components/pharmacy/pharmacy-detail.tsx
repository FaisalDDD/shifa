"use client";

import { MapPin, Globe, Clock, BadgeCheck, AlertTriangle } from "lucide-react";
import { isOpenNow, todaysHoursLabel } from "@/services/pharmacies/hours";
import { StockBadge } from "@/components/inventory/stock-badge";
import { PharmacyContactActions } from "@/components/pharmacy/pharmacy-contact-actions";
import { Badge } from "@/components/ui/badge";
import { distanceLocalized, useLanguage, type MessageKey } from "@/lib/i18n";
import type { Pharmacy, StockDisplay } from "@/types";

export interface PharmacyInventoryRow {
  id: string;
  product_id: string;
  name: string;
  strength: string | null;
  size: string | null;
  price: number | null;
  currency: string | null;
  stock: StockDisplay;
}

const DAY_KEYS = [
  "days.0",
  "days.1",
  "days.2",
  "days.3",
  "days.4",
  "days.5",
  "days.6",
] as const;

export function PharmacyDetailContent({
  pharmacy,
  inventory,
  distance,
}: {
  pharmacy: Pharmacy;
  inventory: PharmacyInventoryRow[];
  distance: number | null;
}) {
  const { t, lang } = useLanguage();
  const now = new Date();
  const openNow = isOpenNow(pharmacy.opening_hours, now);
  const todayLabel = todaysHoursLabel(pharmacy.opening_hours, now);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {!pharmacy.is_active ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          {t("pharmacy.notListed")}
        </div>
      ) : null}

      {pharmacy.is_available === false ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          {t("pharmacy.notAvailable")}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{pharmacy.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pharmacy.verification_status === "verified" ? (
                <Badge tone="teal">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {t("pharmacy.verified")}
                </Badge>
              ) : (
                <Badge tone="amber">{t("pharmacy.pendingVerification")}</Badge>
              )}
              {openNow === true ? <Badge tone="teal">{t("pharmacy.openNow")}</Badge> : null}
              {openNow === false ? <Badge tone="rose">{t("pharmacy.closed")}</Badge> : null}
              {distance != null ? (
                <Badge tone="slate">{t("pharmacy.away", { dist: distanceLocalized(distance, lang) })}</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          {pharmacy.address}
          {pharmacy.city ? `, ${pharmacy.city}` : ""}
          {pharmacy.postal_code ? ` ${pharmacy.postal_code}` : ""}
        </p>

        {pharmacy.website ? (
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <a href={pharmacy.website} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
              {pharmacy.website}
            </a>
          </p>
        ) : null}

        <div className="mt-4">
          <PharmacyContactActions
            phone={pharmacy.phone}
            latitude={pharmacy.latitude}
            longitude={pharmacy.longitude}
            name={pharmacy.name}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock className="h-4 w-4 text-slate-400" aria-hidden /> {t("pharmacy.openingHours")}
          </h2>
          {todayLabel ? (
            <p className="mt-2 text-sm font-medium text-slate-700">
              {t("pharmacy.today")}:{" "}
              {todayLabel === "Closed today" ? t("pharmacy.closedToday") : todayLabel}
            </p>
          ) : null}
          {!pharmacy.opening_hours || pharmacy.opening_hours.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("pharmacy.hoursUnavailable")}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {pharmacy.opening_hours.map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span className="text-slate-600">{t(DAY_KEYS[h.day] as MessageKey)}</span>
                  <span className={h.closed ? "text-slate-400" : "text-slate-800"}>
                    {h.closed ? t("pharmacy.closedDay") : `${h.open}–${h.close}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pharmacy.services && pharmacy.services.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">{t("pharmacy.services")}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {pharmacy.services.map((s) => (
                <Badge key={s} tone="slate">{s.replaceAll("_", " ")}</Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">{t("pharmacy.reportedStock")}</h2>
        {inventory.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            {t("pharmacy.noStockReported")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {inventory.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <a
                    href={`/products/${row.product_id}`}
                    className="font-medium text-slate-800 hover:text-teal-700"
                  >
                    {row.name}
                    {row.strength ? ` ${row.strength}` : ""}
                  </a>
                  {row.size ? (
                    <p className="text-xs text-slate-500">{row.size}</p>
                  ) : null}
                  {row.price != null ? (
                    <p className="text-xs text-slate-500">
                      {row.price.toFixed(2)} {row.currency ?? ""}
                    </p>
                  ) : null}
                </div>
                <StockBadge stock={row.stock} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-400">
          {t("pharmacy.stockDisclaimer")}
        </p>
      </div>
    </div>
  );
}
