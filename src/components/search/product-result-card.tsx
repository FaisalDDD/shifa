"use client";

import Link from "next/link";
import { MapPin, HelpCircle } from "lucide-react";
import type { ProductSearchHit } from "@/types";
import { StockBadge } from "@/components/inventory/stock-badge";
import { Badge } from "@/components/ui/badge";
import { distanceLocalized, useLanguage } from "@/lib/i18n";

export function ProductResultCard({ hit }: { hit: ProductSearchHit }) {
  const p = hit.product;
  const { t, lang } = useLanguage();

  return (
    <Link
      href={`/products/${p.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-teal-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {p.canonical_name}
            {p.strength ? ` ${p.strength}` : ""}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {p.brand_name ? `${p.brand_name} · ` : ""}
            {p.dosage_form ?? t("product.dosageFormFallback")}
            {p.prescription_classification === "prescription"
              ? ` · ${t("product.prescriptionShort")}`
              : ""}
          </p>
        </div>
        {p.prescription_classification === "prescription" ? (
          <Badge tone="navy">Rx</Badge>
        ) : null}
      </div>

      <div className="mt-3">
        {hit.best ? (
          <StockBadge stock={hit.best} />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <HelpCircle className="h-4 w-4" aria-hidden />
            {t("product.noLocation")}
          </span>
        )}
      </div>

      {hit.nearest_distance_m != null ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {t("product.nearest", { dist: distanceLocalized(hit.nearest_distance_m, lang) })}
          {hit.pharmacies.length > 0
            ? ` · ${
                hit.pharmacies.length === 1
                  ? t("product.pharmacyReporting")
                  : t("product.pharmaciesReporting", { count: hit.pharmacies.length })
              }`
            : ""}
        </p>
      ) : null}
    </Link>
  );
}
