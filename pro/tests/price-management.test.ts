import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, get, openDb, run, type LocalDb } from "../src/main/db";
import { applyPriceAdjustment, previewPriceAdjustment, rollbackPriceAdjustment } from "../src/main/price-management";
import { listProducts } from "../src/main/sync";

let dir: string;
let local: LocalDb;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "shifa-prices-"));
  local = await openDb(path.join(dir, "test.db"));
  run(local.db, `INSERT INTO products(id,canonical_name,price,prescription_classification) VALUES
    ('fallback','Fallback',NULL,'otc'),('override','Override',50,'prescription'),('unpriced','Unpriced',NULL,'unknown')`);
  run(local.db, `INSERT INTO batches(id,product_id,lot_no,quantity,sale_price) VALUES
    ('old','fallback','old',1,10),('latest','fallback','latest',1,20),('no-price','fallback','no-price',1,NULL),('override-batch','override','override',1,100)`);
});
afterEach(() => {
  if (local) closeDb(local);
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("bulk effective prices", () => {
  it("adjusts the same effective prices as the catalog and restores nullable overrides", () => {
    const preview = previewPriceAdjustment(local.db, "all", 10);
    expect(preview).toEqual([
      { product_id: "fallback", name: "Fallback", old_price: 20, new_price: 22, change_percent: 10 },
      { product_id: "override", name: "Override", old_price: 50, new_price: 55, change_percent: 10 },
    ]);
    expect(previewPriceAdjustment(local.db, "otc", 10)).toEqual([preview[0]]);
    const adjustment = applyPriceAdjustment(local.db, "all", 10, "Supplier price change", null);
    expect(adjustment.count).toBe(2);
    expect(listProducts(local.db).find(p => p.id === "fallback")?.price).toBe(22);
    expect(get(local.db, `SELECT old_price FROM price_adjustment_items WHERE batch_id=? AND product_id='fallback'`, [adjustment.id])).toEqual({ old_price: null });
    expect(rollbackPriceAdjustment(local.db, adjustment.id, null)).toBe(2);
    expect(get(local.db, `SELECT price FROM products WHERE id='fallback'`)).toEqual({ price: null });
    expect(listProducts(local.db).find(p => p.id === "fallback")?.price).toBe(20);
    expect(get(local.db, `SELECT price FROM products WHERE id='override'`)).toEqual({ price: 50 });
  });

  it("refuses the entire rollback if an adjusted fallback override was edited", () => {
    const adjustment = applyPriceAdjustment(local.db, "all", 10, "Supplier price change", null);
    run(local.db, `UPDATE products SET price=23 WHERE id='fallback'`);
    expect(() => rollbackPriceAdjustment(local.db, adjustment.id, null)).toThrow(/changed since/);
    expect(get(local.db, `SELECT price FROM products WHERE id='override'`)).toEqual({ price: 55 });
    expect(get(local.db, `SELECT status FROM price_adjustment_batches WHERE id=?`, [adjustment.id])).toEqual({ status: "applied" });
  });
});
