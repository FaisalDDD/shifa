import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { all, closeDb, get, openDb, run, type LocalDb } from "../src/main/db";
import { financialReport, closeFinancialPeriod, saveDailyRate, toMinorUnits } from "../src/main/financial";
import { receiveBatch, recordSale, removeStock } from "../src/main/stock";

let dir: string;
let local: LocalDb;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "shifa-finance-"));
  local = await openDb(path.join(dir, "test.db"));
  run(local.db, `INSERT INTO products(id,canonical_name) VALUES('p','Medicine')`);
});
afterEach(() => {
  if (local) closeDb(local);
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("unknown-cost writeoffs", () => {
  it.each([false, true])("withholds profit and blocks close for an incomplete writeoff (known portion: %s)", (partlyKnown) => {
    if (partlyKnown) receiveBatch(local.db, { product_id: "p", lot_no: "known", expiry_date: "2099-01-01", quantity: 1, unit_cost: 2 });
    // Legacy/imported stock can have no financial layer; do not invent a cost.
    run(local.db, `INSERT INTO batches(id,product_id,lot_no,quantity,cost_price) VALUES('unknown','p','unknown',2,NULL)`);
    expect(removeStock(local.db, "p")).toBe(partlyKnown ? 3 : 2);
    const date = today();
    saveDailyRate(local.db, date, 100);
    const report = financialReport(local.db, date, date);
    expect(report.incomplete_cost_sales).toBe(0);
    expect(report.inventory_writeoff_sdg).toBe(partlyKnown ? 2 : 0);
    expect(report.gross_profit_sdg).toBeNull();
    expect(report.net_profit_sdg).toBeNull();
    expect(report.usd_gross_profit).toBeNull();
    expect(report.usd_net_profit).toBeNull();
    expect(() => closeFinancialPeriod(local.db, date, date, null)).toThrow(/missing cost history/i);
    expect(all(local.db, `SELECT id FROM financial_period_closes`)).toHaveLength(0);
    expect(financialReport(local.db, "2098-01-01", "2098-01-02").net_profit_sdg).toBe(0);
  });
});

describe("receipt cents conservation", () => {
  it.each([1.005, 1.004, 0.335])("normalizes unit cost %s before purchase, FIFO and physical receipt", (cost) => {
    const unitMinor = toMinorUnits(cost);
    const id = receiveBatch(local.db, { product_id: "p", lot_no: "L", expiry_date: "2099-01-01", quantity: 3, unit_cost: cost });
    expect(get<{ total_cost: number; unit_cost: number }>(local.db, `SELECT total_cost,unit_cost FROM purchases`))
      .toEqual({ total_cost: 3 * unitMinor / 100, unit_cost: unitMinor / 100 });
    expect(get<{ cost_price: number }>(local.db, `SELECT cost_price FROM batches WHERE id=?`, [id])?.cost_price).toBe(unitMinor / 100);
    expect(get<{ unit_cost: number }>(local.db, `SELECT unit_cost FROM inventory_movements WHERE batch_id=?`, [id])?.unit_cost).toBe(unitMinor / 100);
    recordSale(local.db, [{ product_id: "p", quantity: 1, unit_price: 2 }]);
    removeStock(local.db, "p");
    const report = financialReport(local.db, today(), today());
    expect(report.cogs_sdg).toBe(unitMinor / 100);
    expect(report.inventory_writeoff_sdg).toBe(2 * unitMinor / 100);
    expect(report.inventory_value_sdg).toBe(0);
    expect(all(local.db, `SELECT id FROM financial_cost_layers WHERE remaining_qty>0`)).toHaveLength(0);
  });
});
