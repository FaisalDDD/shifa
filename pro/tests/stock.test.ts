import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { all, closeDb, openDb, persist, type LocalDb } from "../src/main/db";
import {
  allocateFefo,
  availableForProduct,
  recordSale,
  receiveBatch,
} from "../src/main/stock";

describe("allocateFefo", () => {
  it("consumes soonest-expiring batches first", () => {
    const { allocations } = allocateFefo(
      [
        { batch_id: "a", quantity: 10, expiry_date: "2027-01-01" },
        { batch_id: "b", quantity: 10, expiry_date: "2026-06-01" },
        { batch_id: "c", quantity: 10, expiry_date: null },
      ],
      15,
    );
    expect(allocations).toEqual([
      { batch_id: "b", quantity: 10 },
      { batch_id: "a", quantity: 5 },
    ]);
  });

  it("sends no-expiry batches last", () => {
    const { allocations } = allocateFefo(
      [
        { batch_id: "x", quantity: 5, expiry_date: "2026-01-01" },
        { batch_id: "y", quantity: 99, expiry_date: null },
      ],
      10,
    );
    expect(allocations).toEqual([
      { batch_id: "x", quantity: 5 },
      { batch_id: "y", quantity: 5 },
    ]);
  });

  it("returns the shortfall when stock is insufficient", () => {
    const { allocations, short_by } = allocateFefo(
      [{ batch_id: "a", quantity: 2, expiry_date: null }],
      5,
    );
    expect(allocations).toEqual([{ batch_id: "a", quantity: 2 }]);
    expect(short_by).toBe(3);
  });

  it("rejects non-positive quantities", () => {
    expect(() => allocateFefo([], 0)).toThrow(/greater than zero/);
  });
});

describe("recordSale (offline DB)", () => {
  let dir: string;
  let db: LocalDb;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "shifa-pro-test-"));
    db = await openDb(path.join(dir, "test.db"));
  });

  afterAll(() => {
    closeDb(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("decrements FEFO and enqueues a sync op", () => {
    const b1 = receiveBatch(db.db, {
      product_id: "p1",
      lot_no: "L1",
      expiry_date: "2098-06-01",
      quantity: 10,
      unit_cost: 5,
    });
    const b2 = receiveBatch(db.db, {
      product_id: "p1",
      lot_no: "L2",
      expiry_date: "2099-01-01",
      quantity: 10,
      unit_cost: 6,
    });

    const beforeQueue = all<{ id: number }>(db.db, `SELECT id FROM sync_queue`).map(r => r.id);
    const sale = recordSale(db.db, [
      { product_id: "p1", quantity: 12, unit_price: 8 },
    ]);

    expect(sale.lines).toHaveLength(2);
    expect(sale.lines[0]).toMatchObject({ batch_id: b1, quantity: 10 });
    expect(sale.lines[1]).toMatchObject({ batch_id: b2, quantity: 2 });
    expect(sale.total).toBe(96);
    expect(sale.flagged).toBe(false);
    expect(availableForProduct(db.db, "p1")).toBe(8);

    const pending = all<{ id: number; entity: string; payload: string }>(
      db.db,
      `SELECT id,entity,payload FROM sync_queue WHERE synced_at IS NULL`,
    );
    const saleEvents = pending.filter(r => !beforeQueue.includes(r.id));
    expect(saleEvents.map(r => r.entity).sort()).toEqual(["financial_event", "sale"]);
    expect(JSON.parse(saleEvents.find(r => r.entity === "sale")!.payload).sale_id).toBe(sale.sale_id);
    expect(JSON.parse(saleEvents.find(r => r.entity === "financial_event")!.payload).journal.source_id).toBe(sale.sale_id);
  });

  it("persists across close/reopen", async () => {
    persist(db);
    const reopened = await openDb(path.join(dir, "test.db"));
    expect(availableForProduct(reopened.db, "p1")).toBe(8);
    closeDb(reopened);
  });

  it("rolls back all sale effects on shortage, including an earlier allocated cart line", () => {
    const snapshot = () => Object.fromEntries([
      "batches", "sales", "sale_items", "inventory_movements", "financial_cost_layers",
      "financial_journals", "financial_journal_lines", "sync_queue", "customer_ledger",
    ].map(table => [table, all(db.db, `SELECT * FROM ${table}`)]));
    const before = snapshot();
    expect(() => recordSale(db.db, [
      { product_id: "p1", quantity: 1, unit_price: 1 },
      { product_id: "p1", quantity: 999, unit_price: 1 },
    ])).toThrow(/not enough saleable stock/);
    expect(availableForProduct(db.db, "p1")).toBe(8);
    expect(snapshot()).toEqual(before);
  });
});
