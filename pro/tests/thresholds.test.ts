import { describe, expect, it } from "vitest";
import { normalizeLowStockThreshold } from "../src/main/thresholds";

describe("low-stock thresholds", () => {
  it("accepts bounded whole-unit thresholds", () => {
    expect(normalizeLowStockThreshold(5)).toBe(5);
    expect(normalizeLowStockThreshold("12")).toBe(12);
  });

  it("rejects negative, fractional, and non-finite thresholds", () => {
    expect(() => normalizeLowStockThreshold(-1)).toThrow();
    expect(() => normalizeLowStockThreshold(1.5)).toThrow();
    expect(() => normalizeLowStockThreshold("abc")).toThrow();
  });
});
