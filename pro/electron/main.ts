// Shifa Pro — Electron main process.
// Owns the local SQLite DB and all Supabase I/O; the renderer is a thin UI that
// talks to it over IPC (contextIsolation on, no nodeIntegration).

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { openDb, persist, type LocalDb } from "../src/main/db";
import { recordSale, receiveBatch, getStockLevels, removeStock } from "../src/main/stock";
import {
  pullProducts,
  pullFinancialData,
  listProducts,
  setProductPrice,
  pushQueue,
  getSyncStatus,
  reconcileInventory,
} from "../src/main/sync";
import {
  closeFinancialPeriod,
  createExpense,
  financialReport,
  listExpenses,
  listFinancialJournal,
  listOpenExceptions,
  migrateLegacyFinancialHistory,
  reopenFinancialPeriod,
  saveDailyRate,
} from "../src/main/financial";
import {
  signIn,
  pharmacyTeamAction,
  changePassword,
  postgrest,
  insertProduct,
  uploadProductImage,
  lookupProductImage,
} from "../src/main/supabase";
import { listExpiring, getInventorySuggestions } from "../src/main/insights";
import {
  mostPurchasedProducts,
  outstandingPayables,
  markPaid,
  recordSupplierPayment,
  supplierPaymentHistory,
  savePurchaseAttachment,
  purchaseAttachment,
} from "../src/main/purchases";
import {
  addCustomer,
  listCustomers,
  listCustomerCreditInvoices,
  settleCustomerBalance,
} from "../src/main/customers";
import { listSales } from "../src/main/sales";
import { applyPriceAdjustment, latestPriceAdjustment, previewPriceAdjustment, rollbackPriceAdjustment, type PriceScope } from "../src/main/price-management";
import {
  addVacation,
  listVacations,
  addShiftSwap,
  listShiftSwaps,
} from "../src/main/hr";
import type { AuthSession, AttendanceEvent, CartLine, CustomerCreditInvoice, EmployeeCompensation, ExpenseRow, FinancialJournalRow, FinancialReport, HrAuditEvent, PaymentStatus, PayablesSummary, PharmacyEmployee, SaleHistoryRow, StaffEmployeeOption, StaffNotification, StaffShiftSwapRequest, TimeCorrectionRequest, WorkforceSettings } from "../src/shared/types";
import { getSupabaseConfig, loadSupabaseConfig, saveSupabaseConfig } from "../src/main/config";

let localDb: LocalDb | null = null;
let session: AuthSession | null = null;
let pharmacyId: string | null = null;
const STAFF_CARD_COLORS = ["#2563eb", "#0f9f83", "#a34db8", "#d97706", "#e34f6f", "#5367c8"];

async function db(): Promise<LocalDb> {
  if (!localDb) {
    localDb = await openDb(path.join(app.getPath("userData"), "shifa-pro.db"));
    migrateLegacyFinancialHistory(localDb.db);
    persist(localDb);
  }
  return localDb;
}

function requirePharmacyOperator(): void {
  if (!session || (session.role !== "admin" && !pharmacyId)) {
    throw new Error("Sign in with an account linked to this pharmacy.");
  }
}

function requirePharmacyOwner(): void {
  requirePharmacyOperator();
  if (session?.role !== "admin" && session?.membership_role !== "owner") {
    throw new Error("Only the pharmacy owner can manage staff and shifts.");
  }
}

function requireFinanceAccess(): void {
  requirePharmacyOperator();
  if (session?.role !== "admin" && session?.membership_role !== "owner") {
    throw new Error("Financial records are available to the pharmacy owner only.");
  }
}

function decodeDataUrl(dataUrl: string): {
  buffer: Buffer;
  contentType: string;
  filename: string;
} {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data");
  const contentType = match[1];
  const ext = (contentType.split("/")[1] ?? "png").split("+")[0];
  return {
    buffer: Buffer.from(match[2], "base64"),
    contentType,
    filename: `${randomUUID()}.${ext}`,
  };
}

function buildFinancialHtml(sales: SaleHistoryRow[], report: FinancialReport, exceptions: ReturnType<typeof listOpenExceptions>, expenses: ExpenseRow[], journal: FinancialJournalRow[], payables: PayablesSummary, customerInvoices: CustomerCreditInvoice[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = sales
    .map((s) => {
      const items = s.items
        .map((i) => `${esc(i.product_name)} × ${i.quantity} @ ${i.unit_price.toFixed(2)}`)
        .join("<br>");
      return `<tr>
        <td>${esc(s.sale_no)}</td>
        <td>${esc(s.created_at.slice(0, 19).replace("T", " "))}</td>
        <td>${esc(s.customer_name ?? "—")}</td>
        <td>${esc(s.payment_method ?? "—")}</td>
        <td>${items}</td>
        <td style="text-align:right">${s.total.toFixed(2)}</td>
        <td style="text-align:right">${s.missing_cost_lines ? "Incomplete" : s.cogs.toFixed(2)}</td>
        <td>${s.flagged ? "⚠ flagged" : ""}</td>
      </tr>`;
    })
    .join("");
  const exceptionRows = exceptions.map(ex => `<li><strong>${esc(ex.kind)}</strong>: ${esc(ex.details)}</li>`).join("");
  const expenseRows = expenses.map(expense => `<tr><td>${expense.business_date}</td><td>${esc(expense.category)}</td><td>${esc(expense.description)}</td><td>${esc(expense.supplier ?? "—")}</td><td>${esc(expense.payment_method)}</td><td style="text-align:right">${expense.amount_sdg.toFixed(2)}</td></tr>`).join("");
  const journalRows = journal.map(entry => `<tr><td>${entry.business_date}</td><td>${esc(entry.entry_type)}</td><td>${esc(entry.description)}</td><td style="text-align:right">${entry.amount_sdg.toFixed(2)}</td><td>${entry.is_complete ? "Complete" : "Needs review"}</td></tr>`).join("");
  const supplierRows = payables.rows.map(row => `<tr><td>${esc(row.supplier ?? "Supplier not set")}</td><td>${esc(row.invoice_no ?? row.product_name)}</td><td>${row.created_at.slice(0,10)}</td><td>${esc(row.due_date ?? "—")}</td><td style="text-align:right">${row.total_cost.toFixed(2)}</td><td style="text-align:right">${row.amount_paid.toFixed(2)}</td><td style="text-align:right">${row.remaining.toFixed(2)}</td></tr>`).join("");
  const customerRows = customerInvoices.map(row => {
    const ageDays = row.due_date ? Math.floor((Date.now() - new Date(`${row.due_date}T00:00:00`).getTime()) / 86400000) : 0;
    const age = !row.due_date || ageDays <= 0 ? "Not due" : ageDays <= 7 ? "1–7 days overdue" : ageDays <= 30 ? "8–30 days overdue" : ">30 days overdue";
    return `<tr><td>${esc(row.customer_name)}</td><td>${esc(row.sale_no)}</td><td>${row.created_at.slice(0,10)}</td><td>${esc(row.due_date ?? "—")}</td><td>${age}</td><td style="text-align:right">${row.total_sdg.toFixed(2)}</td><td style="text-align:right">${row.paid_sdg.toFixed(2)}</td><td style="text-align:right">${row.balance_sdg.toFixed(2)}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Segoe UI,system-ui,sans-serif;color:#0f1c33;margin:24px}
      h1{color:#002a68;font-size:20px;margin:0 0 2px}
      .sub{color:#5a6b85;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #e3e9f2;padding:6px 8px;text-align:left}
      th{background:#002a68;color:#fff}
      .tot{margin-top:12px;font-weight:700;text-align:right}
      .note{padding:10px 12px;background:#fff8e8;border:1px solid #f2d28d;border-radius:8px;font-size:11px;color:#58451b;margin:12px 0}
      h2{margin-top:24px;color:#123d73;font-size:15px}
    </style></head><body>
    <h1>Shifa Pro — Financial report</h1>
    <div class="sub">Report period: ${report.period} · Operating currency: SDG · ${report.sale_count} sale(s) · ${report.financial_event_count} journal event(s)</div>
    <table><tbody>
      <tr><th>Sales revenue</th><td style="text-align:right">${report.revenue_sdg.toFixed(2)} SDG</td></tr>
      <tr><th>Cost of goods sold</th><td style="text-align:right">${report.cogs_sdg.toFixed(2)} SDG</td></tr>
      <tr><th>Gross profit</th><td style="text-align:right">${report.gross_profit_sdg === null ? "Incomplete cost history" : `${report.gross_profit_sdg.toFixed(2)} SDG`}</td></tr>
      <tr><th>Operating expenses</th><td style="text-align:right">${report.operating_expenses_sdg.toFixed(2)} SDG</td></tr>
      <tr><th>Inventory write-offs</th><td style="text-align:right">${report.inventory_writeoff_sdg.toFixed(2)} SDG</td></tr>
      <tr><th>Net operating result</th><td style="text-align:right">${report.net_profit_sdg === null ? "Incomplete cost history" : `${report.net_profit_sdg.toFixed(2)} SDG`}</td></tr>
    </tbody></table>
    <h2>Position and cash flow</h2><table><tbody>
      <tr><th>Cash from sales</th><td style="text-align:right">${report.sales_collected_sdg.toFixed(2)} SDG</td><th>Expenses paid</th><td style="text-align:right">${report.expenses_paid_sdg.toFixed(2)} SDG</td></tr>
      <tr><th>Net cash movement</th><td style="text-align:right">${report.cashflow_sdg.toFixed(2)} SDG</td><th>Cash balance</th><td style="text-align:right">${report.cash_balance_sdg.toFixed(2)} SDG</td></tr>
      <tr><th>Bank balance</th><td style="text-align:right">${report.bank_balance_sdg.toFixed(2)} SDG</td><th>Receivables</th><td style="text-align:right">${report.receivables_sdg.toFixed(2)} SDG</td></tr>
      <tr><th>Payables</th><td style="text-align:right">${report.payables_sdg.toFixed(2)} SDG</td><th>Inventory at recorded cost</th><td style="text-align:right">${report.inventory_value_sdg.toFixed(2)} SDG</td></tr>
    </tbody></table>
    <div class="note">All financial records and this report use SDG. Sales revenue is distinct from cash collected: credit sales remain receivables until payment. New COGS uses FIFO receipt cost layers while physical shelf picking follows FEFO; earlier sales retain their recorded batch costs.</div>
    <div class="sub">Units without complete financial cost: ${report.missing_cost_lines} · Costing method: ${report.costing_method}</div>
    <h2>Expenses (${expenses.length})</h2>
    <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payee</th><th>Payment</th><th style="text-align:right">Amount SDG</th></tr></thead><tbody>${expenseRows || "<tr><td colspan=\"6\">None recorded</td></tr>"}</tbody></table>
    <h2>Supplier credit · outstanding ${payables.total_owed.toFixed(2)} SDG</h2>
    <table><thead><tr><th>Supplier</th><th>Invoice / product</th><th>Received</th><th>Due</th><th>Total SDG</th><th>Paid SDG</th><th>Remaining SDG</th></tr></thead><tbody>${supplierRows || "<tr><td colspan=\"7\">No supplier credit outstanding</td></tr>"}</tbody></table>
    <h2>Customer receivables · outstanding ${customerInvoices.reduce((sum,row) => sum + row.balance_sdg, 0).toFixed(2)} SDG</h2>
    <table><thead><tr><th>Customer</th><th>Sale</th><th>Date</th><th>Due</th><th>Age</th><th>Total SDG</th><th>Paid SDG</th><th>Balance SDG</th></tr></thead><tbody>${customerRows || "<tr><td colspan=\"8\">No open customer invoices</td></tr>"}</tbody></table>
    <h2>Journal activity (${journal.length})</h2>
    <table><thead><tr><th>Date</th><th>Entry</th><th>Description</th><th style="text-align:right">Amount SDG</th><th>Status</th></tr></thead><tbody>${journalRows || "<tr><td colspan=\"5\">None recorded</td></tr>"}</tbody></table>
    <h2>Open exceptions (${exceptions.length})</h2><ul>${exceptionRows || "<li>None</li>"}</ul>
    <div class="sub">Exported ${new Date().toISOString().slice(0, 19).replace("T", " ")}</div>
    <h2>Sales detail</h2>
    <table><thead><tr><th>Sale</th><th>Date</th><th>Customer</th><th>Payment</th><th>Items</th><th style="text-align:right">Total SDG</th><th style="text-align:right">COGS SDG</th><th>Flag</th></tr></thead>
    <tbody>${rows}</tbody></table>
    </body></html>`;
}

function registerIpc(): void {
  ipcMain.handle("settings:getBackend", () => {
    const { url, anonKey } = getSupabaseConfig();
    return { url, anonKey };
  });
  ipcMain.handle("settings:setBackend", (_e, input: { url: string; anonKey: string }) => {
    return saveSupabaseConfig(path.join(app.getPath("userData"), "backend.json"), input);
  });

  ipcMain.handle("auth:signIn", async (_e, email: string, password: string) => {
    const s = await signIn(email, password);
    let prof: { role: string }[];
    let members: { pharmacy_id: string; membership_role: "owner" | "staff" }[];
    try {
      [prof, members] = await Promise.all([
        postgrest<{ role: string }[]>(`profiles?id=eq.${s.user_id}&select=role`, { token: s.access_token }),
        postgrest<{ pharmacy_id: string; membership_role: "owner" | "staff" }[]>(
          `pharmacy_members?user_id=eq.${s.user_id}&select=pharmacy_id,membership_role`, { token: s.access_token }),
      ]);
    } catch (err) {
      throw new Error("Your email and password were accepted, but pharmacy sign-in is not initialized. Apply the Supabase migrations and deploy the pharmacy-team function.");
    }
    if (!prof.length) throw new Error("Your profile is missing. Contact the pharmacy owner or Shifa support.");
    const selectedPharmacyId = members[0]?.pharmacy_id ?? null;
    const membershipRole = members[0]?.membership_role ?? null;
    if (membershipRole === "staff" && selectedPharmacyId) {
      const access = await pharmacyTeamAction<{ employment_status: string }>(s.access_token, {
        action: "check_access", pharmacy_id: selectedPharmacyId,
      });
      if (["suspended", "deactivated"].includes(access.employment_status)) {
        throw new Error("Your pharmacy account is inactive. Contact the pharmacy administrator.");
      }
    }
    pharmacyId = selectedPharmacyId;
    const role = prof[0].role === "admin" ? "admin" : membershipRole ? "pharmacy_staff" : prof[0].role;
    session = { ...s, role, membership_role: membershipRole };
    return { session, pharmacyId };
  });

  ipcMain.handle("auth:signOut", async () => {
    session = null;
    pharmacyId = null;
  });

  ipcMain.handle("settings:changePassword", async (_e, newPassword: string) => {
    if (!session) throw new Error("Not signed in");
    await changePassword(session.access_token, newPassword);
  });

  ipcMain.handle("sync:pull", async () => {
    const d = await db();
    const count = await pullProducts(d.db);
    const financialCount = session && pharmacyId && (session.role === "admin" || session.membership_role === "owner")
      ? await pullFinancialData(d.db, session.access_token, pharmacyId)
      : 0;
    persist(d);
    return { count, financialCount };
  });

  ipcMain.handle("sync:push", async () => {
    const d = await db();
    if (!session || !pharmacyId) {
      return { pushed: 0, failed: 0, reason: "no-session" };
    }
    const result = await pushQueue(d.db, session.access_token, pharmacyId);
    if (result.failed === 0 && (session.role === "admin" || session.membership_role === "owner")) {
      await pullFinancialData(d.db, session.access_token, pharmacyId);
    }
    const reconciliation = result.failed === 0
      ? await reconcileInventory(d.db, session.access_token, pharmacyId)
      : null;
    persist(d);
    return { ...result, reconciliation };
  });

  ipcMain.handle("sync:reconcile", async () => {
    if (!session || !pharmacyId) throw new Error("Sign in to a linked pharmacy before reconciling.");
    const d = await db();
    const result = await reconcileInventory(d.db, session.access_token, pharmacyId);
    persist(d);
    return result;
  });

  ipcMain.handle("sync:status", async () => {
    const d = await db();
    return getSyncStatus(d.db, true);
  });

  ipcMain.handle("catalog:list", async (_e, query: string) => {
    const d = await db();
    return listProducts(d.db, query ?? "");
  });

  ipcMain.handle("stock:receive", async (_e, batch) => {
    requirePharmacyOperator();
    const d = await db();
    receiveBatch(d.db, {
      product_id: batch.product_id,
      lot_no: batch.lot_no,
      expiry_date: batch.expiry_date,
      mfg_date: batch.mfg_date ?? null,
      quantity: batch.quantity,
      unit_cost: batch.unit_cost ?? batch.cost_price,
      sale_price: batch.sale_price ?? null,
      supplier: batch.supplier ?? null,
      payment_status: batch.payment_status as PaymentStatus,
      amount_paid: batch.amount_paid ?? 0,
      payment_method: batch.payment_method === "bank" ? "bank" : "cash",
      invoice_no: batch.invoice_no ?? null,
      due_date: batch.due_date ?? null,
      notes: batch.notes ?? null,
      actor_id: session?.user_id ?? null,
    });
    persist(d);
  });

  ipcMain.handle("stock:remove", async (_e, productId: string) => {
    requireFinanceAccess();
    const d = await db();
    const removed = removeStock(d.db, productId, session?.user_id ?? null);
    persist(d);
    return removed;
  });

  ipcMain.handle("stock:levels", async () => {
    const d = await db();
    return getStockLevels(d.db);
  });

  ipcMain.handle(
    "sale:create",
    async (
      _e,
      lines: CartLine[],
      opts?: { customer_id?: string | null; payment_method?: string | null; due_date?: string | null },
    ) => {
      requirePharmacyOperator();
      const d = await db();
      const result = recordSale(d.db, lines, {
        customer_id: opts?.customer_id ?? null,
        payment_method: opts?.payment_method ?? null,
        actor_id: session?.user_id ?? null,
        due_date: opts?.due_date ?? null,
      });
      persist(d);
      return result;
    },
  );

  ipcMain.handle("customers:add", async (_e, input) => {
    const d = await db();
    const c = addCustomer(d.db, input);
    persist(d);
    return c;
  });

  ipcMain.handle("customers:list", async () => {
    const d = await db();
    return listCustomers(d.db);
  });

  ipcMain.handle("customers:invoices", async () => {
    requireFinanceAccess();
    const d = await db();
    return listCustomerCreditInvoices(d.db);
  });

  ipcMain.handle("customers:settle", async (_e, customerId: string, amount?: number, paymentMethod: "cash" | "bank" = "cash", invoiceId?: string | null) => {
    requirePharmacyOperator();
    const d = await db();
    const settled = settleCustomerBalance(d.db, customerId, session?.user_id ?? null, amount, paymentMethod, invoiceId);
    persist(d);
    return settled;
  });

  ipcMain.handle("sales:list", async () => {
    requireFinanceAccess();
    const d = await db();
    return listSales(d.db);
  });

  ipcMain.handle("sales:report", async (_e, start: string, end: string) => {
    requireFinanceAccess();
    const d = await db();
    return financialReport(d.db, start, end);
  });

  ipcMain.handle("sales:setRate", async (_e, date: string, rate: number) => {
    requireFinanceAccess();
    const d = await db();
    saveDailyRate(d.db, date, rate, session?.user_id ?? null);
    persist(d);
  });

  ipcMain.handle("finance:expenses:list", async (_e, start: string, end: string) => {
    requireFinanceAccess();
    const d = await db();
    return listExpenses(d.db, start, end);
  });

  ipcMain.handle("finance:expenses:create", async (_e, input) => {
    requireFinanceAccess();
    const d = await db();
    const expense = createExpense(d.db, input, session?.user_id ?? null);
    persist(d);
    return expense;
  });

  ipcMain.handle("finance:prices:preview", async (_e, scope: PriceScope, percent: number) => {
    requireFinanceAccess();
    const d = await db();
    return previewPriceAdjustment(d.db, scope, percent);
  });

  ipcMain.handle("finance:prices:latest", async () => {
    requireFinanceAccess();
    const d = await db();
    return latestPriceAdjustment(d.db);
  });

  ipcMain.handle("finance:prices:apply", async (_e, scope: PriceScope, percent: number, reason: string) => {
    requireFinanceAccess();
    const d = await db();
    const result = applyPriceAdjustment(d.db, scope, percent, reason, session?.user_id ?? null);
    persist(d);
    return result;
  });

  ipcMain.handle("finance:prices:rollback", async (_e, id: string) => {
    requireFinanceAccess();
    const d = await db();
    const count = rollbackPriceAdjustment(d.db, id, session?.user_id ?? null);
    persist(d);
    return count;
  });

  ipcMain.handle("finance:journal:list", async (_e, start: string, end: string) => {
    requireFinanceAccess();
    const d = await db();
    return listFinancialJournal(d.db, start, end, 250);
  });

  ipcMain.handle("finance:period:close", async (_e, start: string, end: string) => {
    requireFinanceAccess();
    const d = await db();
    const result = closeFinancialPeriod(d.db, start, end, session?.user_id ?? null);
    persist(d);
    return result;
  });

  ipcMain.handle("finance:period:reopen", async (_e, start: string, end: string, reason: string) => {
    requireFinanceAccess();
    const d = await db();
    reopenFinancialPeriod(d.db, start, end, reason, session?.user_id ?? null);
    persist(d);
  });

  ipcMain.handle("inventory:exceptions", async () => {
    requirePharmacyOperator();
    const d = await db();
    return listOpenExceptions(d.db);
  });

  ipcMain.handle("sales:exportPdf", async (_e, start: string, end: string) => {
    requireFinanceAccess();
    const d = await db();
    const report = financialReport(d.db, start, end);
    const sales = listSales(d.db, 5000, start, end);
    const exceptions = listOpenExceptions(d.db);
    const expenses = listExpenses(d.db, start, end);
    const journal = listFinancialJournal(d.db, start, end, 5000);
    const payables = outstandingPayables(d.db);
    const customerInvoices = listCustomerCreditInvoices(d.db);
    const html = buildFinancialHtml(sales, report, exceptions, expenses, journal, payables, customerInvoices);
    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await win.webContents.printToPDF({ printBackground: true });
    const filePath = path.join(app.getPath("downloads"), `shifa-sales-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, pdf);
    win.destroy();
    return filePath;
  });

  ipcMain.handle("product:submit", async (_e, submission) => {
    if (!session) throw new Error("Not signed in");
    let imageUrl: string | null = submission.image_url ?? null;
    if (submission.image_data_url) {
      const img = decodeDataUrl(submission.image_data_url);
      imageUrl = await uploadProductImage(
        session.access_token,
        img.buffer,
        img.filename,
        img.contentType,
      );
    }
    return insertProduct(session.access_token, session.user_id, {
      canonical_name: submission.canonical_name,
      brand_name: submission.brand_name,
      strength: submission.strength,
      dosage_form: submission.dosage_form,
      barcode: submission.barcode,
      prescription_classification: submission.prescription_classification,
      image_url: imageUrl,
    });
  });

  ipcMain.handle("product:lookupImage", async (_e, name: string) => {
    return lookupProductImage(name);
  });

  ipcMain.handle("product:setPrice", async (_e, productId: string, price: number) => {
    requireFinanceAccess();
    const d = await db();
    setProductPrice(d.db, productId, price, session?.user_id ?? null);
    persist(d);
  });

  ipcMain.handle("insights:expiring", async () => {
    requirePharmacyOperator();
    const d = await db();
    return listExpiring(d.db);
  });

  ipcMain.handle("insights:suggestions", async () => {
    requirePharmacyOperator();
    const d = await db();
    return getInventorySuggestions(d.db);
  });

  ipcMain.handle("purchases:mostPurchased", async () => {
    requirePharmacyOperator();
    const d = await db();
    return mostPurchasedProducts(d.db);
  });

  ipcMain.handle("purchases:payables", async () => {
    requireFinanceAccess();
    const d = await db();
    return outstandingPayables(d.db);
  });

  ipcMain.handle("purchases:payments", async (_e, purchaseId: string) => {
    requireFinanceAccess();
    const d = await db();
    return supplierPaymentHistory(d.db, purchaseId);
  });

  ipcMain.handle("purchases:attach", async (_e, purchaseId: string) => {
    requireFinanceAccess();
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [
      { name: "Invoice attachment", extensions: ["pdf", "png", "jpg", "jpeg", "webp"] },
    ] });
    if (result.canceled || !result.filePaths[0]) return null;
    const source = result.filePaths[0];
    const extension = path.extname(source).toLowerCase();
    if (![".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(extension)) throw new Error("Attach a PDF or image invoice.");
    const directory = path.join(app.getPath("userData"), "invoice-attachments");
    fs.mkdirSync(directory, { recursive: true });
    const destination = path.join(directory, `${purchaseId}${extension}`);
    fs.copyFileSync(source, destination);
    const d = await db();
    savePurchaseAttachment(d.db, purchaseId, destination);
    persist(d);
    return destination;
  });

  ipcMain.handle("purchases:openAttachment", async (_e, purchaseId: string) => {
    requireFinanceAccess();
    const d = await db();
    const storedPath = purchaseAttachment(d.db, purchaseId);
    if (!storedPath) throw new Error("No invoice attachment is saved for this record.");
    const directory = path.resolve(app.getPath("userData"), "invoice-attachments");
    const target = path.resolve(storedPath);
    if (!target.startsWith(`${directory}${path.sep}`) || !fs.existsSync(target)) throw new Error("The saved invoice attachment could not be found.");
    const error = await shell.openPath(target);
    if (error) throw new Error(`Couldn't open invoice attachment: ${error}`);
  });

  ipcMain.handle("purchases:markPaid", async (_e, id: string, paymentMethod: "cash" | "bank" = "cash") => {
    requireFinanceAccess();
    const d = await db();
    markPaid(d.db, id, session?.user_id ?? null, paymentMethod);
    persist(d);
  });

  ipcMain.handle("purchases:pay", async (_e, id: string, amount: number, paymentMethod: "cash" | "bank" = "cash") => {
    requireFinanceAccess();
    const d = await db();
    const paid = recordSupplierPayment(d.db, id, amount, session?.user_id ?? null, paymentMethod);
    persist(d);
    return paid;
  });

  ipcMain.handle("hr:shift:add", async (_e, input: {
    id?: string; employee_user_id: string; date: string; start_time: string; end_time: string;
    location?: string | null; role_label?: string | null; break_minutes?: number; timezone?: string; notes?: string | null;
  }) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const result = await pharmacyTeamAction<{ shift: {
      id: string; employee_user_id: string; shift_date: string; start_time: string; end_time: string;
      notes: string | null; status: "draft" | "published" | "cancelled"; location: string | null;
      role_label: string | null; break_minutes: number; timezone: string;
    } }>(session.access_token, {
      action: "save_shift", pharmacy_id: pharmacyId,
      shift: { ...input, shift_date: input.date },
    });
    const member = await pharmacyTeamAction<{ members: { user_id: string; display_name: string | null; profiles?: { display_name: string | null; email: string | null } | null }[] }>(
      session.access_token, { action: "list_team", pharmacy_id: pharmacyId });
    const employee = member.members.find((m) => m.user_id === result.shift.employee_user_id);
    return { id: result.shift.id, employee_user_id: result.shift.employee_user_id,
      staff_name: employee?.display_name || employee?.profiles?.display_name || employee?.profiles?.email || "Employee",
      date: result.shift.shift_date, start_time: result.shift.start_time.slice(0, 5),
      end_time: result.shift.end_time.slice(0, 5), status: result.shift.status,
      location: result.shift.location, role_label: result.shift.role_label,
      break_minutes: result.shift.break_minutes, timezone: result.shift.timezone,
      published_at: null };
  });

  ipcMain.handle("hr:shift:list", async (_e, month?: string, status?: "all" | "draft" | "published" | "cancelled") => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) return [];
    const action = session.membership_role === "owner" || session.role === "admin" ? "list_shifts" : "my_shifts";
    const result = await pharmacyTeamAction<{ shifts: {
      id: string; employee_user_id: string; shift_date: string; start_time: string; end_time: string;
      notes: string | null; status: "draft" | "published" | "cancelled"; location: string | null;
      role_label: string | null; break_minutes: number; timezone: string; published_at: string | null;
      profiles?: { display_name: string | null; email: string | null } | null;
    }[] }>(session.access_token, { action, pharmacy_id: pharmacyId, month, status });
    return result.shifts.map((s) => ({ id: s.id, employee_user_id: s.employee_user_id,
      staff_name: s.profiles?.display_name || s.profiles?.email || "Employee", date: s.shift_date,
      start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), status: s.status,
      location: s.location, role_label: s.role_label, break_minutes: s.break_minutes,
      timezone: s.timezone, published_at: s.published_at }));
  });

  ipcMain.handle("hr:shift:delete", async (_e, shiftId: string) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    return pharmacyTeamAction<{ deleted: boolean }>(session.access_token, {
      action: "delete_shift", pharmacy_id: pharmacyId, shift_id: shiftId,
    });
  });

  ipcMain.handle("hr:schedule:state", async (_e, startDate: string, endDate: string, state: "published" | "draft") => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    return pharmacyTeamAction<{ updated: number; state: string }>(session.access_token, {
      action: "set_schedule_state", pharmacy_id: pharmacyId, start_date: startDate, end_date: endDate, state,
    });
  });

  ipcMain.handle("team:list", async () => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ members: {
      user_id: string; membership_role: "owner" | "staff"; created_at: string;
      profiles?: { display_name: string | null; email: string | null } | null;
      employee_code: string; display_name: string | null; job_title: string; display_color: string;
      avatar_data_url: string | null; weekly_target_hours: number; working_days: number[];
      shift_start: string; shift_end: string; employment_status: PharmacyEmployee["employment_status"];
      department: string | null; location: string | null; manager_user_id: string | null;
      contract_type: string | null; start_date: string | null; end_date: string | null;
    }[] }>(session.access_token, { action: "list_team", pharmacy_id: pharmacyId });
    return result.members.map((m, index) => ({ user_id: m.user_id, membership_role: m.membership_role,
      email: m.profiles?.email ?? null, display_name: m.display_name || m.profiles?.display_name || null,
      employee_code: m.employee_code || `SHF-${m.user_id.replace(/-/g, "").slice(-8).toUpperCase()}`,
      job_title: m.job_title || (m.membership_role === "owner" ? "Pharmacy administrator" : "Pharmacy staff"),
      display_color: m.display_color || STAFF_CARD_COLORS[index % STAFF_CARD_COLORS.length],
      avatar_data_url: m.avatar_data_url ?? null, weekly_target_hours: Number(m.weekly_target_hours ?? 40),
      working_days: Array.isArray(m.working_days) && m.working_days.length ? m.working_days : [1, 2, 3, 4, 5],
      shift_start: (m.shift_start || "09:00").slice(0, 5), shift_end: (m.shift_end || "17:00").slice(0, 5),
      employment_status: m.employment_status || "active", department: m.department ?? null,
      location: m.location ?? null, manager_user_id: m.manager_user_id ?? null,
      contract_type: m.contract_type ?? null, start_date: m.start_date ?? null, end_date: m.end_date ?? null }));
  });
  ipcMain.handle("team:invite", async (_e, email: string) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    return pharmacyTeamAction(session.access_token, { action: "invite", pharmacy_id: pharmacyId, email });
  });
  ipcMain.handle("team:remove", async (_e, userId: string) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    return pharmacyTeamAction(session.access_token, { action: "remove", pharmacy_id: pharmacyId, user_id: userId });
  });

  ipcMain.handle("team:settings:save", async (_e, input) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const { user_id, ...staff_settings } = input;
    return pharmacyTeamAction(session.access_token, {
      action: "save_staff_settings", pharmacy_id: pharmacyId, user_id, staff_settings,
    });
  });

  ipcMain.handle("team:leave:list", async () => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) return [];
    const action = session.membership_role === "owner" ? "list_leaves" : "my_leaves";
    const result = await pharmacyTeamAction<{ leaves: {
      id: string; employee_user_id: string; leave_type: "sick" | "annual" | "personal" | "unpaid" | "family";
      start_date: string; end_date: string; reason: string | null;
      status: "pending" | "needs_information" | "approved" | "rejected" | "cancelled" | "withdrawn";
      review_reason: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
      profiles?: { display_name: string | null; email: string | null } | null;
    }[] }>(session.access_token, { action, pharmacy_id: pharmacyId });
    return result.leaves.map((leave) => ({ ...leave,
      staff_name: leave.profiles?.display_name || leave.profiles?.email || "Employee" }));
  });

  ipcMain.handle("team:leave:request", async (_e, input) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    return pharmacyTeamAction(session.access_token, {
      action: "create_leave", pharmacy_id: pharmacyId, leave: input,
    });
  });

  ipcMain.handle("team:leave:review", async (_e, leaveId: string, status: "approved" | "rejected" | "needs_information", reason?: string) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    return pharmacyTeamAction(session.access_token, {
      action: "review_leave", pharmacy_id: pharmacyId, leave_id: leaveId, status, reason,
    });
  });

  ipcMain.handle("team:leave:respond", async (_e, leaveId: string, response: string) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    await pharmacyTeamAction(session.access_token, { action: "respond_leave", pharmacy_id: pharmacyId, leave_id: leaveId, response });
  });

  ipcMain.handle("team:leave:withdraw", async (_e, leaveId: string) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    await pharmacyTeamAction(session.access_token, { action: "withdraw_leave", pharmacy_id: pharmacyId, leave_id: leaveId });
  });

  ipcMain.handle("team:shift-swap:targets", async () => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ employees: StaffEmployeeOption[] }>(session.access_token, {
      action: "list_swap_targets", pharmacy_id: pharmacyId,
    });
    return result.employees;
  });

  ipcMain.handle("team:shift-swap:list", async () => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ requests: StaffShiftSwapRequest[] }>(session.access_token, {
      action: "list_swap_requests", pharmacy_id: pharmacyId,
    });
    return result.requests;
  });

  ipcMain.handle("team:shift-swap:request", async (_e, request) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const result = await pharmacyTeamAction<{ request: { id: string } }>(session.access_token, {
      action: "create_swap_request", pharmacy_id: pharmacyId, request,
    });
    return result.request;
  });

  ipcMain.handle("team:shift-swap:review", async (_e, requestId: string, status: "approved" | "rejected", reason?: string) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    await pharmacyTeamAction(session.access_token, {
      action: "review_swap_request", pharmacy_id: pharmacyId, request_id: requestId, status, reason,
    });
  });

  ipcMain.handle("team:notifications:list", async () => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ notifications: StaffNotification[] }>(session.access_token, {
      action: "list_notifications", pharmacy_id: pharmacyId,
    });
    return result.notifications;
  });

  ipcMain.handle("team:notifications:read", async (_e, notificationId: string) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    await pharmacyTeamAction(session.access_token, { action: "mark_notification_read", pharmacy_id: pharmacyId, notification_id: notificationId });
  });

  ipcMain.handle("team:audit:list", async () => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ events: (HrAuditEvent & {
      profiles?: { display_name: string | null; email: string | null } | null;
    })[] }>(session.access_token, { action: "list_audit", pharmacy_id: pharmacyId });
    return result.events.map((event) => ({ ...event, actor_name: event.profiles?.display_name || event.profiles?.email || "System" }));
  });

  ipcMain.handle("team:workforce:get", async () => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const result = await pharmacyTeamAction<{ settings: WorkforceSettings }>(session.access_token, {
      action: "get_workforce_settings", pharmacy_id: pharmacyId,
    });
    return result.settings;
  });

  ipcMain.handle("team:workforce:save", async (_e, settings: WorkforceSettings) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const result = await pharmacyTeamAction<{ settings: WorkforceSettings }>(session.access_token, {
      action: "save_workforce_settings", pharmacy_id: pharmacyId, settings,
    });
    return result.settings;
  });

  ipcMain.handle("team:compensation:list", async (_e, employeeUserId: string) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ compensation: EmployeeCompensation[] }>(session.access_token, {
      action: "list_compensation", pharmacy_id: pharmacyId, employee_user_id: employeeUserId,
    });
    return result.compensation;
  });

  ipcMain.handle("team:compensation:add", async (_e, compensation: Omit<EmployeeCompensation, "id" | "created_at">) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const result = await pharmacyTeamAction<{ compensation: EmployeeCompensation }>(session.access_token, {
      action: "save_compensation", pharmacy_id: pharmacyId, compensation,
    });
    return result.compensation;
  });

  ipcMain.handle("team:attendance:list", async (_e, month?: string) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ events: (AttendanceEvent & {
      profiles?: { display_name: string | null; email: string | null } | null;
    })[] }>(session.access_token, { action: "list_attendance", pharmacy_id: pharmacyId, month });
    return result.events.map((event) => ({ ...event, staff_name: event.profiles?.display_name || event.profiles?.email || "Employee" }));
  });

  ipcMain.handle("team:attendance:clock", async (_e, eventType: AttendanceEvent["event_type"]) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const result = await pharmacyTeamAction<{ event: AttendanceEvent }>(session.access_token, {
      action: "clock_event", pharmacy_id: pharmacyId, event_type: eventType,
    });
    return result.event;
  });

  ipcMain.handle("team:attendance:correction:request", async (_e, correction) => {
    requirePharmacyOperator();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    const result = await pharmacyTeamAction<{ correction: TimeCorrectionRequest }>(session.access_token, {
      action: "request_time_correction", pharmacy_id: pharmacyId, correction,
    });
    return result.correction;
  });

  ipcMain.handle("team:attendance:corrections", async () => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) return [];
    const result = await pharmacyTeamAction<{ corrections: (TimeCorrectionRequest & {
      profiles?: { display_name: string | null; email: string | null } | null;
    })[] }>(session.access_token, { action: "list_time_corrections", pharmacy_id: pharmacyId });
    return result.corrections.map((row) => ({ ...row, staff_name: row.profiles?.display_name || row.profiles?.email || "Employee" }));
  });

  ipcMain.handle("team:attendance:correction:review", async (_e, correctionId: string, status: "approved" | "rejected", reason?: string) => {
    requirePharmacyOwner();
    if (!session || !pharmacyId) throw new Error("Sign in to a pharmacy first.");
    await pharmacyTeamAction(session.access_token, {
      action: "review_time_correction", pharmacy_id: pharmacyId, correction_id: correctionId, status, reason,
    });
  });

  ipcMain.handle("hr:vacation:add", async (_e, input) => {
    const d = await db();
    const v = addVacation(d.db, input);
    persist(d);
    return v;
  });

  ipcMain.handle("hr:vacation:list", async () => {
    const d = await db();
    return listVacations(d.db);
  });

  ipcMain.handle("hr:swap:add", async (_e, input) => {
    const d = await db();
    const s = addShiftSwap(d.db, input);
    persist(d);
    return s;
  });

  ipcMain.handle("hr:swap:list", async () => {
    const d = await db();
    return listShiftSwaps(d.db);
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    title: "Shifa Pro",
    backgroundColor: "#002a68",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
  }
}

void app.whenReady().then(() => {
  loadSupabaseConfig(path.join(app.getPath("userData"), "backend.json"));
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
