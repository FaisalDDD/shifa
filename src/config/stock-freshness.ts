// Freshness thresholds for stock availability display.
// Configurable via env so rules are not hard-coded across the app.

export interface FreshnessConfig {
  /** Availability is "recently confirmed" if verified/updated within this many hours. */
  recentlyConfirmedHours: number;
  /** Availability is "stale" if older than this many hours. */
  staleHours: number;
}

export const DEFAULT_FRESHNESS: FreshnessConfig = {
  recentlyConfirmedHours: 2,
  staleHours: 24,
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getFreshnessConfig(): FreshnessConfig {
  return {
    recentlyConfirmedHours: numEnv(
      "STOCK_RECENT_HOURS",
      DEFAULT_FRESHNESS.recentlyConfirmedHours,
    ),
    staleHours: numEnv("STOCK_STALE_HOURS", DEFAULT_FRESHNESS.staleHours),
  };
}
