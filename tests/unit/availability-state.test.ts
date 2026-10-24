import { describe, expect, it } from "vitest";
import { buildStockDisplay, customerStockLabelKey } from "@/services/inventory/stock";

describe("customer availability states", () => {
  it("renders low stock as a usable yellow state without exposing quantity", () => {
    const stock = buildStockDisplay("LOW_STOCK", "2026-10-22T12:00:00.000Z", new Date("2026-10-22T12:30:00.000Z"));
    expect(stock.availability).toBe("LOW_STOCK");
    expect(stock.hasUsableData).toBe(true);
    expect(stock.callToConfirm).toBe(false);
    expect(customerStockLabelKey(stock)).toBe("stock.lowStock");
  });

  it("keeps unknown and stale availability distinct from low stock", () => {
    const unknown = buildStockDisplay("UNKNOWN", null, new Date("2026-10-22T12:30:00.000Z"));
    const stale = buildStockDisplay("LOW_STOCK", "2026-10-18T12:00:00.000Z", new Date("2026-10-22T12:30:00.000Z"));
    expect(unknown.hasUsableData).toBe(false);
    expect(stale.availability).toBe("LOW_STOCK");
    expect(stale.callToConfirm).toBe(true);
  });
});
