// Offline-first local database (SQLite via sql.js, compiled to WASM — no native
// build step, works everywhere). Owned by the Electron main process; the renderer
// never touches it directly. Persisted to a file so sales survive restarts.

import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

let SQL: SqlJsStatic | null = null;

async function loadSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

// Single string with multiple statements; run via db.exec().
const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  brand_name TEXT,
  strength TEXT,
  dosage_form TEXT,
  barcode TEXT,
  image_url TEXT,
  price REAL,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  prescription_classification TEXT NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  lot_no TEXT NOT NULL,
  expiry_date TEXT,
  mfg_date TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price REAL,
  sale_price REAL,
  strips_per_box INTEGER,
  pills_per_strip INTEGER
);

CREATE INDEX IF NOT EXISTS idx_batches_product_expiry
  ON batches (product_id, expiry_date);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  sale_no TEXT NOT NULL UNIQUE,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  customer_id TEXT,
  payment_method TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  business_date TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'SDG'
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  batch_id TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  unit_cost_at_sale REAL,
  accounting_cost_minor INTEGER,
  accounting_cost_method TEXT NOT NULL DEFAULT 'legacy_batch_cost'
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  batch_id TEXT,
  sale_id TEXT,
  quantity_delta INTEGER NOT NULL,
  unit_cost REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_exchange_rates (
  business_date TEXT PRIMARY KEY,
  sdg_per_usd REAL NOT NULL CHECK(sdg_per_usd > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_rate_audit (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  sdg_per_usd REAL NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Financial amounts are stored in integer minor units in the journal. The
-- existing operational tables remain intact for compatibility with older
-- Shifa Pro installations.
CREATE TABLE IF NOT EXISTS financial_accounts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS financial_journals (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  business_date TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  description TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SDG',
  costing_method TEXT,
  is_complete INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','reversed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_journals_source
  ON financial_journals(entry_type, source_type, source_id)
  WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_journals_date
  ON financial_journals(business_date, created_at);

CREATE TABLE IF NOT EXISTS financial_cost_layers (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  batch_id TEXT,
  original_qty INTEGER NOT NULL CHECK(original_qty >= 0),
  remaining_qty INTEGER NOT NULL CHECK(remaining_qty >= 0),
  unit_cost_minor INTEGER,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_cost_layers_fifo
  ON financial_cost_layers(product_id, received_at, id, remaining_qty);

CREATE TABLE IF NOT EXISTS financial_journal_lines (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES financial_journals(id),
  account_code TEXT NOT NULL REFERENCES financial_accounts(code),
  debit_minor INTEGER NOT NULL DEFAULT 0 CHECK(debit_minor >= 0),
  credit_minor INTEGER NOT NULL DEFAULT 0 CHECK(credit_minor >= 0),
  memo TEXT,
  CHECK(debit_minor = 0 OR credit_minor = 0)
);
CREATE INDEX IF NOT EXISTS idx_financial_lines_account ON financial_journal_lines(account_code, journal_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  supplier TEXT,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','bank','unpaid')),
  status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','voided')),
  journal_id TEXT NOT NULL REFERENCES financial_journals(id),
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(business_date, created_at);

CREATE TABLE IF NOT EXISTS financial_period_closes (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  closed_at TEXT NOT NULL,
  closed_by TEXT,
  snapshot_json TEXT NOT NULL,
  reopened_at TEXT,
  reopened_by TEXT,
  reopen_reason TEXT,
  UNIQUE(period_start, period_end)
);

CREATE TABLE IF NOT EXISTS financial_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS inventory_exceptions (
  id TEXT PRIMARY KEY,
  exception_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  product_id TEXT,
  expected_quantity INTEGER,
  actual_quantity INTEGER,
  details TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  supplier TEXT,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  amount_paid REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  birth_date TEXT,
  age TEXT,
  address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','bank')),
  business_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_purchase ON supplier_payments(purchase_id, business_date);

CREATE TABLE IF NOT EXISTS customer_credit_invoices (
  sale_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  total_minor INTEGER NOT NULL CHECK(total_minor >= 0),
  paid_minor INTEGER NOT NULL DEFAULT 0 CHECK(paid_minor >= 0),
  due_date TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_credit_due ON customer_credit_invoices(customer_id, due_date, created_at);
CREATE TABLE IF NOT EXISTS customer_credit_payment_allocations (
  customer_payment_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY(customer_payment_id, sale_id)
);

CREATE TABLE IF NOT EXISTS price_adjustment_batches (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','rolled_back')),
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE TABLE IF NOT EXISTS price_adjustment_items (
  batch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  old_price REAL,
  new_price REAL NOT NULL,
  PRIMARY KEY(batch_id, product_id)
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vacation_requests (
  id TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  colleague_name TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
`;

export interface LocalDb {
  db: Database;
  filePath: string;
}

export async function openDb(filePath: string): Promise<LocalDb> {
  const SQL = await loadSql();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath)
    : undefined;

  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.exec(SCHEMA);
  // Defensive migrations for DBs created before a column/table existed.
  const alter = (sql: string) => {
    try {
      db.exec(sql);
    } catch {
      /* already present */
    }
  };
  alter("ALTER TABLE products ADD COLUMN image_url TEXT");
  alter("ALTER TABLE products ADD COLUMN price REAL");
  alter("ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5");
  alter("ALTER TABLE batches ADD COLUMN mfg_date TEXT");
  alter("ALTER TABLE batches ADD COLUMN sale_price REAL");
  alter("ALTER TABLE batches ADD COLUMN strips_per_box INTEGER");
  alter("ALTER TABLE batches ADD COLUMN pills_per_strip INTEGER");
  alter("ALTER TABLE sales ADD COLUMN customer_id TEXT");
  alter("ALTER TABLE sales ADD COLUMN payment_method TEXT");
  alter("ALTER TABLE sales ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0");
  alter("ALTER TABLE sales ADD COLUMN business_date TEXT NOT NULL DEFAULT ''");
  alter("ALTER TABLE sales ADD COLUMN currency TEXT NOT NULL DEFAULT 'SDG'");
  alter("ALTER TABLE sale_items ADD COLUMN unit_cost_at_sale REAL");
  alter("ALTER TABLE sale_items ADD COLUMN accounting_cost_minor INTEGER");
  alter("ALTER TABLE sale_items ADD COLUMN accounting_cost_method TEXT NOT NULL DEFAULT 'legacy_batch_cost'");
  alter("ALTER TABLE financial_journals ADD COLUMN costing_method TEXT");
  alter("ALTER TABLE purchases ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'");
  alter("ALTER TABLE purchases ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0");
  alter("ALTER TABLE purchases ADD COLUMN invoice_no TEXT");
  alter("ALTER TABLE purchases ADD COLUMN due_date TEXT");
  alter("ALTER TABLE purchases ADD COLUMN notes TEXT");
  alter("ALTER TABLE purchases ADD COLUMN attachment_path TEXT");
  alter("ALTER TABLE exchange_rate_audit ADD COLUMN updated_by TEXT");
  alter("ALTER TABLE customers ADD COLUMN birth_date TEXT");
  alter("ALTER TABLE customers ADD COLUMN age TEXT");
  alter("ALTER TABLE customers ADD COLUMN address TEXT");
  db.exec("UPDATE sales SET business_date = substr(created_at, 1, 10) WHERE business_date = ''");
  db.exec(`INSERT OR IGNORE INTO customer_credit_invoices(sale_id,customer_id,total_minor,paid_minor,due_date,created_at)
    SELECT id,customer_id,CAST(ROUND(total*100) AS INTEGER),0,date(business_date,'+30 days'),created_at
    FROM sales WHERE payment_method='later' AND customer_id IS NOT NULL`);
  const legacyCreditPayments = all<{ id: string; customer_id: string; amount: number; created_at: string }>(db,
    `SELECT l.id,l.customer_id,l.amount,l.created_at FROM customer_ledger l WHERE l.amount<0
      AND NOT EXISTS(SELECT 1 FROM customer_credit_payment_allocations a WHERE a.customer_payment_id=l.id)
      ORDER BY l.customer_id,l.created_at,l.id`);
  for (const creditPayment of legacyCreditPayments) {
    let remaining = Math.round(Math.abs(creditPayment.amount) * 100);
    const invoices = all<{ sale_id: string; total_minor: number; paid_minor: number }>(db,
      `SELECT sale_id,total_minor,paid_minor FROM customer_credit_invoices WHERE customer_id=?
        AND total_minor>paid_minor ORDER BY COALESCE(due_date,'9999-12-31'),created_at,sale_id`, [creditPayment.customer_id]);
    for (const invoice of invoices) {
      if (remaining <= 0) break;
      const part = Math.min(remaining, invoice.total_minor - invoice.paid_minor);
      if (part <= 0) continue;
      run(db, `UPDATE customer_credit_invoices SET paid_minor=paid_minor+? WHERE sale_id=?`, [part, invoice.sale_id]);
      run(db, `INSERT OR IGNORE INTO customer_credit_payment_allocations(customer_payment_id,sale_id,amount_minor,created_at) VALUES(?,?,?,?)`,
        [creditPayment.id, invoice.sale_id, part, creditPayment.created_at]);
      remaining -= part;
    }
  }
  db.exec(`INSERT INTO inventory_movements
    (id, event_id, movement_type, product_id, batch_id, quantity_delta, unit_cost, created_at)
    SELECT 'opening-' || b.id, 'opening-' || b.id, 'opening', b.product_id, b.id,
      b.quantity, b.cost_price, datetime('now')
    FROM batches b WHERE NOT EXISTS (
      SELECT 1 FROM inventory_movements m WHERE m.batch_id = b.id AND m.movement_type = 'opening'
    )`);

  db.exec(`INSERT OR IGNORE INTO financial_accounts(code, name, account_type) VALUES
    ('cash_on_hand', 'Cash on hand', 'asset'),
    ('bank', 'Bank', 'asset'),
    ('accounts_receivable', 'Accounts receivable', 'asset'),
    ('inventory', 'Inventory', 'asset'),
    ('accounts_payable', 'Accounts payable', 'liability'),
    ('sales_revenue', 'Sales revenue', 'income'),
    ('cost_of_goods_sold', 'Cost of goods sold', 'expense'),
    ('inventory_writeoff', 'Inventory loss and write-off', 'expense'),
    ('expense:rent', 'Rent', 'expense'),
    ('expense:payroll', 'Payroll', 'expense'),
    ('expense:utilities', 'Utilities', 'expense'),
    ('expense:transport', 'Transport', 'expense'),
    ('expense:maintenance', 'Maintenance', 'expense'),
    ('expense:bank_charges', 'Bank charges', 'expense'),
    ('expense:marketing', 'Marketing', 'expense'),
    ('expense:other', 'Other operating expense', 'expense')`);
  return { db, filePath };
}

export function persist(db: LocalDb): void {
  // Never truncate the only durable copy. Prepare and flush a sibling file,
  // preserve the last committed snapshot, then atomically replace the target.
  const data = Buffer.from(db.db.export());
  const temporary = `${db.filePath}.${randomUUID()}.tmp`;
  const backupTemporary = `${db.filePath}.bak.${randomUUID()}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, data);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (fs.existsSync(db.filePath)) {
      fs.copyFileSync(db.filePath, backupTemporary, fs.constants.COPYFILE_EXCL);
      fs.renameSync(backupTemporary, `${db.filePath}.bak`);
    }
    fs.renameSync(temporary, db.filePath);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
    fs.rmSync(backupTemporary, { force: true });
  }
}

export function closeDb(db: LocalDb): void {
  persist(db);
  db.db.close();
}

// ---- Query helpers (positional params, sql.js style) ----

export function run(db: Database, sql: string, params: unknown[] = []): void {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params as never);
    stmt.step();
  } finally {
    stmt.free();
  }
}

export function all<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: unknown[] = [],
): T[] {
  const stmt = db.prepare(sql);
  const rows: T[] = [];
  try {
    stmt.bind(params as never);
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
  } finally {
    stmt.free();
  }
  return rows;
}

export function get<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: unknown[] = [],
): T | undefined {
  return all<T>(db, sql, params)[0];
}

export function setMeta(db: Database, key: string, value: string): void {
  run(
    db,
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export function getMeta(db: Database, key: string): string | null {
  const row = get<{ value: string }>(db, `SELECT value FROM meta WHERE key = ?`, [
    key,
  ]);
  return row ? row.value : null;
}
