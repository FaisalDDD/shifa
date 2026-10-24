export function formatDistance(m: number | null | undefined): string {
  if (m == null) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
