// Live smoke test: talks to the real local Supabase stack (must be running via
// `supabase start`) and exercises the offline engine end-to-end.
// Pull catalog -> receive a batch -> sell FEFO -> persist -> verify sync queue.

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, openDb, type LocalDb } from "../../src/main/db";
import { listProducts, pullProducts, getSyncStatus } from "../../src/main/sync";
import { recordSale, upsertBatch } from "../../src/main/stock";

describe("smoke: live Supabase + offline engine", () => {
  it("pulls the real catalog, records an offline sale, persists", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "shifa-smoke-"));
    const db: LocalDb = await openDb(path.join(dir, "smoke.db"));

    try {
      const count = await pullProducts(db.db);
      expect(count).toBeGreaterThan(0);

      const catalog = listProducts(db.db);
      expect(catalog.length).toBeGreaterThan(0);

      const first = catalog[0];
      upsertBatch(db.db, {
        id: "smoke-batch",
        product_id: first.id,
        lot_no: "SMOKE",
        expiry_date: "2027-12-31",
        quantity: 5,
        cost_price: 3,
      });

      const sale = recordSale(db.db, [
        { product_id: first.id, quantity: 2, unit_price: 10 },
      ]);
      expect(sale.total).toBe(20);

      const status = await getSyncStatus(db.db, true);
      expect(status.product_count).toBeGreaterThan(0);
      expect(status.pending_ops).toBe(1);
      expect(status.last_pull_at).not.toBeNull();
    } finally {
      closeDb(db);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
