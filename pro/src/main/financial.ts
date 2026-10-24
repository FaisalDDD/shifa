// Offline-first financial ledger. Journals are append-only, balanced, and
// stored in integer minor units; operational sales and stock tables stay the
// source for POS workflow and lot traceability.

import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { all, get, getMeta, run, setMeta } from "./db";
import type {
  ExpenseInput,
  ExpenseRow,
  FinancialJournalRow,
  FinancialPeriodClose,
  FinancialReport,
  InventoryException,
} from "../shared/types";

export interface JournalLineInput {
  account_code: string;
  debit_minor?: number;
  credit_minor?: number;
  memo?: string | null;
}

export interface FinancialEvent {
  event_id: string;
  event_type: string;
  journal: {
    id: string;
    business_date: string;
    entry_type: string;
    source_type: string | null;
    source_id: string | null;
    description: string;
    currency: "SDG";
    costing_method?: "fifo" | "legacy_batch_cost" | null;
    is_complete: boolean;
    created_at: string;
    created_by: string | null;
  };
  lines: (JournalLineInput & { id: string })[];
}

export interface FinancialPeriodEvent {
  event_id: string;
  action: "close" | "reopen";
  period: FinancialPeriodClose;
}

const EXPENSE_CATEGORIES = new Set([
  "rent", "payroll", "utilities", "transport", "maintenance",
  "bank_charges", "marketing", "other",
]);

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error("Enter a valid amount.");
  }
  return Math.round((amount + Math.sign(amount || 1) * Number.EPSILON) * 100);
}

export function fromMinorUnits(amount: number): number {
  return amount / 100;
}

function assertPeriodOpen(db: Database, businessDate: string): void {
  const closed = get<{ id: string }>(db,
    `SELECT id FROM financial_period_closes
     WHERE period_start <= ? AND period_end >= ? AND reopened_at IS NULL LIMIT 1`,
    [businessDate, businessDate]);
  if (closed) throw new Error("This date belongs to a closed financial period. Reopen it with the owner before recording a correction.");
}

function lineTotals(lines: JournalLineInput[]): { debits: number; credits: number } {
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    const debit = line.debit_minor ?? 0;
    const credit = line.credit_minor ?? 0;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0)) {
      throw new Error("Financial journal lines must use non-negative whole minor units on one side.");
    }
    debits += debit;
    credits += credit;
  }
  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits) || debits !== credits) {
    throw new Error("Financial entry is not balanced and was not saved.");
  }
  return { debits, credits };
}

function makeEvent(input: {
  event_id?: string;
  id?: string;
  business_date: string;
  entry_type: string;
  source_type?: string | null;
  source_id?: string | null;
  description: string;
  costing_method?: "fifo" | "legacy_batch_cost" | null;
  is_complete?: boolean;
  created_at?: string;
  created_by?: string | null;
}, lines: JournalLineInput[]): FinancialEvent {
  const journalId = input.id ?? randomUUID();
  return {
    event_id: input.event_id ?? randomUUID(),
    event_type: input.entry_type,
    journal: {
      id: journalId,
      business_date: input.business_date,
      entry_type: input.entry_type,
      source_type: input.source_type ?? null,
      source_id: input.source_id ?? null,
      description: input.description,
      currency: "SDG",
      costing_method: input.costing_method ?? null,
      is_complete: input.is_complete ?? true,
      created_at: input.created_at ?? new Date().toISOString(),
      created_by: input.created_by ?? null,
    },
    lines: lines.filter(line => (line.debit_minor ?? 0) !== 0 || (line.credit_minor ?? 0) !== 0)
      .map(line => ({ ...line, id: randomUUID() })),
  };
}

function insertEvent(db: Database, event: FinancialEvent, enqueueSync: boolean): void {
  const totals = lineTotals(event.lines);
  const existing = get<{ id: string }>(db,
    `SELECT id FROM financial_journals WHERE event_id = ? OR
     (entry_type = ? AND source_type IS ? AND source_id IS ?) LIMIT 1`,
    [event.event_id, event.journal.entry_type, event.journal.source_type, event.journal.source_id]);
  if (existing) return;

  run(db, `INSERT INTO financial_journals
    (id, event_id, business_date, entry_type, source_type, source_id, description, currency, costing_method, is_complete, created_at, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'SDG', ?, ?, ?, ?, 'posted')`,
  [event.journal.id, event.event_id, event.journal.business_date, event.journal.entry_type,
    event.journal.source_type, event.journal.source_id, event.journal.description,
    event.journal.costing_method ?? null, event.journal.is_complete ? 1 : 0,
    event.journal.created_at, event.journal.created_by]);
  for (const line of event.lines) {
    run(db, `INSERT INTO financial_journal_lines
      (id, journal_id, account_code, debit_minor, credit_minor, memo)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [line.id, event.journal.id, line.account_code, line.debit_minor ?? 0, line.credit_minor ?? 0, line.memo ?? null]);
  }
  if (totals.debits !== totals.credits) throw new Error("Financial entry is not balanced.");
  if (enqueueSync) {
    run(db, `INSERT INTO sync_queue (entity, op, payload, created_at)
      VALUES ('financial_event', 'append', ?, ?)`,
    [JSON.stringify(event), event.journal.created_at]);
  }
}

/** Post one immutable, balanced journal event inside the caller's transaction. */
export function postJournal(
  db: Database,
  input: {
    business_date: string;
    entry_type: string;
    source_type?: string | null;
    source_id?: string | null;
    description: string;
    costing_method?: "fifo" | "legacy_batch_cost" | null;
    is_complete?: boolean;
    created_at?: string;
    created_by?: string | null;
  },
  lines: JournalLineInput[],
  options: { enqueueSync?: boolean; allowClosedPeriod?: boolean } = {},
): string {
  if (!validDate(input.business_date)) throw new Error("Enter a valid business date.");
  if (!options.allowClosedPeriod) assertPeriodOpen(db, input.business_date);
  const event = makeEvent(input, lines);
  insertEvent(db, event, options.enqueueSync !== false);
  return event.journal.id;
}

/** Apply a cloud journal event idempotently without creating another queue item. */
export function applySyncedFinancialEvent(db: Database, event: FinancialEvent): void {
  if (!event?.event_id || !event.journal?.id || !validDate(event.journal.business_date) || !Array.isArray(event.lines)) {
    throw new Error("Received an invalid financial sync event.");
  }
  lineTotals(event.lines);
  insertEvent(db, event, false);
}

export interface FinancialCostAllocation {
  quantity: number;
  unit_cost_minor: number | null;
}

export interface FinancialCostConsumption {
  allocations: FinancialCostAllocation[];
  known_cost_minor: number;
  uncovered_quantity: number;
  complete: boolean;
}

/**
 * Create a one-time opening layer from each currently available batch. This
 * establishes the starting book-cost pool for existing inventory; historical
 * sales remain valued at the lot cost captured when they were recorded.
 */
export function initializeFinancialCostLayers(db: Database): void {
  if (getMeta(db, "fifo_cost_layers_initialized") === "1") return;
  const now = new Date().toISOString();
  const batches = all<{
    id: string; product_id: string; quantity: number; cost_price: number | null;
    received_at: string | null;
  }>(db, `SELECT b.id,b.product_id,b.quantity,b.cost_price,
      (SELECT MIN(m.created_at) FROM inventory_movements m
        WHERE m.batch_id=b.id AND m.movement_type IN ('receipt','opening')) AS received_at
    FROM batches b WHERE b.quantity > 0 ORDER BY b.rowid`);
  for (const batch of batches) {
    const unitCostMinor = batch.cost_price === null ? null : toMinorUnits(batch.cost_price);
    run(db, `INSERT OR IGNORE INTO financial_cost_layers
      (id,product_id,batch_id,original_qty,remaining_qty,unit_cost_minor,received_at)
      VALUES(?,?,?,?,?,?,?)`, [
      `opening-${batch.id}`, batch.product_id, batch.id, batch.quantity, batch.quantity,
      unitCostMinor, batch.received_at ?? now,
    ]);
  }
  setMeta(db, "fifo_cost_layers_initialized", "1");
}

/** Add the financial FIFO layer paired with a newly received physical batch. */
export function receiveFinancialCostLayer(db: Database, input: {
  product_id: string; batch_id: string; quantity: number; unit_cost: number | null; received_at: string;
}): void {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("A cost layer needs a positive whole-number quantity.");
  run(db, `INSERT INTO financial_cost_layers
    (id,product_id,batch_id,original_qty,remaining_qty,unit_cost_minor,received_at)
    VALUES(?,?,?,?,?,?,?)`, [
    `receipt-${input.batch_id}`, input.product_id, input.batch_id, input.quantity, input.quantity,
    input.unit_cost === null ? null : toMinorUnits(input.unit_cost), input.received_at,
  ]);
}

/** Consume accounting cost oldest-receipt first, independently of FEFO shelf picking. */
export function consumeFifoCost(db: Database, productId: string, requestedQuantity: number): FinancialCostConsumption {
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 0) throw new Error("Cost consumption quantity must be a whole number.");
  let remaining = requestedQuantity;
  let knownCostMinor = 0;
  const allocations: FinancialCostAllocation[] = [];
  const layers = all<{ id: string; remaining_qty: number; unit_cost_minor: number | null }>(db,
    `SELECT id,remaining_qty,unit_cost_minor FROM financial_cost_layers
      WHERE product_id=? AND remaining_qty>0 ORDER BY received_at,id`, [productId]);
  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, layer.remaining_qty);
    if (take <= 0) continue;
    run(db, `UPDATE financial_cost_layers SET remaining_qty=remaining_qty-? WHERE id=?`, [take, layer.id]);
    allocations.push({ quantity: take, unit_cost_minor: layer.unit_cost_minor });
    if (layer.unit_cost_minor !== null) knownCostMinor += take * layer.unit_cost_minor;
    remaining -= take;
  }
  return {
    allocations,
    known_cost_minor: knownCostMinor,
    uncovered_quantity: remaining,
    complete: remaining === 0 && allocations.every(allocation => allocation.unit_cost_minor !== null),
  };
}

export function migrateLegacyFinancialHistory(db: Database): void {
  run(db, `UPDATE sale_items
    SET accounting_cost_minor=CAST(ROUND(quantity*unit_cost_at_sale*100) AS INTEGER),
        accounting_cost_method='legacy_batch_cost'
    WHERE accounting_cost_minor IS NULL AND unit_cost_at_sale IS NOT NULL`);
  run(db, `UPDATE financial_journals SET costing_method='legacy_batch_cost'
    WHERE entry_type='sale' AND costing_method IS NULL`);
  initializeFinancialCostLayers(db);
  const sales = all<{
    id: string; sale_no: string; total: number; payment_method: string | null;
    business_date: string; created_at: string; cogs_minor: number; missing_units: number;
  }>(db, `SELECT s.id, s.sale_no, s.total, s.payment_method, s.business_date, s.created_at,
      COALESCE(ROUND(SUM(CASE WHEN si.unit_cost_at_sale IS NOT NULL THEN si.quantity * si.unit_cost_at_sale * 100 ELSE 0 END)), 0) AS cogs_minor,
      COALESCE(SUM(CASE WHEN si.unit_cost_at_sale IS NULL THEN si.quantity ELSE 0 END), 0) AS missing_units
    FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
    GROUP BY s.id, s.sale_no, s.total, s.payment_method, s.business_date, s.created_at
    HAVING NOT EXISTS (SELECT 1 FROM financial_journals j WHERE j.source_type='sale' AND j.source_id=s.id)`);
  for (const sale of sales) {
    if (!validDate(sale.business_date)) continue;
    const total = toMinorUnits(sale.total);
    const paymentAccount = sale.payment_method === "later" ? "accounts_receivable" : sale.payment_method === "bank" ? "bank" : "cash_on_hand";
    const lines: JournalLineInput[] = [
      { account_code: paymentAccount, debit_minor: total, memo: `Sale ${sale.sale_no}` },
      { account_code: "sales_revenue", credit_minor: total, memo: `Sale ${sale.sale_no}` },
    ];
    if (sale.cogs_minor > 0) {
      lines.push({ account_code: "cost_of_goods_sold", debit_minor: sale.cogs_minor });
      lines.push({ account_code: "inventory", credit_minor: sale.cogs_minor });
    }
    postJournal(db, {
      business_date: sale.business_date,
      entry_type: "sale",
      source_type: "sale",
      source_id: sale.id,
      description: `Sale ${sale.sale_no}`,
      costing_method: "legacy_batch_cost",
      is_complete: sale.missing_units === 0,
      created_at: sale.created_at,
    }, lines, { allowClosedPeriod: true });
  }

  const purchases = all<{
    id: string; product_id: string; supplier: string | null; total_cost: number;
    amount_paid: number; created_at: string;
  }>(db, `SELECT pu.id, pu.product_id, pu.supplier, pu.total_cost, pu.amount_paid, pu.created_at
    FROM purchases pu WHERE NOT EXISTS
      (SELECT 1 FROM financial_journals j WHERE j.source_type='purchase' AND j.source_id=pu.id)`);
  for (const purchase of purchases) {
    const amount = toMinorUnits(purchase.total_cost);
    const paid = Math.min(amount, Math.max(0, toMinorUnits(purchase.amount_paid)));
    const lines: JournalLineInput[] = [
      { account_code: "inventory", debit_minor: amount, memo: purchase.supplier ?? undefined },
    ];
    if (paid > 0) lines.push({ account_code: "cash_on_hand", credit_minor: paid, memo: "Paid at receipt" });
    if (amount > paid) lines.push({ account_code: "accounts_payable", credit_minor: amount - paid, memo: purchase.supplier ?? undefined });
    const businessDate = purchase.created_at.slice(0, 10);
    if (!validDate(businessDate)) continue;
    postJournal(db, {
      business_date: businessDate, entry_type: "purchase", source_type: "purchase",
      source_id: purchase.id,
      description: `Stock receipt${purchase.supplier ? ` — ${purchase.supplier}` : ""}`,
      created_at: purchase.created_at,
    }, lines, { allowClosedPeriod: true });
  }

  const customerPayments = all<{ id: string; customer_id: string; amount: number; note: string | null; created_at: string }>(db,
    `SELECT id, customer_id, amount, note, created_at FROM customer_ledger
     WHERE amount < 0 AND NOT EXISTS
       (SELECT 1 FROM financial_journals j WHERE j.source_type='customer_payment' AND j.source_id=customer_ledger.id)`);
  for (const payment of customerPayments) {
    const amount = toMinorUnits(Math.abs(payment.amount));
    const businessDate = payment.created_at.slice(0, 10);
    if (amount <= 0 || !validDate(businessDate)) continue;
    postJournal(db, {
      business_date: businessDate, entry_type: "customer_payment", source_type: "customer_payment",
      source_id: payment.id, description: payment.note || "Customer balance payment", created_at: payment.created_at,
    }, [
      { account_code: "cash_on_hand", debit_minor: amount },
      { account_code: "accounts_receivable", credit_minor: amount },
    ], { allowClosedPeriod: true });
  }
}

export function createExpense(db: Database, input: ExpenseInput, actorId: string | null): ExpenseRow {
  const date = input.business_date;
  const category = input.category.trim().toLowerCase();
  const description = input.description.trim();
  const amountMinor = toMinorUnits(input.amount_sdg);
  if (!validDate(date) || !EXPENSE_CATEGORIES.has(category)) throw new Error("Choose a valid expense date and category.");
  if (!description || description.length > 240) throw new Error("Enter an expense description of up to 240 characters.");
  if (amountMinor <= 0) throw new Error("Expense amount must be greater than zero.");
  if (!["cash", "bank", "unpaid"].includes(input.payment_method)) throw new Error("Choose cash, bank, or unpaid for this expense.");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const paidTo = input.payment_method === "unpaid" ? "accounts_payable" : input.payment_method === "bank" ? "bank" : "cash_on_hand";
  db.run("BEGIN");
  try {
    const journalId = postJournal(db, {
      business_date: date, entry_type: "expense", source_type: "expense", source_id: id,
      description, created_at: createdAt, created_by: actorId,
    }, [
      { account_code: `expense:${category}`, debit_minor: amountMinor, memo: description },
      { account_code: paidTo, credit_minor: amountMinor, memo: input.supplier?.trim() || null },
    ]);
    run(db, `INSERT INTO expenses
      (id, business_date, category, description, supplier, amount_minor, payment_method, status, journal_id, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?)`,
    [id, date, category, description, input.supplier?.trim() || null, amountMinor, input.payment_method, journalId, createdAt, actorId]);
    run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
      VALUES(?, 'expense_created', 'expense', ?, ?, ?, ?)`,
    [randomUUID(), id, JSON.stringify({ category, amount_minor: amountMinor, payment_method: input.payment_method }), createdAt, actorId]);
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
  return {
    id, business_date: date, category, description, supplier: input.supplier?.trim() || null,
    amount_sdg: fromMinorUnits(amountMinor), payment_method: input.payment_method,
    status: "posted", created_at: createdAt,
  };
}

export function listExpenses(db: Database, start: string, end: string): ExpenseRow[] {
  return all<{
    id: string; business_date: string; category: string; description: string; supplier: string | null;
    amount_minor: number; payment_method: "cash" | "bank" | "unpaid"; status: "posted" | "voided"; created_at: string;
  }>(db, `SELECT id,business_date,category,description,supplier,amount_minor,payment_method,status,created_at
    FROM expenses WHERE business_date >= ? AND business_date <= ? ORDER BY business_date DESC,created_at DESC LIMIT 500`, [start, end])
    .map(row => ({ ...row, amount_sdg: fromMinorUnits(row.amount_minor) }));
}

export function listFinancialJournal(db: Database, start: string, end: string, limit = 100): FinancialJournalRow[] {
  return all<{
    id: string; business_date: string; entry_type: string; description: string; currency: "SDG";
    is_complete: number; created_at: string; amount_minor: number;
  }>(db, `SELECT j.id,j.business_date,j.entry_type,j.description,j.currency,j.is_complete,j.created_at,
      CASE j.entry_type
        WHEN 'sale' THEN COALESCE(SUM(CASE WHEN l.account_code='sales_revenue' THEN l.credit_minor ELSE 0 END),0)
        WHEN 'purchase' THEN COALESCE(SUM(CASE WHEN l.account_code='inventory' THEN l.debit_minor ELSE 0 END),0)
        WHEN 'expense' THEN COALESCE(SUM(CASE WHEN l.account_code LIKE 'expense:%' THEN l.debit_minor ELSE 0 END),0)
        WHEN 'stock_writeoff' THEN COALESCE(SUM(CASE WHEN l.account_code='inventory_writeoff' THEN l.debit_minor ELSE 0 END),0)
        WHEN 'supplier_payment' THEN COALESCE(SUM(CASE WHEN l.account_code='accounts_payable' THEN l.debit_minor ELSE 0 END),0)
        WHEN 'customer_payment' THEN COALESCE(SUM(CASE WHEN l.account_code IN ('cash_on_hand','bank') THEN l.debit_minor ELSE 0 END),0)
        ELSE COALESCE(MAX(l.debit_minor), MAX(l.credit_minor), 0)
      END AS amount_minor
    FROM financial_journals j LEFT JOIN financial_journal_lines l ON l.journal_id=j.id
    WHERE j.business_date >= ? AND j.business_date <= ?
    GROUP BY j.id ORDER BY j.business_date DESC,j.created_at DESC LIMIT ?`, [start, end, limit])
    .map(row => ({ ...row, is_complete: !!row.is_complete, amount_sdg: fromMinorUnits(row.amount_minor) }));
}

export function saveDailyRate(db: Database, businessDate: string, sdgPerUsd: number, actorId: string | null = null): void {
  if (!validDate(businessDate) || !Number.isFinite(sdgPerUsd) || sdgPerUsd <= 0 || sdgPerUsd > 1_000_000_000) {
    throw new Error("Enter a valid report date and SDG-per-USD exchange rate.");
  }
  assertPeriodOpen(db, businessDate);
  db.run("BEGIN");
  try {
    const now = new Date().toISOString();
    const eventId = randomUUID();
    run(db, `INSERT INTO daily_exchange_rates (business_date, sdg_per_usd, updated_at)
      VALUES (?, ?, ?) ON CONFLICT(business_date) DO UPDATE SET
      sdg_per_usd = excluded.sdg_per_usd, updated_at = excluded.updated_at`, [businessDate, sdgPerUsd, now]);
    run(db, `INSERT INTO exchange_rate_audit (id, business_date, sdg_per_usd, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?)`, [eventId, businessDate, sdgPerUsd, now, actorId]);
    run(db, `INSERT INTO sync_queue (entity, op, payload, created_at)
      VALUES ('exchange_rate', 'set', ?, ?)`, [JSON.stringify({ event_id: eventId, business_date: businessDate,
        sdg_per_usd: sdgPerUsd, updated_by: actorId }), now]);
    run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
      VALUES(?, 'exchange_rate_set', 'exchange_rate', ?, ?, ?, ?)`,
    [randomUUID(), businessDate, JSON.stringify({ sdg_per_usd: sdgPerUsd }), now, actorId]);
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

interface DailyTotals {
  business_date: string;
  revenue_minor: number;
  cogs_minor: number;
  expenses_minor: number;
  writeoff_minor: number;
  sales: number;
}

function balanceMinor(db: Database, account: string, end: string): number {
  return get<{ amount: number }>(db, `SELECT COALESCE(SUM(l.debit_minor-l.credit_minor),0) AS amount
    FROM financial_journal_lines l JOIN financial_journals j ON j.id=l.journal_id
    WHERE l.account_code=? AND j.business_date <= ?`, [account, end])?.amount ?? 0;
}

function periodClose(db: Database, start: string, end: string): FinancialPeriodClose | null {
  return get<FinancialPeriodClose>(db, `SELECT id,period_start,period_end,closed_at,closed_by,snapshot_json,reopened_at,reopen_reason
    FROM financial_period_closes WHERE period_start=? AND period_end=?`, [start, end]) ?? null;
}

export function financialReport(db: Database, start: string, end: string): FinancialReport {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error("Choose a valid report date range.");
  const daily = all<DailyTotals>(db, `SELECT j.business_date,
      COALESCE(SUM(CASE WHEN l.account_code='sales_revenue' THEN l.credit_minor-l.debit_minor ELSE 0 END),0) AS revenue_minor,
      COALESCE(SUM(CASE WHEN l.account_code='cost_of_goods_sold' THEN l.debit_minor-l.credit_minor ELSE 0 END),0) AS cogs_minor,
      COALESCE(SUM(CASE WHEN l.account_code LIKE 'expense:%' THEN l.debit_minor-l.credit_minor ELSE 0 END),0) AS expenses_minor,
      COALESCE(SUM(CASE WHEN l.account_code='inventory_writeoff' THEN l.debit_minor-l.credit_minor ELSE 0 END),0) AS writeoff_minor,
      COUNT(DISTINCT CASE WHEN j.entry_type='sale' THEN j.id END) AS sales
    FROM financial_journals j JOIN financial_journal_lines l ON l.journal_id=j.id
    WHERE j.business_date >= ? AND j.business_date <= ? GROUP BY j.business_date ORDER BY j.business_date`, [start, end]);
  const rates = new Map(all<{ business_date: string; sdg_per_usd: number }>(db,
    `SELECT business_date,sdg_per_usd FROM daily_exchange_rates WHERE business_date >= ? AND business_date <= ?`, [start, end])
    .map(row => [row.business_date, row.sdg_per_usd]));
  const activeDays = daily.filter(day => day.revenue_minor || day.cogs_minor || day.expenses_minor || day.writeoff_minor || day.sales);
  const missingRateDays = activeDays.filter(day => !rates.has(day.business_date)).map(day => day.business_date);
  const ratesComplete = missingRateDays.length === 0;
  const revenueMinor = daily.reduce((sum, day) => sum + day.revenue_minor, 0);
  const cogsMinor = daily.reduce((sum, day) => sum + day.cogs_minor, 0);
  const expensesMinor = daily.reduce((sum, day) => sum + day.expenses_minor, 0);
  const writeoffMinor = daily.reduce((sum, day) => sum + day.writeoff_minor, 0);
  const missingCostLines = get<{ units: number }>(db, `SELECT COALESCE(SUM(si.quantity),0) AS units
    FROM sale_items si JOIN sales s ON s.id=si.sale_id
    WHERE s.business_date >= ? AND s.business_date <= ? AND si.accounting_cost_minor IS NULL`, [start, end])?.units ?? 0;
  const incompleteCostSales = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM financial_journals
    WHERE entry_type='sale' AND is_complete=0 AND business_date >= ? AND business_date <= ?`, [start, end])?.n ?? 0;
  const allSales = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM financial_journals
    WHERE entry_type='sale' AND business_date >= ? AND business_date <= ?`, [start, end])?.n ?? 0;
  const costingMethods = new Set(all<{ costing_method: string | null }>(db,
    `SELECT DISTINCT costing_method FROM financial_journals
      WHERE entry_type='sale' AND business_date >= ? AND business_date <= ?`, [start, end])
    .map(row => row.costing_method ?? "legacy_batch_cost"));
  const costingMethod = costingMethods.size > 1
    ? "Mixed: FIFO and historical batch cost"
    : costingMethods.has("fifo") ? "FIFO"
      : costingMethods.has("legacy_batch_cost") ? "Historical batch cost" : "FIFO for new sales";
  const expensesCount = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM expenses
    WHERE status='posted' AND business_date >= ? AND business_date <= ?`, [start, end])?.n ?? 0;
  const cashflowMinor = get<{ amount: number }>(db, `SELECT COALESCE(SUM(l.debit_minor-l.credit_minor),0) AS amount
    FROM financial_journal_lines l JOIN financial_journals j ON j.id=l.journal_id
    WHERE l.account_code IN ('cash_on_hand','bank') AND j.business_date >= ? AND j.business_date <= ?`, [start, end])?.amount ?? 0;
  const salesCollectedMinor = get<{ amount: number }>(db, `SELECT COALESCE(SUM(l.debit_minor),0) AS amount
    FROM financial_journal_lines l JOIN financial_journals j ON j.id=l.journal_id
    WHERE j.entry_type='sale' AND j.business_date >= ? AND j.business_date <= ?
      AND l.account_code IN ('cash_on_hand','bank')`, [start, end])?.amount ?? 0;
  const expensesPaidMinor = get<{ amount: number }>(db, `SELECT COALESCE(SUM(amount_minor),0) AS amount
    FROM expenses WHERE status='posted' AND payment_method IN ('cash','bank')
      AND business_date >= ? AND business_date <= ?`, [start, end])?.amount ?? 0;
  const grossMinor = revenueMinor - cogsMinor;
  const netMinor = grossMinor - expensesMinor - writeoffMinor;
  const usdMetric = (field: "revenue_minor" | "cogs_minor" | "expenses_minor" | "writeoff_minor" | "net_minor"): number | null => {
    if (!ratesComplete || ((field === "cogs_minor" || field === "net_minor") && incompleteCostSales > 0)) return null;
    return activeDays.reduce((total, day) => {
      const amount = field === "net_minor" ? day.revenue_minor - day.cogs_minor - day.expenses_minor - day.writeoff_minor : day[field];
      return total + fromMinorUnits(amount) / rates.get(day.business_date)!;
    }, 0);
  };
  const inventoryMinor = balanceMinor(db, "inventory", end);
  return {
    period: `${start} — ${end}`,
    currency: "SDG",
    revenue_sdg: fromMinorUnits(revenueMinor),
    cogs_sdg: fromMinorUnits(cogsMinor),
    gross_profit_sdg: incompleteCostSales > 0 ? null : fromMinorUnits(grossMinor),
    operating_expenses_sdg: fromMinorUnits(expensesMinor),
    inventory_writeoff_sdg: fromMinorUnits(writeoffMinor),
    net_profit_sdg: incompleteCostSales > 0 ? null : fromMinorUnits(netMinor),
    cashflow_sdg: fromMinorUnits(cashflowMinor),
    sales_collected_sdg: fromMinorUnits(salesCollectedMinor),
    expenses_paid_sdg: fromMinorUnits(expensesPaidMinor),
    cash_balance_sdg: fromMinorUnits(balanceMinor(db, "cash_on_hand", end)),
    bank_balance_sdg: fromMinorUnits(balanceMinor(db, "bank", end)),
    receivables_sdg: fromMinorUnits(balanceMinor(db, "accounts_receivable", end)),
    payables_sdg: fromMinorUnits(-balanceMinor(db, "accounts_payable", end)),
    inventory_value_sdg: fromMinorUnits(inventoryMinor),
    expense_count: expensesCount,
    financial_event_count: get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM financial_journals WHERE business_date >= ? AND business_date <= ?`, [start, end])?.n ?? 0,
    usd_revenue: usdMetric("revenue_minor"),
    usd_cogs: usdMetric("cogs_minor"),
    usd_gross_profit: usdMetric("net_minor") === null ? null : activeDays.reduce((total, day) =>
      total + fromMinorUnits(day.revenue_minor - day.cogs_minor) / rates.get(day.business_date)!, 0),
    usd_expenses: usdMetric("expenses_minor"),
    usd_net_profit: usdMetric("net_minor"),
    missing_rate_days: missingRateDays,
    missing_cost_lines: missingCostLines,
    incomplete_cost_sales: incompleteCostSales,
    costing_method: costingMethod,
    sale_count: allSales,
    daily_rates: activeDays.map(day => ({ business_date: day.business_date, sdg_per_usd: rates.get(day.business_date) ?? null })),
    close: periodClose(db, start, end),
  };
}

export function closeFinancialPeriod(db: Database, start: string, end: string, actorId: string | null): FinancialPeriodClose {
  const report = financialReport(db, start, end);
  if (report.incomplete_cost_sales > 0) throw new Error("This period cannot close while sales have missing cost history.");
  if (report.close && !report.close.reopened_at) throw new Error("This financial period is already closed.");
  const existing = report.close;
  const id = existing?.id ?? randomUUID();
  const now = new Date().toISOString();
  const eventId = randomUUID();
  const snapshot = JSON.stringify({ ...report, close: null });
  db.run("BEGIN");
  try {
    if (existing) run(db, `UPDATE financial_period_closes SET closed_at=?,closed_by=?,snapshot_json=?,reopened_at=NULL,reopened_by=NULL,reopen_reason=NULL WHERE id=?`, [now, actorId, snapshot, id]);
    else run(db, `INSERT INTO financial_period_closes(id,period_start,period_end,closed_at,closed_by,snapshot_json) VALUES(?,?,?,?,?,?)`, [id, start, end, now, actorId, snapshot]);
    run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
      VALUES(?, 'period_closed', 'financial_period', ?, ?, ?, ?)`,
    [randomUUID(), id, JSON.stringify({ period_start: start, period_end: end }), now, actorId]);
    const closeEvent: FinancialPeriodEvent = {
      event_id: eventId, action: "close",
      period: { id, period_start: start, period_end: end, closed_at: now, closed_by: actorId,
        snapshot_json: snapshot, reopened_at: null, reopen_reason: null },
    };
    run(db, `INSERT INTO sync_queue(entity,op,payload,created_at) VALUES('financial_period','apply',?,?)`, [JSON.stringify(closeEvent), now]);
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
  return periodClose(db, start, end)!;
}

export function reopenFinancialPeriod(db: Database, start: string, end: string, reason: string, actorId: string | null): void {
  const trimmed = reason.trim();
  if (trimmed.length < 8 || trimmed.length > 300) throw new Error("Give a clear reason (8–300 characters) for reopening the period.");
  const close = periodClose(db, start, end);
  if (!close || close.reopened_at) throw new Error("That period is not currently closed.");
  const now = new Date().toISOString();
  const eventId = randomUUID();
  db.run("BEGIN");
  try {
    run(db, `UPDATE financial_period_closes SET reopened_at=?,reopened_by=?,reopen_reason=? WHERE id=?`, [now, actorId, trimmed, close.id]);
    run(db, `INSERT INTO financial_audit_events(id,event_type,entity_type,entity_id,details,created_at,created_by)
      VALUES(?, 'period_reopened', 'financial_period', ?, ?, ?, ?)`,
    [randomUUID(), close.id, JSON.stringify({ reason: trimmed }), now, actorId]);
    const reopenEvent: FinancialPeriodEvent = {
      event_id: eventId, action: "reopen",
      period: { ...close, reopened_at: now, reopened_by: actorId, reopen_reason: trimmed },
    };
    run(db, `INSERT INTO sync_queue(entity,op,payload,created_at) VALUES('financial_period','apply',?,?)`, [JSON.stringify(reopenEvent), now]);
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

export function pullFinancialPeriods(db: Database, rows: FinancialPeriodClose[]): number {
  const pendingKeys = new Set(all<{ payload: string }>(db, `SELECT payload FROM sync_queue WHERE entity='financial_period' AND synced_at IS NULL`)
    .flatMap(row => {
      try {
        const period = (JSON.parse(row.payload) as FinancialPeriodEvent).period;
        return [`${period.period_start}:${period.period_end}`];
      } catch { return []; }
    }));
  let imported = 0;
  for (const period of rows) {
    if (!validDate(period.period_start) || !validDate(period.period_end) || pendingKeys.has(`${period.period_start}:${period.period_end}`)) continue;
    run(db, `INSERT INTO financial_period_closes(id,period_start,period_end,closed_at,closed_by,snapshot_json,reopened_at,reopen_reason)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(period_start,period_end) DO UPDATE SET
      id=excluded.id,closed_at=excluded.closed_at,closed_by=excluded.closed_by,snapshot_json=excluded.snapshot_json,
      reopened_at=excluded.reopened_at,reopen_reason=excluded.reopen_reason`,
    [period.id, period.period_start, period.period_end, period.closed_at, period.closed_by,
      period.snapshot_json, period.reopened_at, period.reopen_reason]);
    imported++;
  }
  return imported;
}

export function pullDailyRates(db: Database, rows: { business_date: string; sdg_per_usd: number; updated_at: string }[]): number {
  const pendingDates = new Set(all<{ payload: string }>(db, `SELECT payload FROM sync_queue WHERE entity='exchange_rate' AND synced_at IS NULL`)
    .flatMap(row => {
      try { return [(JSON.parse(row.payload) as { business_date?: string }).business_date ?? ""]; }
      catch { return []; }
    }));
  let imported = 0;
  for (const row of rows) {
    if (!validDate(row.business_date) || !Number.isFinite(row.sdg_per_usd) || row.sdg_per_usd <= 0 || pendingDates.has(row.business_date)) continue;
    const current = get<{ updated_at: string }>(db, `SELECT updated_at FROM daily_exchange_rates WHERE business_date=?`, [row.business_date]);
    if (current && current.updated_at >= row.updated_at) continue;
    run(db, `INSERT INTO daily_exchange_rates(business_date,sdg_per_usd,updated_at) VALUES(?,?,?)
      ON CONFLICT(business_date) DO UPDATE SET sdg_per_usd=excluded.sdg_per_usd,updated_at=excluded.updated_at`,
    [row.business_date, row.sdg_per_usd, row.updated_at]);
    imported++;
  }
  return imported;
}

export function pullRateAudit(db: Database, rows: { id: string; business_date: string; sdg_per_usd: number; created_at: string; created_by: string | null }[]): number {
  let imported = 0;
  for (const row of rows) {
    if (!row.id || !validDate(row.business_date) || !Number.isFinite(row.sdg_per_usd) || row.sdg_per_usd <= 0) continue;
    const exists = get<{ id: string }>(db, `SELECT id FROM exchange_rate_audit WHERE id=?`, [row.id]);
    if (exists) continue;
    run(db, `INSERT INTO exchange_rate_audit(id,business_date,sdg_per_usd,updated_at,updated_by) VALUES(?,?,?,?,?)`,
      [row.id, row.business_date, row.sdg_per_usd, row.created_at, row.created_by]);
    imported++;
  }
  return imported;
}

export function listOpenExceptions(db: Database): InventoryException[] {
  const now = new Date().toISOString();
  const expired = all<{ id: string; product_id: string; lot_no: string; quantity: number; expiry_date: string }>(db,
    `SELECT id, product_id, lot_no, quantity, expiry_date FROM batches
     WHERE quantity > 0 AND expiry_date < date('now','localtime')`);
  for (const lot of expired) {
    const key = `expired:${lot.id}`;
    run(db, `INSERT INTO inventory_exceptions
      (id, exception_key, kind, product_id, expected_quantity, actual_quantity, details, detected_at, resolved_at)
      VALUES (?, ?, 'expired_stock', ?, ?, NULL, ?, ?, NULL)
      ON CONFLICT(exception_key) DO UPDATE SET expected_quantity=excluded.expected_quantity,
        details=excluded.details, detected_at=excluded.detected_at, resolved_at=NULL`,
    [`expired-${lot.id}`, key, lot.product_id, lot.quantity,
      `Lot ${lot.lot_no} has ${lot.quantity} unit(s) past expiry (${lot.expiry_date}).`, now]);
  }
  const missingCosts = all<{ sale_id: string; sale_no: string; quantity: number }>(db,
    `SELECT s.id AS sale_id, s.sale_no, SUM(si.quantity) AS quantity FROM sales s
     JOIN sale_items si ON si.sale_id=s.id WHERE si.unit_cost_at_sale IS NULL GROUP BY s.id, s.sale_no`);
  for (const sale of missingCosts) {
    const key = `missing-cost:${sale.sale_id}`;
    run(db, `INSERT INTO inventory_exceptions
      (id, exception_key, kind, product_id, expected_quantity, actual_quantity, details, detected_at, resolved_at)
      VALUES (?, ?, 'missing_cost_history', NULL, ?, NULL, ?, ?, NULL)
      ON CONFLICT(exception_key) DO UPDATE SET expected_quantity=excluded.expected_quantity,
        details=excluded.details, detected_at=excluded.detected_at, resolved_at=NULL`,
    [`missing-cost-${sale.sale_id}`, key, sale.quantity,
      `Sale ${sale.sale_no} has ${sale.quantity} sold unit(s) without a historical lot cost; COGS cannot be reconstructed safely.`, now]);
  }
  const pending = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM sync_queue WHERE synced_at IS NULL`)?.n ?? 0;
  if (pending > 0) {
    run(db, `INSERT INTO inventory_exceptions
      (id, exception_key, kind, product_id, expected_quantity, actual_quantity, details, detected_at, resolved_at)
      VALUES ('sync-pending', 'sync-pending', 'sync_pending', NULL, ?, NULL, ?, ?, NULL)
      ON CONFLICT(exception_key) DO UPDATE SET expected_quantity=excluded.expected_quantity,
        details=excluded.details, detected_at=excluded.detected_at, resolved_at=NULL`,
    [pending, `${pending} inventory or financial event(s) have not been confirmed by the shared pharmacy ledger.`, now]);
  } else {
    run(db, `UPDATE inventory_exceptions SET resolved_at=? WHERE exception_key='sync-pending' AND resolved_at IS NULL`, [now]);
  }
  const activeExpired = new Set(expired.map(lot => `expired:${lot.id}`));
  for (const row of all<{ id: string; exception_key: string }>(db,
    `SELECT id, exception_key FROM inventory_exceptions WHERE kind='expired_stock' AND resolved_at IS NULL`)) {
    if (!activeExpired.has(row.exception_key)) run(db, `UPDATE inventory_exceptions SET resolved_at=? WHERE id=?`, [now, row.id]);
  }
  return all<InventoryException>(db, `SELECT id, kind, product_id, expected_quantity,
    actual_quantity, details, detected_at FROM inventory_exceptions WHERE resolved_at IS NULL
    ORDER BY detected_at DESC`);
}
