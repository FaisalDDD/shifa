// Geographic helpers. Distances are always in METERS (documented choice).

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle (Haversine) distance in meters. */
export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convert kilometers to meters, guarding against non-finite input. */
export function kmToMeters(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 10_000;
  return km * 1000;
}
