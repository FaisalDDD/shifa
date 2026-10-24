import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { all, get, run } from "./db";

export type PriceScope = "all" | "otc" | "prescription" | "unknown";
export interface PricePreviewRow { product_id: string; name: string; old_price: number; new_price: number; change_percent: number }

function scopedProducts(db: Database, scope: PriceScope) {
  if (!["all", "otc", "prescription", "unknown"].includes(scope)) throw new Error("Choose a valid product group.");
  return all<{ id: string; canonical_name: string; price: number | null }>(db,
    `SELECT p.id,p.canonical_name,COALESCE(p.price,
      (SELECT b.sale_price FROM batches b WHERE b.product_id=p.id AND b.sale_price IS NOT NULL
       ORDER BY b.rowid DESC LIMIT 1)) AS price
     FROM products p ${scope === "all" ? "" : "WHERE p.prescription_classification=?"} ORDER BY p.canonical_name`,
    scope === "all" ? [] : [scope]);
}

function calculate(db: Database, scope: PriceScope, percent: number): PricePreviewRow[] {
  if (!Number.isFinite(percent) || percent < -90 || percent > 500) throw new Error("Use a price change from -90% to +500%.");
  return scopedProducts(db, scope).filter(p => p.price !== null && Number.isFinite(p.price) && p.price > 0).map(p => {
    const next = Math.round((p.price! * (1 + percent / 100)) * 100) / 100;
    if (next <= 0) throw new Error(`${p.canonical_name} would have a zero or negative price.`);
    return { product_id: p.id, name: p.canonical_name, old_price: p.price!, new_price: next,
      change_percent: Math.round((next / p.price! - 1) * 10000) / 100 };
  });
}

export function previewPriceAdjustment(db: Database, scope: PriceScope, percent: number): PricePreviewRow[] {
  return calculate(db, scope, percent);
}

export function latestPriceAdjustment(db: Database): { id: string; count: number } | null {
  return get<{ id: string; count: number }>(db,
    `SELECT b.id,COUNT(i.product_id) AS count FROM price_adjustment_batches b
      JOIN price_adjustment_items i ON i.batch_id=b.id WHERE b.status='applied'
      GROUP BY b.id ORDER BY b.created_at DESC LIMIT 1`) ?? null;
}

export function applyPriceAdjustment(db: Database, scope: PriceScope, percent: number, reason: string, actorId: string | null): { id: string; count: number } {
  const explanation = reason.trim();
  if (explanation.length < 5 || explanation.length > 240) throw new Error("Add a reason between 5 and 240 characters.");
  const rows = calculate(db, scope, percent);
  if (!rows.length) throw new Error("No products with a current price match this adjustment.");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.run("BEGIN");
  try {
    run(db, `INSERT INTO price_adjustment_batches(id,reason,status,created_at,created_by) VALUES(?,?,'applied',?,?)`, [id, explanation, now, actorId]);
    for (const row of rows) {
      // Preview uses effective price; rollback must restore the nullable override,
      // not freeze the batch fallback as an explicit product price.
      const original = get<{ price: number | null }>(db, `SELECT price FROM products WHERE id=?`, [row.product_id])!;
      run(db, `INSERT INTO price_adjustment_items(batch_id,product_id,old_price,new_price) VALUES(?,?,?,?)`, [id, row.product_id, original.price, row.new_price]);
      run(db, `UPDATE products SET price=? WHERE id=?`, [row.new_price, row.product_id]);
    }
    run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
      VALUES(?, 'bulk_price_adjustment', 'price_adjustment', ?, ?, ?, ?)`,
    [randomUUID(), id, JSON.stringify({ scope, percent, count: rows.length, reason: explanation }), now, actorId]);
    db.run("COMMIT");
  } catch (error) { db.run("ROLLBACK"); throw error; }
  return { id, count: rows.length };
}

export function rollbackPriceAdjustment(db: Database, id: string, actorId: string | null): number {
  const batch = get<{ id: string; status: string; reason: string }>(db,
    `SELECT id,status,reason FROM price_adjustment_batches WHERE id=?`, [id]);
  if (!batch || batch.status !== "applied") throw new Error("That price adjustment is already rolled back or was not found.");
  const items = all<{ product_id: string; old_price: number | null; new_price: number; current_price: number | null }>(db,
    `SELECT i.product_id,i.old_price,i.new_price,p.price AS current_price FROM price_adjustment_items i
      JOIN products p ON p.id=i.product_id WHERE i.batch_id=?`, [id]);
  if (items.some(item => item.current_price === null || Math.abs(item.current_price - item.new_price) >= 0.005)) {
    throw new Error("Some affected prices have changed since this adjustment. Review them manually before rolling back.");
  }
  const now = new Date().toISOString();
  db.run("BEGIN");
  try {
    for (const item of items) run(db, `UPDATE products SET price=? WHERE id=?`, [item.old_price, item.product_id]);
    run(db, `UPDATE price_adjustment_batches SET status='rolled_back' WHERE id=?`, [id]);
    run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
      VALUES(?, 'bulk_price_rollback', 'price_adjustment', ?, ?, ?, ?)`,
    [randomUUID(), id, JSON.stringify({ reason: batch.reason, count: items.length }), now, actorId]);
    db.run("COMMIT");
  } catch (error) { db.run("ROLLBACK"); throw error; }
  return items.length;
}
