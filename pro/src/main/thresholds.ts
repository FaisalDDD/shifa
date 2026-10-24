export function normalizeLowStockThreshold(value: unknown): number {
  const threshold = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || !Number.isInteger(threshold) || threshold < 0 || threshold > 1_000_000) {
    throw new Error("Low-stock threshold must be a whole number from 0 to 1,000,000.");
  }
  return threshold;
}
