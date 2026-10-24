// Google Maps JS API configuration.

/** Client-side Google Maps API key (safe to expose in the browser). */
export function getGoogleMapsKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
}
