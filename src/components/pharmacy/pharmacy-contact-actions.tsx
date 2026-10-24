"use client";

import { Phone, Navigation } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

/** Call + external navigation actions. */
export function PharmacyContactActions({
  phone,
  latitude,
  longitude,
  name,
}: {
  phone?: string | null;
  latitude: number;
  longitude: number;
  name?: string;
}) {
  const { t } = useLanguage();
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Phone className="h-4 w-4" aria-hidden />
          {t("common.call")}
        </a>
      ) : null}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        aria-label={t("pharmacy.openDirections", { name: name ?? "" })}
      >
        <Navigation className="h-4 w-4" aria-hidden />
        {t("common.directions")}
      </a>
    </div>
  );
}
