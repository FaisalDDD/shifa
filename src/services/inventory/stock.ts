// Stock availability freshness classification and display rules.
// Pure functions (no I/O) so they are fully unit-testable.

import {
  getFreshnessConfig,
  type FreshnessConfig,
} from "@/config/stock-freshness";
import type {
  AvailabilityStatus,
  FreshnessState,
  StockDisplay,
} from "@/types";

export function classifyFreshness(
  lastVerifiedAt: Date | string | number | null | undefined,
  now: Date,
  config: FreshnessConfig = getFreshnessConfig(),
): FreshnessState {
  if (!lastVerifiedAt) return "unknown";
  const t = new Date(lastVerifiedAt);
  if (Number.isNaN(t.getTime())) return "unknown";
  const ageHours = (now.getTime() - t.getTime()) / 3_600_000;
  if (ageHours < 0) return "recent"; // clock skew: treat as recent, not stale
  if (ageHours <= config.recentlyConfirmedHours) return "recent";
  if (ageHours <= config.staleHours) return "older";
  return "stale";
}

export function buildStockDisplay(
  availability: AvailabilityStatus | null | undefined,
  lastVerifiedAt: Date | string | number | null | undefined,
  now: Date = new Date(),
  config: FreshnessConfig = getFreshnessConfig(),
): StockDisplay {
  let verifiedIso: string | null = null;
  if (lastVerifiedAt) {
    const d = new Date(lastVerifiedAt);
    if (!Number.isNaN(d.getTime())) verifiedIso = d.toISOString();
  }

  if (!availability || availability === "UNKNOWN") {
    return {
      availability: "UNKNOWN",
      freshness: "unknown",
      label: "Availability unknown",
      hint: "No usable stock information",
      labelKey: "stock.unknown",
      hintKey: "stock.hint.none",
      hintTimestamp: null,
      callToConfirm: false,
      icon: "unknown",
      hasUsableData: false,
    };
  }

  const freshness = classifyFreshness(lastVerifiedAt, now, config);
  const age = lastVerifiedAt
    ? formatRelativeTime(new Date(lastVerifiedAt), now)
    : null;

  const base = {
    availability,
    freshness,
    hasUsableData: true,
  } as const;

  if (availability === "AVAILABLE") {
    if (freshness === "recent") {
      return {
        ...base,
        label: "Recently confirmed available",
        hint: age ? `Updated ${age}` : "Recently updated",
        labelKey: "stock.available.recent",
        hintKey: age ? "stock.hint.updated" : "stock.hint.recently",
        hintTimestamp: verifiedIso,
        callToConfirm: false,
        icon: "available",
      };
    }
    if (freshness === "older") {
      return {
        ...base,
        label: "Pharmacy-reported available",
        hint: age ? `Last updated ${age}` : null,
        labelKey: "stock.available.older",
        hintKey: age ? "stock.hint.lastUpdated" : undefined,
        hintTimestamp: verifiedIso,
        callToConfirm: false,
        icon: "available",
      };
    }
    // stale
    return {
      ...base,
      label: "Reported available — may have changed",
      hint: age ? `Last verified ${age}` : "Not recently verified",
      labelKey: "stock.available.stale",
      hintKey: age ? "stock.hint.lastVerified" : "stock.hint.notVerified",
      hintTimestamp: verifiedIso,
      callToConfirm: true,
      icon: "available",
    };
  }

  // OUT_OF_STOCK
  if (freshness === "recent") {
    return {
      ...base,
      label: "Reported out of stock",
      hint: age ? `Updated ${age}` : "Recently updated",
      labelKey: "stock.out.recent",
      hintKey: age ? "stock.hint.updated" : "stock.hint.recently",
      hintTimestamp: verifiedIso,
      callToConfirm: false,
      icon: "out",
    };
  }
  if (freshness === "older") {
    return {
      ...base,
      label: "Reported out of stock",
      hint: age ? `Last updated ${age}` : null,
      labelKey: "stock.out.recent",
      hintKey: age ? "stock.hint.lastUpdated" : undefined,
      hintTimestamp: verifiedIso,
      callToConfirm: false,
      icon: "out",
    };
  }
  return {
    ...base,
    label: "Reported out of stock — may have changed",
    hint: age ? `Last verified ${age}` : "Not recently verified",
    labelKey: "stock.out.stale",
    hintKey: age ? "stock.hint.lastVerified" : "stock.hint.notVerified",
    hintTimestamp: verifiedIso,
    callToConfirm: true,
    icon: "out",
  };
}

export function formatRelativeTime(from: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - from.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/**
 * Customer-facing label key: availability only, no freshness. Customers see
 * "In stock" / "Out of stock" / "Unknown"; the recency/staleness detail is
 * pharmacy-management only.
 */
export function customerStockLabelKey(stock: StockDisplay): string {
  if (!stock.hasUsableData) return "stock.unknown";
  return stock.availability === "AVAILABLE" ? "stock.inStock" : "stock.outOfStock";
}
