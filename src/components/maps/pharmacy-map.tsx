"use client";

import { useState } from "react";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  useLoadScript,
} from "@react-google-maps/api";
import { clusterPoints } from "@/services/maps/cluster";
import { getGoogleMapsKey } from "@/lib/maps/google";
import { distanceLocalized, useLanguage, type MessageKey } from "@/lib/i18n";
import type { StockDisplay } from "@/types";
import { customerStockLabelKey } from "@/services/inventory/stock";
import Link from "next/link";

export interface MapPharmacy {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_m: number | null;
  stock: StockDisplay | null;
}

function stockColor(stock: StockDisplay | null): string {
  if (!stock || !stock.hasUsableData) return "#94a3b8";
  return stock.availability === "AVAILABLE"
    ? "#0d4f9e"
    : stock.availability === "LOW_STOCK"
      ? "#d97706"
      : "#e11d48";
}

function dotIcon(color: string): { url: string; half: number } {
  const s = 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 2}" fill="${color}" stroke="#ffffff" stroke-width="2"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, half: s / 2 };
}

function clusterIcon(count: number): { url: string; half: number } {
  const s = count >= 100 ? 46 : 38;
  const r = s / 2;
  const fs = count >= 100 ? 13 : 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${r}" cy="${r}" r="${r - 2}" fill="#0f172a" fill-opacity="0.92" stroke="#ffffff" stroke-width="2"/><text x="${r}" y="${r}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="${fs}" font-family="Segoe UI, sans-serif" font-weight="700">${count}</text></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, half: r };
}

export function PharmacyMap({
  pharmacies,
  center,
  height = "100%",
}: {
  pharmacies: MapPharmacy[];
  center: { lat: number; lng: number };
  height?: string;
}) {
  const { t, lang } = useLanguage();
  const apiKey = getGoogleMapsKey();
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey ?? "",
  });
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(13);
  const [selected, setSelected] = useState<MapPharmacy | null>(null);

  if (!apiKey || loadError) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-6 text-center text-sm text-slate-500">
        {t("map.unavailable")}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-6 text-center text-sm text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  const clusters = clusterPoints(
    pharmacies.map((p) => ({
      id: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
    zoom,
  );

  function labelFor(stock: StockDisplay | null): string {
    if (!stock) return t("stock.unknown");
    return t(customerStockLabelKey(stock) as MessageKey);
  }

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-xl border border-slate-200">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={{ lat: center.lat, lng: center.lng }}
        zoom={13}
        onLoad={(m) => setMap(m)}
        onZoomChanged={() => {
          if (map) setZoom(map.getZoom() ?? 13);
        }}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        {clusters.map((cluster) => {
          if (cluster.count === 1) {
            const p = pharmacies.find((ph) => ph.id === cluster.members[0].id);
            if (!p) return null;
            const dot = dotIcon(stockColor(p.stock));
            return (
              <MarkerF
                key={cluster.id}
                position={{ lat: cluster.latitude, lng: cluster.longitude }}
                icon={{ url: dot.url, anchor: new google.maps.Point(dot.half, dot.half) }}
                onClick={() => setSelected(p)}
              />
            );
          }

          const icon = clusterIcon(cluster.count);
          return (
            <MarkerF
              key={cluster.id}
              position={{ lat: cluster.latitude, lng: cluster.longitude }}
              icon={{ url: icon.url, anchor: new google.maps.Point(icon.half, icon.half) }}
              onClick={() => {
                if (map) {
                  map.panTo({ lat: cluster.latitude, lng: cluster.longitude });
                  map.setZoom(Math.min(zoom + 2, 18));
                }
              }}
            />
          );
        })}

        {selected ? (
          <InfoWindowF
            position={{ lat: selected.latitude, lng: selected.longitude }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="min-w-[180px]">
              <Link
                href={`/pharmacies/${selected.slug}`}
                className="font-semibold text-teal-700 hover:underline"
              >
                {selected.name}
              </Link>
              <p className="mt-1 text-xs text-slate-600">{labelFor(selected.stock)}</p>
              {selected.distance_m != null ? (
                <p className="text-xs text-slate-500">
                  {t("pharmacy.away", {
                    dist: distanceLocalized(selected.distance_m, lang),
                  })}
                </p>
              ) : null}
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>
    </div>
  );
}
