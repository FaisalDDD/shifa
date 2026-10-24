// Sales history: full list of sales with line items, flags, and customer, for
// the admin review view + PDF export.

import type { Database } from "sql.js";
import { all } from "./db";
import type { SaleHistoryItem, SaleHistoryRow } from "../shared/types";

interface SaleRow {
  id: string;
  sale_no: string;
  total: number;
  flagged: number;
  customer_name: string | null;
  payment_method: string | null;
  created_at: string;
  business_date: string;
}

export function listSales(db: Database, limit = 500, start?: string, end?: string): SaleHistoryRow[] {
  const dateFilter = start && end ? "WHERE s.business_date >= ? AND s.business_date <= ?" : "";
  const params: unknown[] = start && end ? [start, end, limit] : [limit];
  const rows = all<SaleRow>(
    db,
    `SELECT s.id, s.sale_no, s.total, s.flagged,
            s.business_date,
            c.name AS customer_name, s.payment_method, s.created_at
     FROM sales s
     LEFT JOIN customers c ON c.id = s.customer_id
     ${dateFilter}
     ORDER BY s.created_at DESC
     LIMIT ?`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    sale_no: r.sale_no,
    total: r.total,
    flagged: !!r.flagged,
    customer_name: r.customer_name,
    payment_method: r.payment_method,
    created_at: r.created_at,
    business_date: r.business_date,
    cogs: (all<{ cogs_minor: number | null }>(db,
      `SELECT SUM(accounting_cost_minor) AS cogs_minor FROM sale_items WHERE sale_id = ?`, [r.id])[0]?.cogs_minor ?? 0) / 100,
    missing_cost_lines: all<{ n: number }>(db,
      `SELECT COALESCE(SUM(CASE WHEN accounting_cost_minor IS NULL THEN quantity ELSE 0 END), 0) AS n
       FROM sale_items WHERE sale_id = ?`, [r.id])[0]?.n ?? 0,
    items: all<SaleHistoryItem>(
      db,
      `SELECT COALESCE(p.canonical_name, si.product_id) AS product_name,
              si.quantity, si.unit_price
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?
       ORDER BY si.id`,
      [r.id],
    ),
  }));
}
