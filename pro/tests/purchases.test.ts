import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, openDb, run, type LocalDb } from "../src/main/db";
import {
  markPaid,
  mostPurchasedProducts,
  outstandingPayables,
  recordPurchase,
} from "../src/main/purchases";

describe("purchases: ledger + payables", () => {
  let dir: string;
  let db: LocalDb;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "shifa-purchases-"));
    db = await openDb(path.join(dir, "test.db"));

    run(db.db, `INSERT INTO products (id, canonical_name) VALUES ('p1', 'Paracetamol')`);
    run(db.db, `INSERT INTO products (id, canonical_name) VALUES ('p2', 'Amoxicillin')`);

    recordPurchase(db.db, { product_id: "p1", supplier: "MedSupply", quantity: 100, unit_cost: 1.5, payment_status: "unpaid" });
    recordPurchase(db.db, { product_id: "p1", supplier: "MedSupply", quantity: 50, unit_cost: 1.4, payment_status: "paid" });
    recordPurchase(db.db, { product_id: "p2", supplier: "RxWholesale", quantity: 20, unit_cost: 8.0, payment_status: "unpaid" });
  });

  afterAll(() => {
    closeDb(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("ranks most-purchased products by quantity", () => {
    const top = mostPurchasedProducts(db.db);
    expect(top[0].product_id).toBe("p1");
    expect(top[0].total_quantity).toBe(150);
    expect(top[0].purchase_count).toBe(2);
    expect(top[1].product_id).toBe("p2");
    expect(top[1].total_quantity).toBe(20);
  });

  it("totals outstanding payables", () => {
    const pay = outstandingPayables(db.db);
    // p1 unpaid: 100 * 1.5 = 150; p2 unpaid: 20 * 8 = 160 -> 310 owed.
    expect(pay.total_owed).toBeCloseTo(310);
    expect(pay.rows).toHaveLength(2);
  });

  it("marks a payable as paid", () => {
    const id = outstandingPayables(db.db).rows.find(
      (r) => r.product_name === "Amoxicillin",
    )!.id;
    markPaid(db.db, id);
    const pay = outstandingPayables(db.db);
    expect(pay.total_owed).toBeCloseTo(150);
    expect(pay.rows).toHaveLength(1);
  });
});
