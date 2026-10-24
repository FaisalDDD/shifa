import { describe, it, expect } from "vitest";
import {
  buildStockDisplay,
  classifyFreshness,
  formatRelativeTime,
} from "@/services/inventory/stock";
import type { FreshnessConfig } from "@/config/stock-freshness";

const config: FreshnessConfig = { recentlyConfirmedHours: 2, staleHours: 24 };
const now = new Date("2026-10-14T12:00:00Z");
const h = (n: number) => new Date(now.getTime() - n * 3_600_000);

describe("stock freshness classification", () => {
  it("classifies a null timestamp as unknown", () => {
    expect(classifyFreshness(null, now, config)).toBe("unknown");
    expect(classifyFreshness(undefined, now, config)).toBe("unknown");
  });

  it("classifies an invalid timestamp as unknown", () => {
    expect(classifyFreshness("not-a-date", now, config)).toBe("unknown");
  });

  it("classifies a fresh timestamp as recent", () => {
    expect(classifyFreshness(h(1), now, config)).toBe("recent");
    expect(classifyFreshness(h(2), now, config)).toBe("recent"); // boundary
  });

  it("classifies an older timestamp as older", () => {
    expect(classifyFreshness(h(3), now, config)).toBe("older");
    expect(classifyFreshness(h(24), now, config)).toBe("older"); // boundary
  });

  it("classifies an old timestamp as stale", () => {
    expect(classifyFreshness(h(25), now, config)).toBe("stale");
  });
});

describe("stock display", () => {
  it("shows recently confirmed available", () => {
    const d = buildStockDisplay("AVAILABLE", h(0.5), now, config);
    expect(d.label).toBe("Recently confirmed available");
    expect(d.freshness).toBe("recent");
    expect(d.callToConfirm).toBe(false);
    expect(d.hasUsableData).toBe(true);
  });

  it("flags stale available as may-have-changed", () => {
    const d = buildStockDisplay("AVAILABLE", h(30), now, config);
    expect(d.freshness).toBe("stale");
    expect(d.callToConfirm).toBe(true);
  });

  it("shows unknown availability when status is UNKNOWN", () => {
    const d = buildStockDisplay("UNKNOWN", h(1), now, config);
    expect(d.label).toBe("Availability unknown");
    expect(d.hasUsableData).toBe(false);
  });

  it("shows unknown availability when status is null/invalid", () => {
    expect(buildStockDisplay(null, h(1), now, config).hasUsableData).toBe(false);
    expect(buildStockDisplay(undefined, h(1), now, config).hasUsableData).toBe(false);
  });

  it("shows reported out of stock", () => {
    const d = buildStockDisplay("OUT_OF_STOCK", h(1), now, config);
    expect(d.label).toBe("Reported out of stock");
    expect(d.availability).toBe("OUT_OF_STOCK");
  });

  it("flags stale out-of-stock as may-have-changed", () => {
    const d = buildStockDisplay("OUT_OF_STOCK", h(48), now, config);
    expect(d.callToConfirm).toBe(true);
  });
});

describe("formatRelativeTime", () => {
  it("formats minutes, hours and days", () => {
    expect(formatRelativeTime(h(0.001), now)).toBe("just now");
    expect(formatRelativeTime(h(0.5), now)).toBe("30 minutes ago");
    expect(formatRelativeTime(h(3), now)).toBe("3 hours ago");
    expect(formatRelativeTime(h(48), now)).toBe("2 days ago");
  });
});
