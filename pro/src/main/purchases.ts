// Purchases ledger + accounts-payable tracking.
// Every stock receipt records a purchase (supplier + cost + payment status), so
// a pharmacy sees its most-purchased products and what it still owes suppliers.

import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { all, get, run } from "./db";
import type {
  MostPurchasedRow,
  PayableRow,
  PayablesSummary,
  PaymentStatus,
  Purchase,
  SupplierPayment,
} from "../shared/types";
import { fromMinorUnits, postJournal, toMinorUnits } from "./financial";

export function recordPurchase(
  db: Database,
  input: {
    product_id: string;
    supplier?: string | null;
    quantity: number;
    unit_cost: number;
    payment_status?: PaymentStatus;
    amount_paid?: number;
    business_date?: string;
    actor_id?: string | null;
    payment_method?: "cash" | "bank";
    invoice_no?: string | null;
    due_date?: string | null;
    notes?: string | null;
  },
): Purchase {
  if (input.due_date && (!/^\d{4}-\d{2}-\d{2}$/.test(input.due_date) || Number.isNaN(Date.parse(`${input.due_date}T00:00:00Z`)))) {
    throw new Error("Enter a valid supplier invoice due date.");
  }
  const id = randomUUID();
  // New receipts use cents per unit, matching FIFO layers. Never revalue history.
  const unitCostMinor = toMinorUnits(input.unit_cost);
  const unitCost = fromMinorUnits(unitCostMinor);
  const totalMinor = input.quantity * unitCostMinor;
  if (!Number.isSafeInteger(totalMinor)) throw new Error("Enter a valid amount.");
  const totalCost = fromMinorUnits(totalMinor);
  const createdAt = new Date().toISOString();
  const status = input.payment_status ?? "unpaid";
  const amountPaidMinor = status === "paid"
    ? totalMinor
    : status === "partial"
      ? Math.min(Math.max(0, toMinorUnits(input.amount_paid ?? 0)), totalMinor)
      : 0;
  const amountPaid = fromMinorUnits(amountPaidMinor);
  run(
    db,
    `INSERT INTO purchases
       (id, product_id, supplier, quantity, unit_cost, total_cost, payment_status, amount_paid, created_at, invoice_no, due_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.product_id,
      input.supplier ?? null,
      input.quantity,
      unitCost,
      totalCost,
      status,
      amountPaid,
      createdAt,
      input.invoice_no?.trim() || null,
      input.due_date || null,
      input.notes?.trim() || null,
    ],
  );
  if (totalMinor > 0) {
    const lines = [
      { account_code: "inventory", debit_minor: totalMinor, memo: input.supplier ?? null },
      ...(amountPaidMinor > 0 ? [{ account_code: input.payment_method === "bank" ? "bank" : "cash_on_hand", credit_minor: amountPaidMinor, memo: "Paid at receipt" }] : []),
      ...(totalMinor > amountPaidMinor ? [{ account_code: "accounts_payable", credit_minor: totalMinor - amountPaidMinor, memo: input.supplier ?? null }] : []),
    ];
    postJournal(db, {
      business_date: input.business_date ?? createdAt.slice(0, 10),
      entry_type: "purchase",
      source_type: "purchase",
      source_id: id,
      description: `Stock receipt${input.supplier ? ` — ${input.supplier}` : ""}`,
      created_at: createdAt,
      created_by: input.actor_id ?? null,
    }, lines);
  }
  if (amountPaidMinor > 0) {
    run(db, `INSERT INTO supplier_payments(id,purchase_id,amount_minor,payment_method,business_date,created_at,created_by)
      VALUES(?,?,?,?,?,?,?)`, [randomUUID(), id, amountPaidMinor, input.payment_method === "bank" ? "bank" : "cash",
      input.business_date ?? createdAt.slice(0, 10), createdAt, input.actor_id ?? null]);
  }
  return {
    id,
    product_id: input.product_id,
    supplier: input.supplier ?? null,
    quantity: input.quantity,
    unit_cost: unitCost,
    total_cost: totalCost,
    payment_status: status,
    amount_paid: amountPaid,
    created_at: createdAt,
  };
}

export function mostPurchasedProducts(
  db: Database,
  limit = 12,
): MostPurchasedRow[] {
  return all<MostPurchasedRow>(
    db,
    `SELECT pu.product_id,
            COALESCE(p.canonical_name, pu.product_id) AS product_name,
            SUM(pu.quantity) AS total_quantity,
            SUM(pu.total_cost) AS total_cost,
            COUNT(*) AS purchase_count
     FROM purchases pu
     LEFT JOIN products p ON p.id = pu.product_id
     GROUP BY pu.product_id, p.canonical_name
     ORDER BY total_quantity DESC
     LIMIT ?`,
    [limit],
  );
}

export function outstandingPayables(db: Database): PayablesSummary {
  const rows = all<PayableRow>(
    db,
    `SELECT pu.id,
            COALESCE(p.canonical_name, pu.product_id) AS product_name,
            pu.supplier,
            pu.total_cost,
            pu.amount_paid,
            (pu.total_cost - pu.amount_paid) AS remaining,
            pu.created_at,
            pu.invoice_no,
            pu.due_date,
            pu.notes,
            pu.attachment_path
     FROM purchases pu
     LEFT JOIN products p ON p.id = pu.product_id
     WHERE (pu.total_cost - pu.amount_paid) > 0
     ORDER BY pu.created_at DESC`,
  );
  const totalOwed = rows.reduce((sum, r) => sum + r.remaining, 0);
  return { rows, total_owed: totalOwed };
}

export function savePurchaseAttachment(db: Database, id: string, attachmentPath: string): void {
  const purchase = get<{ id: string }>(db, `SELECT id FROM purchases WHERE id=?`, [id]);
  if (!purchase) throw new Error("Supplier invoice was not found.");
  run(db, `UPDATE purchases SET attachment_path=? WHERE id=?`, [attachmentPath, id]);
}

export function purchaseAttachment(db: Database, id: string): string | null {
  return get<{ attachment_path: string | null }>(db,
    `SELECT attachment_path FROM purchases WHERE id=?`, [id])?.attachment_path ?? null;
}

export function supplierPaymentHistory(db: Database, purchaseId: string): SupplierPayment[] {
  return all<{ id: string; purchase_id: string; amount_minor: number; payment_method: "cash" | "bank"; business_date: string; created_at: string }>(db,
    `SELECT id,purchase_id,amount_minor,payment_method,business_date,created_at FROM supplier_payments
      WHERE purchase_id=? ORDER BY business_date DESC,created_at DESC`, [purchaseId])
    .map(row => ({ ...row, amount_sdg: fromMinorUnits(row.amount_minor) }));
}

export function recordSupplierPayment(db: Database, id: string, amount: number, actorId: string | null = null, paymentMethod: "cash" | "bank" = "cash"): number {
  if (paymentMethod !== "cash" && paymentMethod !== "bank") throw new Error("Choose cash or bank for the supplier payment.");
  const purchase = all<{ id: string; total_cost: number; amount_paid: number; supplier: string | null; created_at: string }>(db,
    `SELECT id,total_cost,amount_paid,supplier,created_at FROM purchases WHERE id=?`, [id])[0];
  if (!purchase) throw new Error("Supplier invoice was not found.");
  const remainingMinor = Math.max(0, toMinorUnits(purchase.total_cost - purchase.amount_paid));
  const amountMinor = toMinorUnits(amount);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > remainingMinor) {
    throw new Error("Payment must be greater than zero and no more than the outstanding supplier balance.");
  }
  const paymentId = randomUUID();
  const date = new Date();
  const businessDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const createdAt = date.toISOString();
  db.run("BEGIN");
  try {
    postJournal(db, {
      business_date: businessDate,
      entry_type: "supplier_payment",
      source_type: "supplier_payment",
      source_id: paymentId,
      description: `Payment to ${purchase.supplier || "supplier"}`,
      created_at: createdAt,
      created_by: actorId,
    }, [
      { account_code: "accounts_payable", debit_minor: amountMinor, memo: purchase.supplier },
      { account_code: paymentMethod === "bank" ? "bank" : "cash_on_hand", credit_minor: amountMinor, memo: `Purchase ${id}` },
    ]);
    run(db, `INSERT INTO supplier_payments(id,purchase_id,amount_minor,payment_method,business_date,created_at,created_by)
      VALUES(?,?,?,?,?,?,?)`, [paymentId, id, amountMinor, paymentMethod, businessDate, createdAt, actorId]);
    const newPaidMinor = toMinorUnits(purchase.amount_paid) + amountMinor;
    const newStatus = newPaidMinor >= toMinorUnits(purchase.total_cost) ? "paid" : "partial";
    run(db, `UPDATE purchases SET amount_paid=?,payment_status=? WHERE id=?`, [fromMinorUnits(newPaidMinor), newStatus, id]);
    run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
      VALUES(?, 'supplier_payment', 'purchase', ?, ?, ?, ?)`,
    [randomUUID(), id, JSON.stringify({ payment_id: paymentId, amount_minor: amountMinor }), createdAt, actorId]);
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
  return fromMinorUnits(amountMinor);
}

export function markPaid(db: Database, id: string, actorId: string | null = null, paymentMethod: "cash" | "bank" = "cash"): void {
  const purchase = all<{ total_cost: number; amount_paid: number }>(db,
    `SELECT total_cost,amount_paid FROM purchases WHERE id=?`, [id])[0];
  if (!purchase) throw new Error("Supplier invoice was not found.");
  const remainingMinor = toMinorUnits(purchase.total_cost - purchase.amount_paid);
  if (remainingMinor > 0) recordSupplierPayment(db, id, fromMinorUnits(remainingMinor), actorId, paymentMethod);
}
