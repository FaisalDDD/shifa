// Sync engine: pulls the product catalog from Supabase into the local DB and
// pushes queued offline changes (sales -> inventory decrements) back up.

import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { all, get, getMeta, run, setMeta } from "./db";
import { postgrest } from "./supabase";
import type { CatalogEntry, FinancialPeriodClose, InventoryException, Product, ReconciliationResult, SyncStatus } from "../shared/types";
import { applySyncedFinancialEvent, pullDailyRates, pullFinancialPeriods, pullRateAudit, type FinancialEvent, type FinancialPeriodEvent } from "./financial";

const PRODUCT_SELECT =
  "id,canonical_name,brand_name,strength,dosage_form,barcode,image_url,prescription_classification";

interface ProductRow {
  id: string;
  canonical_name: string;
  brand_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  barcode: string | null;
  image_url: string | null;
  prescription_classification: string;
}

/** Pull the product catalog into the local DB. Returns the number of products. */
export async function pullProducts(db: Database): Promise<number> {
  const rows = await postgrest<ProductRow[]>(
    `products?select=${PRODUCT_SELECT}&order=canonical_name&limit=2000`,
  );

  for (const p of rows) {
    run(
      db,
      `INSERT INTO products
         (id, canonical_name, brand_name, strength, dosage_form, barcode, image_url, prescription_classification)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         canonical_name = excluded.canonical_name,
         brand_name = excluded.brand_name,
         strength = excluded.strength,
         dosage_form = excluded.dosage_form,
         barcode = excluded.barcode,
         image_url = excluded.image_url,
         prescription_classification = excluded.prescription_classification`,
      [
        p.id,
        p.canonical_name,
        p.brand_name,
        p.strength,
        p.dosage_form,
        p.barcode,
        p.image_url,
        p.prescription_classification,
      ],
    );
  }

  setMeta(db, "last_pull_at", new Date().toISOString());
  return rows.length;
}

/** Pull the shared pharmacy's append-only finance ledger and daily report rates. */
export async function pullFinancialData(db: Database, token: string, pharmacyId: string): Promise<number> {
  const [events, rates, rateEvents, periods] = await Promise.all([
    postgrest<{ payload: FinancialEvent }[]>(`pharmacy_financial_events?pharmacy_id=eq.${pharmacyId}&select=payload&order=created_at.asc&limit=10000`, { token }),
    postgrest<{ business_date: string; sdg_per_usd: number; updated_at: string }[]>(
      `pharmacy_daily_exchange_rates?pharmacy_id=eq.${pharmacyId}&select=business_date,sdg_per_usd,updated_at&limit=5000`, { token }),
    postgrest<{ id: string; business_date: string; sdg_per_usd: number; created_at: string; created_by: string | null }[]>(
      `pharmacy_exchange_rate_events?pharmacy_id=eq.${pharmacyId}&select=id,business_date,sdg_per_usd,created_at,created_by&limit=10000`, { token }),
    postgrest<(Omit<FinancialPeriodClose, "snapshot_json"> & { snapshot_json: unknown })[]>(`pharmacy_financial_periods?pharmacy_id=eq.${pharmacyId}&select=id,period_start,period_end,closed_at,closed_by,snapshot_json,reopened_at,reopened_by,reopen_reason&limit=1000`, { token }),
  ]);
  for (const event of events) applySyncedFinancialEvent(db, event.payload);
  const normalizedPeriods = periods.map(period => ({ ...period,
    snapshot_json: typeof period.snapshot_json === "string" ? period.snapshot_json : JSON.stringify(period.snapshot_json),
  })) as FinancialPeriodClose[];
  return events.length + pullDailyRates(db, rates) + pullRateAudit(db, rateEvents) + pullFinancialPeriods(db, normalizedPeriods);
}

/** List catalog joined with local stock, optionally filtered by name. */
export function listProducts(db: Database, query = ""): CatalogEntry[] {
  const like = `%${query}%`;
  return all<CatalogEntry>(
    db,
    `SELECT p.id, p.canonical_name, p.brand_name, p.strength, p.dosage_form,
            p.barcode, p.image_url, p.prescription_classification,
            COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= date('now','localtime') THEN b.quantity ELSE 0 END), 0) AS stock,
            COALESCE(p.price, (SELECT b2.sale_price FROM batches b2
              WHERE b2.product_id = p.id AND b2.sale_price IS NOT NULL
              ORDER BY b2.rowid DESC LIMIT 1)) AS price
     FROM products p
     LEFT JOIN batches b ON b.product_id = p.id
     WHERE p.canonical_name LIKE ? OR p.brand_name LIKE ?
     GROUP BY p.id
     ORDER BY p.canonical_name
     LIMIT 200`,
    [like, like],
  );
}

/** Set a product's default selling price (admin). Overrides batch sale_price. */
export function setProductPrice(
  db: Database,
  productId: string,
  price: number,
  actorId: string | null = null,
): void {
  if (!Number.isFinite(price) || price <= 0) throw new Error("Product prices must be greater than zero SDG.");
  const previous = get<{ price: number | null; canonical_name: string }>(db,
    `SELECT price,canonical_name FROM products WHERE id=?`, [productId]);
  if (!previous) throw new Error("Product was not found.");
  run(db, `UPDATE products SET price = ? WHERE id = ?`, [price, productId]);
  run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
    VALUES(?, 'product_price_set', 'product', ?, ?, ?, ?)`,
  [randomUUID(), productId, JSON.stringify({ product: previous.canonical_name, old_price: previous.price, new_price: price }), new Date().toISOString(), actorId]);
}

interface QueueRow {
  id: number;
  entity: string;
  op: string;
  payload: string;
  synced_at: string | null;
}

interface InventoryRow {
  product_id: string;
  quantity: number | null;
}

/**
 * Push unsynced sale ops: for each sold line, decrement the pharmacy's
 * inventory row so Shifa reflects the live stock. Requires the pharmacy's
 * Supabase id and the signed-in user's JWT (RLS enforces membership).
 */
export async function pushQueue(
  db: Database,
  token: string,
  pharmacyId: string,
): Promise<{ pushed: number; failed: number }> {
  const pending = all<QueueRow>(
    db,
    `SELECT id, entity, op, payload, synced_at FROM sync_queue
     WHERE synced_at IS NULL ORDER BY id`,
  );

  let pushed = 0;
  let failed = 0;

  for (const q of pending) {
    try {
      if (q.entity === "exchange_rate" && q.op === "set") {
        const rate = JSON.parse(q.payload) as { event_id: string; business_date: string; sdg_per_usd: number };
        await postgrest("rpc/set_pharmacy_daily_exchange_rate", { token, method: "POST", body: {
          p_pharmacy_id: pharmacyId, p_event_id: rate.event_id,
          p_business_date: rate.business_date, p_sdg_per_usd: rate.sdg_per_usd,
        } });
      } else if (q.entity === "financial_period" && q.op === "apply") {
        const event = JSON.parse(q.payload) as FinancialPeriodEvent;
        if (!event.event_id || !event.period?.id) throw new Error("Financial period event has no idempotency key.");
        await postgrest("rpc/apply_pharmacy_financial_period_event", { token, method: "POST", body: {
          p_pharmacy_id: pharmacyId, p_event_id: event.event_id, p_payload: event,
        } });
      } else if (q.entity === "financial_event" && q.op === "append") {
        const event = JSON.parse(q.payload) as FinancialEvent;
        if (!event.event_id || !event.journal?.id) throw new Error("Financial event has no idempotency key.");
        await postgrest("rpc/apply_pharmacy_financial_event", { token, method: "POST", body: {
          p_pharmacy_id: pharmacyId,
          p_event_id: event.event_id,
          p_event_type: event.event_type,
          p_payload: event,
        } });
      } else if ((q.entity === "sale" && q.op === "create") || q.entity === "inventory_event") {
        const legacy = q.entity === "sale";
        const payload = JSON.parse(q.payload) as {
          sale_id?: string; event_id?: string; event_type?: string;
          lines: { product_id: string; quantity?: number; quantity_delta?: number; batch_id?: string | null;
            unit_price?: number; unit_cost?: number | null }[];
        };
        const eventId = payload.event_id ?? payload.sale_id;
        if (!eventId) throw new Error("Inventory event has no idempotency key.");
        await postgrest("rpc/apply_pharmacy_inventory_event", {
          token, method: "POST", body: {
            p_pharmacy_id: pharmacyId,
            p_event_id: eventId,
            p_event_type: payload.event_type ?? "sale",
            p_payload: {
              ...payload,
              lines: payload.lines.map(line => ({ ...line,
                quantity_delta: line.quantity_delta ?? (legacy ? -Number(line.quantity ?? 0) : 0),
              })),
            },
          },
        });
      } else {
        throw new Error(`Unsupported queued operation: ${q.entity}/${q.op}`);
      }
      run(db, `UPDATE sync_queue SET synced_at = ? WHERE id = ?`, [
        new Date().toISOString(),
        q.id,
      ]);
      pushed++;
    } catch {
      failed++;
    }
  }

  return { pushed, failed };
}

export async function reconcileInventory(
  db: Database, token: string, pharmacyId: string,
): Promise<ReconciliationResult> {
  const remote = await postgrest<InventoryRow[]>(
    `pharmacy_inventory?pharmacy_id=eq.${pharmacyId}&select=product_id,quantity&limit=5000`, { token });
  const remoteByProduct = new Map(remote.map(row => [row.product_id, row.quantity]));
  const localRows = all<{ product_id: string; quantity: number }>(db,
    `SELECT product_id, COALESCE(SUM(quantity), 0) AS quantity FROM batches GROUP BY product_id`);
  const localByProduct = new Map(localRows.map(row => [row.product_id, row.quantity]));
  const ids = new Set([...remoteByProduct.keys(), ...localByProduct.keys()]);
  const open: InventoryException[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();
  for (const productId of ids) {
    const hasRemote = remoteByProduct.has(productId);
    const local = localByProduct.get(productId) ?? 0;
    const shared = remoteByProduct.get(productId) ?? null;
    if (hasRemote && shared !== null && local === shared) continue;
    const key = `balance:${productId}`;
    seen.add(key);
    const detail = hasRemote
      ? shared === null ? `Shared quantity is unknown; local lot balance is ${local}.` : `Local lot balance ${local} differs from shared balance ${shared}.`
      : `Local lot balance ${local} has no shared inventory row.`;
    const id = `recon-${productId}`;
    run(db, `INSERT INTO inventory_exceptions
      (id, exception_key, kind, product_id, expected_quantity, actual_quantity, details, detected_at, resolved_at)
      VALUES (?, ?, 'balance_mismatch', ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(exception_key) DO UPDATE SET expected_quantity=excluded.expected_quantity,
        actual_quantity=excluded.actual_quantity, details=excluded.details, detected_at=excluded.detected_at,
        resolved_at=NULL`, [id, key, productId, local, hasRemote ? shared : null, detail, now]);
    open.push({ id, kind: "balance_mismatch", product_id: productId, expected_quantity: local,
      actual_quantity: hasRemote ? shared : null, details: detail, detected_at: now });
  }
  const existing = all<{ exception_key: string; id: string }>(db,
    `SELECT exception_key, id FROM inventory_exceptions WHERE kind='balance_mismatch' AND resolved_at IS NULL`);
  for (const exception of existing) {
    if (!seen.has(exception.exception_key)) run(db,
      `UPDATE inventory_exceptions SET resolved_at=? WHERE id=?`, [now, exception.id]);
  }
  return { compared: ids.size, exceptions: open };
}

export async function getSyncStatus(
  db: Database,
  connected: boolean,
): Promise<SyncStatus> {
  const pending = get<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM sync_queue WHERE synced_at IS NULL`,
  );
  const products = get<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM products`,
  );
  return {
    connected,
    last_pull_at: getMeta(db, "last_pull_at"),
    pending_ops: pending ? pending.n : 0,
    product_count: products ? products.n : 0,
  };
}
