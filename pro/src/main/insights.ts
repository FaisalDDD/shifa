// Smart inventory insights: near-expiry list + actionable suggestions.
// Drives the "Expiry" tab so a pharmacist sees at a glance what to discount,
// reorder, write off, or promote. FEFO already sells soonest-expiry first at the
// till; these rules add the proactive layer on top.

import type { Database } from "sql.js";
import { all } from "./db";
import type { ExpiryItem, InventorySuggestion } from "../shared/types";

export const EXPIRY_WARNING_DAYS = 90;
export const EXPIRY_CRITICAL_DAYS = 30;
export const LOW_STOCK_THRESHOLD = 5;
export const OVERSTOCK_THRESHOLD = 100;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysFromNow(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(`${dateISO}T00:00:00`);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

/** Batches with stock that expire within `days` (or are already expired). */
export function listExpiring(
  db: Database,
  days = EXPIRY_WARNING_DAYS,
): ExpiryItem[] {
  const cutoff = iso(new Date(Date.now() + days * 86400000));
  const rows = all<{
    batch_id: string;
    product_id: string;
    product_name: string;
    lot_no: string;
    quantity: number;
    expiry_date: string;
  }>(
    db,
    `SELECT b.id AS batch_id, b.product_id, b.lot_no, b.quantity, b.expiry_date,
            COALESCE(p.canonical_name, b.product_id) AS product_name
     FROM batches b
     LEFT JOIN products p ON p.id = b.product_id
     WHERE b.quantity > 0 AND b.expiry_date IS NOT NULL AND b.expiry_date <= ?
     ORDER BY b.expiry_date ASC`,
    [cutoff],
  );
  return rows.map((r) => {
    const daysLeft = daysFromNow(r.expiry_date);
    const status: ExpiryItem["status"] =
      daysLeft < 0
        ? "expired"
        : daysLeft <= EXPIRY_CRITICAL_DAYS
          ? "critical"
          : "soon";
    return { ...r, days_left: daysLeft, status };
  });
}

/** Actionable inventory suggestions, highest severity first. */
export function getInventorySuggestions(db: Database): InventorySuggestion[] {
  const out: InventorySuggestion[] = [];
  const today = iso(new Date());
  const critical = iso(
    new Date(Date.now() + EXPIRY_CRITICAL_DAYS * 86400000),
  );
  const warning = iso(
    new Date(Date.now() + EXPIRY_WARNING_DAYS * 86400000),
  );

  const expired = all<{
    product_name: string;
    product_id: string;
    qty: number;
    expiry_date: string;
  }>(
    db,
    `SELECT COALESCE(p.canonical_name, b.product_id) AS product_name, b.product_id,
            SUM(b.quantity) AS qty, MIN(b.expiry_date) AS expiry_date
     FROM batches b LEFT JOIN products p ON p.id = b.product_id
     WHERE b.quantity > 0 AND b.expiry_date IS NOT NULL AND b.expiry_date < ?
     GROUP BY b.product_id, p.canonical_name`,
    [today],
  );
  for (const r of expired) {
    out.push({
      kind: "expired",
      product_id: r.product_id,
      product_name: r.product_name,
      severity: "high",
      message: `${r.qty} unit(s) of ${r.product_name} are expired (since ${r.expiry_date}) — write off and remove from shelves.`,
    });
  }

  const near = all<{
    product_name: string;
    product_id: string;
    qty: number;
    expiry_date: string;
  }>(
    db,
    `SELECT COALESCE(p.canonical_name, b.product_id) AS product_name, b.product_id,
            SUM(b.quantity) AS qty, MIN(b.expiry_date) AS expiry_date
     FROM batches b LEFT JOIN products p ON p.id = b.product_id
     WHERE b.quantity > 0 AND b.expiry_date IS NOT NULL
       AND b.expiry_date >= ? AND b.expiry_date <= ?
     GROUP BY b.product_id, p.canonical_name`,
    [today, warning],
  );
  for (const r of near) {
    const severe = r.expiry_date <= critical;
    out.push({
      kind: "near_expiry",
      product_id: r.product_id,
      product_name: r.product_name,
      severity: severe ? "high" : "medium",
      message: `${r.qty} unit(s) of ${r.product_name} expire ${r.expiry_date} — sell first (FEFO) or discount to move them.`,
    });
  }

  const low = all<{
    product_name: string;
    product_id: string;
    qty: number;
  }>(
    db,
    `SELECT COALESCE(p.canonical_name, b.product_id) AS product_name, b.product_id,
            SUM(b.quantity) AS qty
     FROM batches b LEFT JOIN products p ON p.id = b.product_id
     WHERE b.quantity > 0 AND (b.expiry_date IS NULL OR b.expiry_date >= ?)
     GROUP BY b.product_id, p.canonical_name
     HAVING SUM(b.quantity) <= ?`,
    [today, LOW_STOCK_THRESHOLD],
  );
  for (const r of low) {
    out.push({
      kind: "low_stock",
      product_id: r.product_id,
      product_name: r.product_name,
      severity: "medium",
      message: `${r.product_name} is low (${r.qty} left) — reorder before it sells out.`,
    });
  }

  const over = all<{
    product_name: string;
    product_id: string;
    qty: number;
  }>(
    db,
    `SELECT COALESCE(p.canonical_name, b.product_id) AS product_name, b.product_id,
            SUM(b.quantity) AS qty
     FROM batches b LEFT JOIN products p ON p.id = b.product_id
     WHERE b.quantity > 0 AND (b.expiry_date IS NULL OR b.expiry_date >= ?)
     GROUP BY b.product_id, p.canonical_name
     HAVING SUM(b.quantity) >= ?`,
    [today, OVERSTOCK_THRESHOLD],
  );
  for (const r of over) {
    out.push({
      kind: "overstock",
      product_id: r.product_id,
      product_name: r.product_name,
      severity: "info",
      message: `${r.product_name} is overstocked (${r.qty} units) — consider a return or bulk promotion.`,
    });
  }

  const slow = all<{
    product_name: string;
    product_id: string;
    qty: number;
  }>(
    db,
    `SELECT COALESCE(p.canonical_name, b.product_id) AS product_name, b.product_id,
            SUM(b.quantity) AS qty
     FROM batches b LEFT JOIN products p ON p.id = b.product_id
     WHERE b.quantity > 0 AND (b.expiry_date IS NULL OR b.expiry_date >= ?)
       AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.product_id = b.product_id)
     GROUP BY b.product_id, p.canonical_name`,
    [today],
  );
  for (const r of slow) {
    out.push({
      kind: "slow_mover",
      product_id: r.product_id,
      product_name: r.product_name,
      severity: "info",
      message: `${r.product_name} has ${r.qty} unit(s) in stock but no recorded sales — consider promoting or discontinuing.`,
    });
  }

  const order = { high: 0, medium: 1, info: 2 } as const;
  out.sort((a, b) => order[a.severity] - order[b.severity]);
  return out;
}
