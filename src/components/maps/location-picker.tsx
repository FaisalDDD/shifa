"use client";

import { useState } from "react";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import { Crosshair } from "lucide-react";
import { getGoogleMapsKey } from "@/lib/maps/google";
import { useLanguage } from "@/lib/i18n";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const DEFAULT_CENTER: GeoPoint = { latitude: 52.52, longitude: 13.405 };

export function LocationPicker({
  value,
  onChange,
}: {
  value: GeoPoint | null;
  onChange: (p: GeoPoint) => void;
}) {
  const { t } = useLanguage();
  const apiKey = getGoogleMapsKey();
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey ?? "",
  });
  const [status, setStatus] = useState<string | null>(null);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus(t("lp.geoUnsupported"));
      return;
    }
    setStatus(t("lp.requesting"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus(null);
      },
      (err) => {
        setStatus(err.code === 1 ? t("lp.geoDenied") : t("lp.geoError"));
      },
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={useMyLocation}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Crosshair className="h-4 w-4 text-teal-600" aria-hidden />
        {t("lp.useMyLocation")}
      </button>

      {status ? <p className="text-xs text-amber-600">{status}</p> : null}

      {apiKey && !loadError && isLoaded ? (
        <div className="h-[180px] w-full overflow-hidden rounded-lg border border-slate-200">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={
              value
                ? { lat: value.latitude, lng: value.longitude }
                : { lat: DEFAULT_CENTER.latitude, lng: DEFAULT_CENTER.longitude }
            }
            zoom={11}
            onClick={(e) => {
              if (e.latLng) {
                onChange({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
              }
            }}
            options={{
              fullscreenControl: false,
              streetViewControl: false,
              mapTypeControl: false,
              scrollwheel: false,
            }}
          >
            {value ? (
              <MarkerF position={{ lat: value.latitude, lng: value.longitude }} />
            ) : null}
          </GoogleMap>
        </div>
      ) : (
        <div className="flex h-[100px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-500">
          {t("lp.mapUnavailable")}
        </div>
      )}

      {value ? (
        <p className="text-xs text-slate-500">
          {t("lp.selected", {
            coords: `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}`,
          })}
        </p>
      ) : null}
    </div>
  );
}
