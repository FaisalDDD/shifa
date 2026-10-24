// Stock engine: FEFO batch allocation + offline sale recording.
// FEFO = First-Expiry-First-Out. Batches expiring soonest are consumed first so
// stock near its expiry date leaves the shelf before fresher stock.

import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { all, get, run } from "./db";
import { recordPurchase } from "./purchases";
import { consumeFifoCost, postJournal, receiveFinancialCostLayer, toMinorUnits } from "./financial";
import type {
  CartLine,
  SaleResult,
  StockLevel,
} from "../shared/types";

interface BatchRow {
  id: string;
  quantity: number;
  expiry_date: string | null;
  cost_price: number | null;
}

function businessDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface BatchAllocation {
  batch_id: string;
  quantity: number;
}

export interface FefoResult {
  allocations: BatchAllocation[];
  short_by: number;
}

/**
 * Pure FEFO allocation. Earliest expiry first, with undated batches last.
 */
export function allocateFefo(
  batches: { batch_id: string; quantity: number; expiry_date: string | null }[],
  requested: number,
): FefoResult {
  if (requested <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const sorted = [...batches].sort((a, b) => {
    if (a.expiry_date === b.expiry_date) return 0;
    if (a.expiry_date === null) return 1;
    if (b.expiry_date === null) return -1;
    return a.expiry_date < b.expiry_date ? -1 : 1;
  });

  let remaining = requested;
  const allocations: BatchAllocation[] = [];
  for (const b of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    if (take > 0) {
      allocations.push({ batch_id: b.batch_id, quantity: take });
      remaining -= take;
    }
  }

  return { allocations, short_by: Math.max(0, remaining) };
}

function productName(db: Database, productId: string): string {
  const row = get<{ canonical_name: string }>(
    db,
    `SELECT canonical_name FROM products WHERE id = ?`,
    [productId],
  );
  return row ? row.canonical_name : productId;
}

/**
 * Record a sale offline: decrements batches (FEFO), writes the sale + line
 * items, and enqueues a sync operation for later push to Supabase.
 *
 * Expired lots and short stock are rejected. The whole operation, including
 * movement ledger and sync event, commits or rolls back together.
 */
export function recordSale(
  db: Database,
  lines: CartLine[],
  opts?: { customer_id?: string | null; payment_method?: string | null; actor_id?: string | null; due_date?: string | null },
): SaleResult {
  const saleId = randomUUID();
  const saleNo = `S-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const createdAt = now.toISOString();
  const date = businessDate(now);
  const paymentMethod = opts?.payment_method ?? "cash";
  if (!["cash", "bank", "later"].includes(paymentMethod)) throw new Error("Choose cash, bank, or pay later.");
  if (paymentMethod === "later" && !opts?.customer_id) throw new Error("Choose a customer before recording a credit sale.");
  const dueDateObj = new Date(now);
  dueDateObj.setDate(dueDateObj.getDate() + 30);
  const defaultDueDate = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, "0")}-${String(dueDateObj.getDate()).padStart(2, "0")}`;
  const dueDate = opts?.due_date ?? defaultDueDate;
  if (paymentMethod === "later" && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))) {
    throw new Error("Choose a valid credit due date.");
  }

  const allocations: {
    product_id: string;
    batch_id: string;
    quantity: number;
    unit_price: number;
    unit_cost: number | null;
  }[] = [];

  db.run("BEGIN");
  try {
    if (!lines.length) throw new Error("Add at least one item to the sale.");
    for (const requestedLine of lines) {
      const line = { ...requestedLine, unit_price: toMinorUnits(requestedLine.unit_price) / 100 };
      if (!Number.isInteger(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unit_price) || line.unit_price < 0) {
        throw new Error("Sale quantities must be positive whole numbers and prices cannot be negative.");
      }
      const batches = all<BatchRow>(
        db,
        `SELECT id, quantity, expiry_date, cost_price FROM batches
         WHERE product_id = ? AND quantity > 0
           AND (expiry_date IS NULL OR expiry_date >= ?)
         ORDER BY expiry_date ASC`,
        [line.product_id, date],
      );
      const { allocations: allocated, short_by } = allocateFefo(
        batches.map((b) => ({
          batch_id: b.id,
          quantity: b.quantity,
          expiry_date: b.expiry_date,
        })),
        line.quantity,
      );

      if (short_by > 0) {
        const total = batches.reduce((sum, b) => sum + b.quantity, 0);
        const expired = get<{ n: number }>(db,
          `SELECT COALESCE(SUM(quantity), 0) AS n FROM batches
           WHERE product_id = ? AND quantity > 0 AND expiry_date < ?`,
          [line.product_id, date])?.n ?? 0;
        throw new Error(`${productName(db, line.product_id)}: not enough saleable stock (available ${total}; expired ${expired}; requested ${line.quantity}).`);
      }

      for (const a of allocated) {
        const batch = batches.find((b) => b.id === a.batch_id)!;
        run(db, `UPDATE batches SET quantity = quantity - ? WHERE id = ?`, [
          a.quantity,
          a.batch_id,
        ]);
        run(
          db,
          `INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, unit_cost_at_sale)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [saleId, line.product_id, a.batch_id, a.quantity, line.unit_price, batch.cost_price],
        );
        run(db, `INSERT INTO inventory_movements
          (id, event_id, movement_type, product_id, batch_id, sale_id, quantity_delta, unit_cost, created_at)
          VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), saleId, line.product_id, a.batch_id, saleId, -a.quantity, batch.cost_price, createdAt]);
        allocations.push({
          product_id: line.product_id,
          batch_id: a.batch_id,
          quantity: a.quantity,
          unit_price: line.unit_price,
          unit_cost: batch.cost_price,
        });
      }
    }

    const totalMinor = allocations.reduce((sum, line) => sum + toMinorUnits(line.quantity * line.unit_price), 0);
    const total = totalMinor / 100;
    run(
      db,
      `INSERT INTO sales (id, sale_no, total, status, customer_id, payment_method, flagged, created_at, business_date, currency)
       VALUES (?, ?, ?, 'completed', ?, ?, 0, ?, ?, 'SDG')`,
      [
        saleId,
        saleNo,
        total,
        opts?.customer_id ?? null,
        paymentMethod,
        createdAt,
        date,
      ],
    );
    if (paymentMethod === "later" && opts?.customer_id) {
      run(db, `INSERT INTO customer_ledger(id,customer_id,amount,note,created_at)
        VALUES(?,?,?,?,?)`, [randomUUID(), opts.customer_id, total, `Credit sale ${saleNo}`, createdAt]);
      run(db, `INSERT INTO customer_credit_invoices(sale_id,customer_id,total_minor,paid_minor,due_date,created_at)
        VALUES(?,?,?,0,?,?)`, [saleId, opts.customer_id, totalMinor, dueDate, createdAt]);
    }

    const quantityByProduct = new Map<string, number>();
    for (const line of allocations) quantityByProduct.set(line.product_id,
      (quantityByProduct.get(line.product_id) ?? 0) + line.quantity);
    let knownCogsMinor = 0;
    let costingComplete = true;
    for (const [productId, quantity] of quantityByProduct) {
      const cost = consumeFifoCost(db, productId, quantity);
      knownCogsMinor += cost.known_cost_minor;
      costingComplete = costingComplete && cost.complete;
      const saleRows = all<{ id: number; quantity: number }>(db,
        `SELECT id,quantity FROM sale_items WHERE sale_id=? AND product_id=? ORDER BY id`, [saleId, productId]);
      let allocationIndex = 0;
      let allocationRemaining = cost.allocations[0]?.quantity ?? 0;
      for (const saleRow of saleRows) {
        let rowRemaining = saleRow.quantity;
        let rowKnownCostMinor = 0;
        let rowComplete = true;
        while (rowRemaining > 0) {
          const allocation = cost.allocations[allocationIndex];
          if (!allocation) {
            rowComplete = false;
            break;
          }
          const take = Math.min(rowRemaining, allocationRemaining);
          if (allocation.unit_cost_minor === null) rowComplete = false;
          else rowKnownCostMinor += take * allocation.unit_cost_minor;
          rowRemaining -= take;
          allocationRemaining -= take;
          if (allocationRemaining === 0) {
            allocationIndex++;
            allocationRemaining = cost.allocations[allocationIndex]?.quantity ?? 0;
          }
        }
        if (rowRemaining > 0) rowComplete = false;
        run(db, `UPDATE sale_items SET accounting_cost_minor=?,accounting_cost_method='fifo' WHERE id=?`,
          [rowComplete ? rowKnownCostMinor : null, saleRow.id]);
      }
      if (saleRows.reduce((sum, row) => sum + row.quantity, 0) !== quantity) costingComplete = false;
    }
    const receiptAccount = paymentMethod === "later" ? "accounts_receivable" : paymentMethod === "bank" ? "bank" : "cash_on_hand";
    const journalLines = [
      { account_code: receiptAccount, debit_minor: totalMinor, memo: `Sale ${saleNo}` },
      { account_code: "sales_revenue", credit_minor: totalMinor, memo: `Sale ${saleNo}` },
      ...(knownCogsMinor > 0 ? [
        { account_code: "cost_of_goods_sold", debit_minor: knownCogsMinor },
        { account_code: "inventory", credit_minor: knownCogsMinor },
      ] : []),
    ];
    postJournal(db, {
      business_date: date,
      entry_type: "sale",
      source_type: "sale",
      source_id: saleId,
      description: `Sale ${saleNo}`,
      costing_method: "fifo",
      is_complete: costingComplete,
      created_at: createdAt,
      created_by: opts?.actor_id ?? null,
    }, journalLines);

    const payload = JSON.stringify({
      sale_id: saleId,
      event_type: "sale",
      business_date: date,
      currency: "SDG",
      total_sdg: total,
      lines: allocations.map((l) => ({
        product_id: l.product_id,
        batch_id: l.batch_id,
        quantity_delta: -l.quantity,
        unit_price: l.unit_price,
        unit_cost: l.unit_cost,
      })),
    });
    run(
      db,
      `INSERT INTO sync_queue (entity, op, payload, created_at)
       VALUES ('sale', 'create', ?, ?)`,
      [payload, createdAt],
    );

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return {
    sale_id: saleId,
    sale_no: saleNo,
    total: allocations.reduce((sum, l) => sum + l.quantity * l.unit_price, 0),
    lines: allocations,
    created_at: createdAt,
    flagged: false,
    shortages: [],
  };
}

export function receiveBatch(
  db: Database,
  input: {
    product_id: string; lot_no: string; expiry_date: string | null;
    mfg_date?: string | null; quantity: number; unit_cost: number;
    sale_price?: number | null; supplier?: string | null;
    payment_status?: "paid" | "partial" | "unpaid"; amount_paid?: number;
    actor_id?: string | null;
    payment_method?: "cash" | "bank";
    invoice_no?: string | null; due_date?: string | null; notes?: string | null;
    strips_per_box?: number | null; pills_per_strip?: number | null;
  },
): string {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || !Number.isFinite(input.unit_cost) || input.unit_cost < 0) {
    throw new Error("Enter a positive whole-number quantity and a valid unit cost.");
  }
  // Normalize once at receipt, before physical, purchasing and FIFO records diverge.
  input = { ...input, unit_cost: toMinorUnits(input.unit_cost) / 100 };
  const id = randomUUID();
  const eventId = randomUUID();
  const now = new Date();
  const createdAt = now.toISOString();
  const date = businessDate(now);
  db.run("BEGIN");
  try {
    run(db, `INSERT INTO batches (id, product_id, lot_no, expiry_date, mfg_date, quantity, cost_price, sale_price, strips_per_box, pills_per_strip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.product_id, input.lot_no, input.expiry_date, input.mfg_date ?? null, input.quantity, input.unit_cost, input.sale_price ?? null, input.strips_per_box ?? null, input.pills_per_strip ?? null]);
    run(db, `INSERT INTO inventory_movements
      (id, event_id, movement_type, product_id, batch_id, quantity_delta, unit_cost, created_at)
      VALUES (?, ?, 'receipt', ?, ?, ?, ?, ?)`,
      [randomUUID(), eventId, input.product_id, id, input.quantity, input.unit_cost, createdAt]);
    receiveFinancialCostLayer(db, {
      product_id: input.product_id, batch_id: id, quantity: input.quantity,
      unit_cost: input.unit_cost, received_at: createdAt,
    });
    recordPurchase(db, {
      product_id: input.product_id, supplier: input.supplier, quantity: input.quantity,
      unit_cost: input.unit_cost, payment_status: input.payment_status, amount_paid: input.amount_paid,
      business_date: date,
      actor_id: input.actor_id,
      payment_method: input.payment_method,
      invoice_no: input.invoice_no,
      due_date: input.due_date,
      notes: input.notes,
    });
    const payload = JSON.stringify({ event_id: eventId, event_type: "receipt", business_date: date,
      lines: [{ product_id: input.product_id, batch_id: id, quantity_delta: input.quantity, unit_cost: input.unit_cost }] });
    run(db, `INSERT INTO sync_queue (entity, op, payload, created_at) VALUES ('inventory_event', 'apply', ?, ?)`, [payload, createdAt]);
    db.run("COMMIT");
    return id;
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

/** Remove all stock for a product (admin-only action). Returns units removed. */
export function removeStock(db: Database, productId: string, actorId: string | null = null): number {
  const row = all<{ n: number }>(
    db,
    `SELECT COALESCE(SUM(quantity), 0) AS n FROM batches WHERE product_id = ?`,
    [productId],
  );
  const batches = all<{ id: string; quantity: number; cost_price: number | null }>(db,
    `SELECT id, quantity, cost_price FROM batches WHERE product_id = ? AND quantity > 0`, [productId]);
  const eventId = randomUUID();
  const createdAt = new Date().toISOString();
  db.run("BEGIN");
  try {
    const removedQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
    const writeoff = consumeFifoCost(db, productId, removedQuantity);
    for (const batch of batches) {
      run(db, `INSERT INTO inventory_movements
        (id, event_id, movement_type, product_id, batch_id, quantity_delta, unit_cost, created_at)
        VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?)`,
      [randomUUID(), eventId, productId, batch.id, -batch.quantity, batch.cost_price, createdAt]);
      run(db, `UPDATE batches SET quantity = 0 WHERE id = ?`, [batch.id]);
    }
    if (removedQuantity > 0) {
      postJournal(db, {
        business_date: businessDate(new Date()), entry_type: "stock_writeoff", source_type: "stock_writeoff",
        source_id: eventId, description: "Manual stock removal written off",
        costing_method: "fifo", is_complete: writeoff.complete, created_at: createdAt, created_by: actorId,
      }, writeoff.known_cost_minor > 0 ? [
        { account_code: "inventory_writeoff", debit_minor: writeoff.known_cost_minor, memo: "Manual stock removal" },
        { account_code: "inventory", credit_minor: writeoff.known_cost_minor, memo: "Manual stock removal" },
      ] : []);
    }
    run(db, `INSERT INTO sync_queue (entity, op, payload, created_at) VALUES ('inventory_event', 'apply', ?, ?)`,
      [JSON.stringify({ event_id: eventId, event_type: "adjustment", reason: "admin stock removal", lines: batches.map(b => ({ product_id: productId, batch_id: b.id, quantity_delta: -b.quantity })) }), createdAt]);
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
  return row[0]?.n ?? 0;
}

export function getStockLevels(db: Database): StockLevel[] {
  return all<{ product_id: string; available: number }>(
    db,
    `SELECT product_id, SUM(CASE WHEN expiry_date IS NULL OR expiry_date >= date('now','localtime') THEN quantity ELSE 0 END) AS available FROM batches GROUP BY product_id`,
  ).map((r) => ({ product_id: r.product_id, available: r.available }));
}

export function availableForProduct(db: Database, productId: string): number {
  const row = get<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(CASE WHEN expiry_date IS NULL OR expiry_date >= date('now','localtime') THEN quantity ELSE 0 END), 0) AS total FROM batches WHERE product_id = ?`,
    [productId],
  );
  return row ? row.total : 0;
}
