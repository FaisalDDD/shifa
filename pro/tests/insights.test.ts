import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, openDb, run, type LocalDb } from "../src/main/db";
import { upsertBatch } from "../src/main/stock";
import { getInventorySuggestions, listExpiring } from "../src/main/insights";

function d(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

describe("insights: expiry + suggestions", () => {
  let dir: string;
  let db: LocalDb;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "shifa-insights-"));
    db = await openDb(path.join(dir, "test.db"));

    run(db.db, `INSERT INTO products (id, canonical_name) VALUES ('p1', 'Paracetamol')`);
    run(db.db, `INSERT INTO products (id, canonical_name) VALUES ('p2', 'Ibuprofen')`);
    run(db.db, `INSERT INTO products (id, canonical_name) VALUES ('p3', 'Aspirin')`);
    run(db.db, `INSERT INTO products (id, canonical_name) VALUES ('p4', 'Vitamins')`);

    // p1: a critical batch (10 days) + a far batch (120 days)
    upsertBatch(db.db, { id: "b1", product_id: "p1", lot_no: "L1", expiry_date: d(10), quantity: 5, cost_price: 1 });
    upsertBatch(db.db, { id: "b2", product_id: "p1", lot_no: "L2", expiry_date: d(120), quantity: 50, cost_price: 1 });
    // p2: expired yesterday
    upsertBatch(db.db, { id: "b3", product_id: "p2", lot_no: "L3", expiry_date: d(-1), quantity: 3, cost_price: 1 });
    // p3: low stock (2), far expiry
    upsertBatch(db.db, { id: "b4", product_id: "p3", lot_no: "L4", expiry_date: d(200), quantity: 2, cost_price: 1 });
    // p4: overstock (150), far expiry
    upsertBatch(db.db, { id: "b5", product_id: "p4", lot_no: "L5", expiry_date: d(200), quantity: 150, cost_price: 1 });
  });

  afterAll(() => {
    closeDb(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists expiring batches sorted by expiry, expired first", () => {
    const items = listExpiring(db.db, 90);
    expect(items).toHaveLength(2);
    expect(items[0].batch_id).toBe("b3"); // expired yesterday
    expect(items[0].status).toBe("expired");
    expect(items[1].batch_id).toBe("b1"); // 10 days
    expect(items[1].status).toBe("critical");
  });

  it("produces actionable suggestions", () => {
    const sugg = getInventorySuggestions(db.db);

    const expired = sugg.find((s) => s.kind === "expired");
    expect(expired?.product_id).toBe("p2");
    expect(expired?.severity).toBe("high");

    const near = sugg.find((s) => s.kind === "near_expiry");
    expect(near?.product_id).toBe("p1");
    expect(near?.severity).toBe("high"); // <= 30 days is critical/high

    const low = sugg.find((s) => s.kind === "low_stock");
    expect(low?.product_id).toBe("p3");

    const over = sugg.find((s) => s.kind === "overstock");
    expect(over?.product_id).toBe("p4");

    // High-severity items come first.
    expect(sugg[0].severity).toBe("high");
  });
});
