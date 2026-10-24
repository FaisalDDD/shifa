// Customer (patient) accounts: names, contact info, outstanding balances, and
// what each customer buys most. Credit ("pay later") sales add to a ledger;
// payments settle it.

import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { all, get, run } from "./db";
import type { Customer, CustomerCreditInvoice } from "../shared/types";
import { fromMinorUnits, postJournal, toMinorUnits } from "./financial";

export interface AddCustomerInput {
  name: string;
  phone?: string | null;
  birth_date?: string | null;
  age?: string | null;
  address?: string | null;
}

export function addCustomer(db: Database, input: AddCustomerInput): Customer {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  run(
    db,
    `INSERT INTO customers (id, name, phone, birth_date, age, address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.phone ?? null,
      input.birth_date ?? null,
      input.age ?? null,
      input.address ?? null,
      createdAt,
    ],
  );
  return {
    id,
    name: input.name,
    phone: input.phone ?? null,
    birth_date: input.birth_date ?? null,
    age: input.age ?? null,
    address: input.address ?? null,
    balance: 0,
    top_products: [],
    created_at: createdAt,
  };
}

/** Positive amount = customer owes more (credit sale); negative = payment. */
export function addLedgerEntry(
  db: Database,
  customerId: string,
  amount: number,
  note?: string | null,
): void {
  run(
    db,
    `INSERT INTO customer_ledger (id, customer_id, amount, note, created_at) VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), customerId, amount, note ?? null, new Date().toISOString()],
  );
}

export function customerBalance(db: Database, customerId: string): number {
  const row = get<{ bal: number }>(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS bal FROM customer_ledger WHERE customer_id = ?`,
    [customerId],
  );
  return row ? row.bal : 0;
}

export function customerTopProducts(
  db: Database,
  customerId: string,
  limit = 3,
): { product_name: string; total_quantity: number }[] {
  return all<{ product_name: string; total_quantity: number }>(
    db,
    `SELECT COALESCE(p.canonical_name, si.product_id) AS product_name,
            SUM(si.quantity) AS total_quantity
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     WHERE s.customer_id = ?
     GROUP BY si.product_id, p.canonical_name
     ORDER BY total_quantity DESC
     LIMIT ?`,
    [customerId, limit],
  );
}

export function listCustomers(db: Database): Customer[] {
  const rows = all<{
    id: string;
    name: string;
    phone: string | null;
    birth_date: string | null;
    age: string | null;
    address: string | null;
    created_at: string;
  }>(db, `SELECT id, name, phone, birth_date, age, address, created_at FROM customers ORDER BY name`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    birth_date: r.birth_date,
    age: r.age,
    address: r.address,
    balance: customerBalance(db, r.id),
    top_products: customerTopProducts(db, r.id),
    created_at: r.created_at,
  }));
}

export function listCustomerCreditInvoices(db: Database): CustomerCreditInvoice[] {
  return all<{ sale_id: string; sale_no: string; customer_id: string; customer_name: string; phone: string | null;
    total_minor: number; paid_minor: number; due_date: string | null; created_at: string }>(db,
  `SELECT i.sale_id,s.sale_no,i.customer_id,c.name AS customer_name,c.phone,i.total_minor,i.paid_minor,i.due_date,i.created_at
   FROM customer_credit_invoices i JOIN sales s ON s.id=i.sale_id JOIN customers c ON c.id=i.customer_id
   WHERE i.total_minor>i.paid_minor ORDER BY CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END,i.due_date,i.created_at`)
    .map(row => ({ sale_id: row.sale_id, sale_no: row.sale_no, customer_id: row.customer_id,
      customer_name: row.customer_name, phone: row.phone,
      total_sdg: fromMinorUnits(row.total_minor), paid_sdg: fromMinorUnits(row.paid_minor),
      balance_sdg: fromMinorUnits(row.total_minor - row.paid_minor), due_date: row.due_date, created_at: row.created_at,
      payment_history: all<{ amount_minor: number; business_date: string; method: "cash" | "bank" }>(db,
        `SELECT a.amount_minor,substr(a.created_at,1,10) AS business_date,
          CASE WHEN EXISTS(SELECT 1 FROM financial_journals j JOIN financial_journal_lines l ON l.journal_id=j.id
            WHERE j.source_type='customer_payment' AND j.source_id=a.customer_payment_id AND l.account_code='bank')
          THEN 'bank' ELSE 'cash' END AS method
          FROM customer_credit_payment_allocations a WHERE a.sale_id=? ORDER BY a.created_at DESC`, [row.sale_id])
        .map(payment => ({ amount_sdg: fromMinorUnits(payment.amount_minor), business_date: payment.business_date, method: payment.method })) }));
}

/** Settle a customer's full outstanding balance (they paid later). */
export function settleCustomerBalance(db: Database, customerId: string, actorId: string | null = null, requestedAmount?: number, paymentMethod: "cash" | "bank" = "cash", invoiceId?: string | null): number {
  if (paymentMethod !== "cash" && paymentMethod !== "bank") throw new Error("Choose cash or bank for the customer payment.");
  const bal = customerBalance(db, customerId);
  if (bal > 0) {
    const amountMinor = toMinorUnits(requestedAmount ?? bal);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > toMinorUnits(bal)) {
      throw new Error("Payment must be greater than zero and no more than the outstanding customer balance.");
    }
    const invoice = invoiceId ? get<{ sale_id: string; total_minor: number; paid_minor: number }>(db,
      `SELECT sale_id,total_minor,paid_minor FROM customer_credit_invoices WHERE sale_id=? AND customer_id=?`, [invoiceId, customerId]) : null;
    if (invoiceId && !invoice) throw new Error("That customer credit invoice was not found.");
    if (invoice && amountMinor > invoice.total_minor - invoice.paid_minor) throw new Error("Payment exceeds this invoice's remaining balance.");
    let allocations: { sale_id: string; amount_minor: number }[] = [];
    if (invoice) allocations = [{ sale_id: invoice.sale_id, amount_minor: amountMinor }];
    else {
      let remaining = amountMinor;
      const invoices = all<{ sale_id: string; remaining: number }>(db,
        `SELECT sale_id,total_minor-paid_minor AS remaining FROM customer_credit_invoices WHERE customer_id=? AND total_minor>paid_minor
          ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,due_date,created_at`, [customerId]);
      for (const item of invoices) {
        if (remaining <= 0) break;
        const part = Math.min(remaining, item.remaining);
        allocations.push({ sale_id: item.sale_id, amount_minor: part }); remaining -= part;
      }
    }
    const paymentId = randomUUID();
    const now = new Date();
    const businessDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    db.run("BEGIN");
    try {
      run(db, `INSERT INTO customer_ledger (id, customer_id, amount, note, created_at) VALUES (?, ?, ?, ?, ?)`,
        [paymentId, customerId, -amountMinor / 100, "Customer payment", now.toISOString()]);
      postJournal(db, {
        business_date: businessDate, entry_type: "customer_payment", source_type: "customer_payment",
        source_id: paymentId, description: "Customer balance payment", created_at: now.toISOString(), created_by: actorId,
      }, [
        { account_code: paymentMethod === "bank" ? "bank" : "cash_on_hand", debit_minor: amountMinor },
        { account_code: "accounts_receivable", credit_minor: amountMinor },
      ]);
      run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
        VALUES(?, 'customer_payment', 'customer', ?, ?, ?, ?)` ,
      [randomUUID(), customerId, JSON.stringify({ payment_id: paymentId, amount_minor: amountMinor, payment_method: paymentMethod }), now.toISOString(), actorId]);
      for (const allocation of allocations) {
        run(db, `UPDATE customer_credit_invoices SET paid_minor=paid_minor+? WHERE sale_id=?`, [allocation.amount_minor, allocation.sale_id]);
        run(db, `INSERT INTO customer_credit_payment_allocations(customer_payment_id,sale_id,amount_minor,created_at) VALUES(?,?,?,?)`,
          [paymentId, allocation.sale_id, allocation.amount_minor, now.toISOString()]);
      }
      db.run("COMMIT");
    } catch (err) {
      db.run("ROLLBACK");
      throw err;
    }
    return amountMinor / 100;
  }
  return 0;
}
