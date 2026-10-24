import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Customer, CustomerCreditInvoice, ExpensePaymentMethod, ExpenseRow, FinancialJournalRow, FinancialReport, InventorySuggestion, PayablesSummary, SupplierPayment } from "../../shared/types";

type Period = "today" | "month" | "custom";
type Notice = (value: string) => void;
type PriceScope = "all" | "otc" | "prescription" | "unknown";
type PriceRow = { product_id: string; name: string; old_price: number; new_price: number; change_percent: number };

function localDateInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function firstMonthDay(value: string) { return `${value.slice(0, 7)}-01`; }
function lastMonthDay(value: string) {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
}
function money(amount: number | null, currency = "SDG"): string {
  return amount === null ? "Incomplete" : `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
function readable(value: string): string { return value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function dueStatus(date: string | null | undefined): string {
  if (!date) return "No due date";
  const today = localDateInput();
  const nextWeek = new Date(`${today}T00:00:00`); nextWeek.setDate(nextWeek.getDate() + 7);
  const cutoff = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(nextWeek.getDate()).padStart(2, "0")}`;
  return date < today ? "Overdue" : date <= cutoff ? "Due soon" : "Upcoming";
}
function creditAge(date: string | null): string {
  if (!date || date >= localDateInput()) return "Not due";
  const days = Math.floor((new Date(`${localDateInput()}T00:00:00`).getTime() - new Date(`${date}T00:00:00`).getTime()) / 86400000);
  return days <= 7 ? "1–7 days overdue" : days <= 30 ? "8–30 days overdue" : ">30 days overdue";
}

export function Finance({ onNotice }: { onNotice: Notice }) {
  const today = localDateInput();
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(today);
  const [customStart, setCustomStart] = useState(firstMonthDay(today));
  const [customEnd, setCustomEnd] = useState(today);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [journal, setJournal] = useState<FinancialJournalRow[]>([]);
  const [payables, setPayables] = useState<PayablesSummary>({ rows: [], total_owed: 0 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditInvoices, setCreditInvoices] = useState<CustomerCreditInvoice[]>([]);
  const [stockAlerts, setStockAlerts] = useState<InventorySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [supplier, setSupplier] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<ExpensePaymentMethod>("cash");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today);
  const [supplierDrafts, setSupplierDrafts] = useState<Record<string, { amount: string; method: "cash" | "bank" }>>({});
  const [supplierPayments, setSupplierPayments] = useState<Record<string, SupplierPayment[]>>({});
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [customerDrafts, setCustomerDrafts] = useState<Record<string, { amount: string; method: "cash" | "bank" }>>({});
  const [priceScope, setPriceScope] = useState<PriceScope>("all");
  const [pricePercent, setPricePercent] = useState("5");
  const [priceReason, setPriceReason] = useState("");
  const [pricePreview, setPricePreview] = useState<PriceRow[]>([]);
  const [lastAdjustment, setLastAdjustment] = useState<{ id: string; count: number } | null>(null);

  const [start, end] = useMemo((): [string, string] => {
    if (period === "today") return [date, date];
    if (period === "month") return [firstMonthDay(date), lastMonthDay(date)];
    return [customStart, customEnd];
  }, [customEnd, customStart, date, period]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextReport, nextExpenses, nextJournal, nextPayables, nextCustomers, nextInvoices, nextAlerts, latestAdjustment] = await Promise.all([
        window.api.sales.report(start, end), window.api.finance.expenses(start, end),
        window.api.finance.journal(start, end), window.api.purchases.payables(), window.api.customers.list(), window.api.customers.invoices(), window.api.insights.suggestions(), window.api.finance.latestPriceAdjustment(),
      ]);
      setReport(nextReport); setExpenses(nextExpenses); setJournal(nextJournal);
      setPayables(nextPayables); setCustomers(nextCustomers); setCreditInvoices(nextInvoices); setStockAlerts(nextAlerts);
      setLastAdjustment(latestAdjustment);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't load financial records."); }
    finally { setLoading(false); }
  }, [end, onNotice, start]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function saveExpense(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) { onNotice("Enter a description and an amount greater than zero."); return; }
    setSaving(true);
    try {
      await window.api.finance.addExpense({ business_date: expenseDate, category, description: description.trim(), supplier: supplier.trim() || null, amount_sdg: parsedAmount, payment_method: payment });
      setDescription(""); setSupplier(""); setAmount(""); setPayment("cash"); setExpenseOpen(false);
      await refresh(); onNotice("Expense recorded in the SDG financial ledger.");
    } catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't record the expense."); }
    finally { setSaving(false); }
  }

  async function paySupplier(id: string, remaining: number) {
    const draft = supplierDrafts[id] ?? { amount: String(remaining), method: "cash" as const };
    const parsed = Number(draft.amount);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > remaining) { onNotice("Enter a payment above zero and up to the remaining invoice balance."); return; }
    setSaving(true);
    try {
      await window.api.purchases.pay(id, parsed, draft.method); await refresh();
      onNotice(`Recorded ${money(parsed)} supplier payment from ${draft.method}.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't record the supplier payment."); }
    finally { setSaving(false); }
  }
  async function toggleSupplierHistory(id: string) {
    if (expandedSupplier === id) { setExpandedSupplier(null); return; }
    setExpandedSupplier(id);
    if (!supplierPayments[id]) {
      try { const history = await window.api.purchases.payments(id); setSupplierPayments(current => ({ ...current, [id]: history })); }
      catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't load supplier payment history."); }
    }
  }
  async function attachSupplierInvoice(id: string) {
    setSaving(true);
    try {
      const saved = await window.api.purchases.attach(id);
      if (saved) { await refresh(); onNotice("Supplier invoice attachment saved locally."); }
    } catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't attach the invoice."); }
    finally { setSaving(false); }
  }
  async function openSupplierInvoice(id: string) {
    try { await window.api.purchases.openAttachment(id); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't open the invoice."); }
  }

  async function payCustomer(invoice: CustomerCreditInvoice) {
    const draft = customerDrafts[invoice.sale_id] ?? { amount: String(invoice.balance_sdg), method: "cash" as const };
    const parsed = Number(draft.amount);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > invoice.balance_sdg) { onNotice("Enter a payment above zero and up to this invoice's balance."); return; }
    setSaving(true);
    try {
      await window.api.customers.settle(invoice.customer_id, parsed, draft.method, invoice.sale_id); await refresh();
      onNotice(`Recorded ${money(parsed)} for ${invoice.sale_no} from ${invoice.customer_name}.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't record the customer payment."); }
    finally { setSaving(false); }
  }

  async function previewPrices() {
    const percent = Number(pricePercent);
    setSaving(true);
    try { setPricePreview(await window.api.finance.pricePreview(priceScope, percent)); }
    catch (error) { setPricePreview([]); onNotice(error instanceof Error ? error.message : "Couldn't preview price changes."); }
    finally { setSaving(false); }
  }

  async function applyPrices() {
    if (!pricePreview.length || !priceReason.trim()) { onNotice("Preview the changes and enter a reason before applying."); return; }
    if (!window.confirm(`Apply this ${pricePercent}% price adjustment to ${pricePreview.length} products?`)) return;
    setSaving(true);
    try {
      const result = await window.api.finance.applyPriceAdjustment(priceScope, Number(pricePercent), priceReason);
      setLastAdjustment(result); setPricePreview([]); setPriceReason("");
      onNotice(`Updated ${result.count} product prices. The change is in the audit history.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't apply price changes."); }
    finally { setSaving(false); }
  }

  async function rollbackPrices() {
    if (!lastAdjustment || !window.confirm("Restore the prices from immediately before this adjustment?")) return;
    setSaving(true);
    try {
      const count = await window.api.finance.rollbackPriceAdjustment(lastAdjustment.id);
      setLastAdjustment(null); onNotice(`Restored ${count} product prices. The rollback is audited.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't roll back this price adjustment."); }
    finally { setSaving(false); }
  }

  async function closePeriod() {
    if (!report) return;
    setSaving(true);
    try { await window.api.finance.closePeriod(start, end); await refresh(); onNotice("Financial period closed and its report snapshot recorded."); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't close this financial period."); }
    finally { setSaving(false); }
  }
  async function reopenPeriod() {
    const reason = window.prompt("Why must this financial period be reopened? (8–300 characters)");
    if (!reason) return;
    setSaving(true);
    try { await window.api.finance.reopenPeriod(start, end, reason); await refresh(); onNotice("Financial period reopened. The reason is in the audit history."); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't reopen this financial period."); }
    finally { setSaving(false); }
  }

  const debtors = customers.filter(customer => customer.balance > 0).sort((a, b) => b.balance - a.balance);
  const trend = useMemo(() => {
    const values = new Map<string, { sales: number; expenses: number }>();
    for (const row of journal) {
      const value = values.get(row.business_date) ?? { sales: 0, expenses: 0 };
      if (row.entry_type === "sale") value.sales += row.amount_sdg;
      if (row.entry_type === "expense") value.expenses += row.amount_sdg;
      values.set(row.business_date, value);
    }
    return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [journal]);
  const trendMax = Math.max(1, ...trend.flatMap(([, v]) => [v.sales, v.expenses]));
  const todayString = localDateInput();
  const dueSoonTotal = payables.rows.filter(row => row.due_date && dueStatus(row.due_date) === "Due soon").reduce((sum, row) => sum + row.remaining, 0);
  const overdueTotal = payables.rows.filter(row => row.due_date && dueStatus(row.due_date) === "Overdue").reduce((sum, row) => sum + row.remaining, 0);

  return <div className="layout single finance-screen">
    <section className="finance-hero">
      <div className="finance-hero-top">
        <div><span className="finance-eyebrow">SHIFA PRO <i /> FINANCIAL CONTROL</span><h2>Pharmacy finances</h2><p>Cash movement, obligations, and operating performance — in SDG.</p></div>
        <div className="finance-hero-actions"><span className="finance-live"><i /> LOCAL LEDGER</span><button className="secondary" onClick={() => void refresh()} disabled={loading || saving}>{loading ? "Updating…" : "Refresh"}</button></div>
      </div>
      <div className="finance-toolbar">
        <div className="finance-period-tabs">
          <button className={period === "today" ? "active" : ""} onClick={() => { setPeriod("today"); setDate(todayString); }}>Today</button>
          <button className={period === "month" ? "active" : ""} onClick={() => { setPeriod("month"); setDate(todayString); }}>This month</button>
          <button className={period === "custom" ? "active" : ""} onClick={() => setPeriod("custom")}>Custom</button>
        </div>
        {period === "today" && <label className="finance-date">Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>}
        {period === "month" && <label className="finance-date">Month<input type="month" value={date.slice(0, 7)} onChange={e => setDate(`${e.target.value}-01`)} /></label>}
        {period === "custom" && <div className="finance-custom-dates"><label className="finance-date">From<input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} /></label><label className="finance-date">To<input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></label></div>}
        <span className="finance-period">{start} — {end}</span>
        <button className="secondary" onClick={async () => {
          setSaving(true); try { const file = await window.api.sales.exportPdf(start, end); onNotice(`SDG financial report exported: ${file}`); }
          catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't export the report."); } finally { setSaving(false); }
        }} disabled={saving}>Export SDG report</button>
      </div>
    </section>

    {report && <>
      <section className="finance-kpis">
        <article className="finance-kpi finance-kpi-primary"><span>Sales collected</span><strong>{money(report.sales_collected_sdg)}</strong><small>Cash and bank received at sale</small><b className="finance-kpi-icon">↗</b></article>
        <article className="finance-kpi"><span>Expenses paid</span><strong>{money(report.expenses_paid_sdg)}</strong><small>{report.expense_count} expense record(s)</small><b className="finance-kpi-icon">↘</b></article>
        <article className="finance-kpi"><span>Net cash movement</span><strong>{money(report.cashflow_sdg)}</strong><small>All cash and bank inflows less outflows</small><b className="finance-kpi-icon">⇄</b></article>
        <article className="finance-kpi"><span>Supplier credit due</span><strong>{money(payables.total_owed)}</strong><small>{payables.rows.length} outstanding invoice(s)</small><b className="finance-kpi-icon">▤</b></article>
      </section>

      <div className="finance-dashboard-grid">
        <section className="panel finance-panel finance-trend-panel">
          <div className="finance-section-heading"><div><span className="finance-eyebrow">PERFORMANCE</span><h3>Sales & expenses</h3><p>Recorded revenue and operating expenses by business date.</p></div><span className="finance-period">{report.period}</span></div>
          <div className="finance-chart-legend"><span><i className="legend-sales" />Sales revenue</span><span><i className="legend-expenses" />Expenses</span></div>
          {trend.length ? <div className="finance-bar-chart">{trend.map(([day, value]) => <div className="finance-chart-day" key={day} title={`${day}: sales ${money(value.sales)} · expenses ${money(value.expenses)}`}><div className="finance-bars"><i className="sales-bar" style={{ height: `${Math.max(3, value.sales / trendMax * 100)}%` }} /><i className="expense-bar" style={{ height: `${Math.max(3, value.expenses / trendMax * 100)}%` }} /></div><span>{day.slice(5)}</span></div>)}</div> : <div className="empty finance-empty">No sales or expenses in this reporting period.</div>}
          <div className="finance-trend-foot"><span>Total sales <strong>{money(report.revenue_sdg)}</strong></span><span>COGS <strong>{money(report.cogs_sdg)}</strong></span><span>Gross profit <strong>{money(report.gross_profit_sdg)}</strong></span></div>
        </section>
        <section className="panel finance-panel finance-attention-panel">
          <div className="finance-section-heading"><div><span className="finance-eyebrow">PRIORITY QUEUE</span><h3>Needs attention</h3><p>Balances and obligations that may need follow-up.</p></div></div>
          <div className="finance-attention-item"><b className="attention-mark attention-red">!</b><span><strong>Overdue supplier credit</strong><small>{overdueTotal > 0 ? money(overdueTotal) : "No overdue invoices"}</small></span><em>{payables.rows.filter(r => r.due_date && dueStatus(r.due_date) === "Overdue").length}</em></div>
          <div className="finance-attention-item"><b className="attention-mark attention-amber">◷</b><span><strong>Supplier credit due soon</strong><small>{dueSoonTotal > 0 ? money(dueSoonTotal) : "No invoices due in 7 days"}</small></span><em>{payables.rows.filter(r => r.due_date && dueStatus(r.due_date) === "Due soon").length}</em></div>
          <div className="finance-attention-item"><b className="attention-mark attention-green">↗</b><span><strong>Customer balances</strong><small>{debtors.length ? `${debtors.length} customer account(s)` : "No open customer balances"}</small></span><em>{money(debtors.reduce((sum, c) => sum + c.balance, 0))}</em></div>
          <div className="finance-attention-item"><b className="attention-mark attention-blue">⌑</b><span><strong>COGS review</strong><small>{report.incomplete_cost_sales ? `${report.incomplete_cost_sales} sale(s) need cost history` : "Cost history complete"}</small></span><em>{report.incomplete_cost_sales ? "Review" : "OK"}</em></div>
          {stockAlerts.filter(alert => alert.kind === "expired" || alert.kind === "near_expiry" || alert.kind === "low_stock").slice(0, 4).map(alert => <div className="finance-attention-item" key={`${alert.kind}-${alert.product_id}`}><b className={`attention-mark ${alert.severity === "high" ? "attention-red" : "attention-amber"}`}>{alert.kind === "low_stock" ? "↓" : "◷"}</b><span><strong>{alert.product_name} · {readable(alert.kind)}</strong><small>{alert.message}</small></span><em>{readable(alert.severity)}</em></div>)}
        </section>
      </div>

      <section className="finance-balance-strip">
        <div><span>Cash on hand</span><strong>{money(report.cash_balance_sdg)}</strong></div><div><span>Bank balance</span><strong>{money(report.bank_balance_sdg)}</strong></div><div><span>Customers owe us</span><strong>{money(report.receivables_sdg)}</strong></div><div><span>Inventory at cost</span><strong>{money(report.inventory_value_sdg)}</strong></div>
      </section>

      <section className="panel finance-panel">
        <div className="finance-section-heading"><div><span className="finance-eyebrow">OUTGOING OBLIGATIONS</span><h3>We owe suppliers</h3><p>Part payments reduce the balance and are recorded separately from stock receipts.</p></div><strong className="finance-section-total">{money(payables.total_owed)}</strong></div>
        {payables.rows.length ? <div className="finance-table-wrap"><table className="cart-table finance-data-table"><thead><tr><th>Supplier / invoice</th><th>Received</th><th>Due date</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Record payment</th></tr></thead><tbody>{payables.rows.map(row => {
          const draft = supplierDrafts[row.id] ?? { amount: String(row.remaining), method: "cash" as const };
          const status = dueStatus(row.due_date);
          return <Fragment key={row.id}><tr><td><strong>{row.supplier || "Supplier not set"}</strong><small className="finance-cell-note">{row.invoice_no || row.product_name}</small><div className="finance-row-actions"><button className="link finance-history-link" onClick={() => void toggleSupplierHistory(row.id)}>{expandedSupplier === row.id ? "Hide payments" : "Payment history"}</button>{row.attachment_path ? <button className="link finance-history-link" onClick={() => void openSupplierInvoice(row.id)}>Open invoice</button> : <button className="link finance-history-link" disabled={saving} onClick={() => void attachSupplierInvoice(row.id)}>Attach invoice</button>}</div></td><td>{row.created_at.slice(0, 10)}</td><td><span className={`finance-status ${status === "Overdue" ? "is-overdue" : status === "Due soon" ? "is-soon" : ""}`}>{row.due_date || "—"}</span></td><td>{money(row.total_cost)}</td><td>{money(row.amount_paid)}</td><td><strong>{money(row.remaining)}</strong></td><td><div className="finance-payment-controls"><input aria-label="Supplier payment amount in SDG" type="number" min="0.01" max={row.remaining} step="0.01" value={draft.amount} onChange={e => setSupplierDrafts(current => ({ ...current, [row.id]: { ...draft, amount: e.target.value } }))} /><select aria-label="Supplier payment source" value={draft.method} onChange={e => setSupplierDrafts(current => ({ ...current, [row.id]: { ...draft, method: e.target.value as "cash" | "bank" } }))}><option value="cash">Cash</option><option value="bank">Bank</option></select><button className="primary mini-button" disabled={saving} onClick={() => void paySupplier(row.id, row.remaining)}>Pay</button></div></td></tr>{expandedSupplier === row.id && <tr className="finance-history-row"><td colSpan={7}>{supplierPayments[row.id]?.length ? supplierPayments[row.id].map(item => <span key={item.id}>{item.business_date} · {money(item.amount_sdg)} · {readable(item.payment_method)}</span>) : <span>No payment history is recorded for this invoice.</span>}</td></tr>}</Fragment>;
        })}</tbody></table></div> : <div className="empty finance-empty">No supplier balances are outstanding.</div>}
      </section>

      <section className="panel finance-panel">
        <div className="finance-section-heading"><div><span className="finance-eyebrow">INCOMING BALANCES</span><h3>Customers owe us</h3><p>Record full or partial collections. Walk-in customers need no account.</p></div><strong className="finance-section-total">{money(debtors.reduce((sum, customer) => sum + customer.balance, 0))}</strong></div>
        {creditInvoices.length ? <div className="finance-table-wrap"><table className="cart-table finance-data-table"><thead><tr><th>Customer / sale</th><th>Phone</th><th>Sale date</th><th>Due date / age</th><th>Balance</th><th>Collect payment</th></tr></thead><tbody>{creditInvoices.map(invoice => {
          const draft = customerDrafts[invoice.sale_id] ?? { amount: String(invoice.balance_sdg), method: "cash" as const };
          const age = creditAge(invoice.due_date);
          return <Fragment key={invoice.sale_id}><tr><td><strong>{invoice.customer_name}</strong><small className="finance-cell-note">{invoice.sale_no} · total {money(invoice.total_sdg)} · paid {money(invoice.paid_sdg)}</small><button className="link finance-history-link" onClick={() => setExpandedCustomer(current => current === invoice.sale_id ? null : invoice.sale_id)}>{expandedCustomer === invoice.sale_id ? "Hide payments" : `Payment history (${invoice.payment_history.length})`}</button></td><td>{invoice.phone || "—"}</td><td>{invoice.created_at.slice(0, 10)}</td><td><span className={`finance-status ${age.includes("overdue") ? "is-overdue" : ""}`}>{invoice.due_date || "—"} · {age}</span></td><td><strong>{money(invoice.balance_sdg)}</strong></td><td><div className="finance-payment-controls"><input aria-label="Customer payment amount in SDG" type="number" min="0.01" max={invoice.balance_sdg} step="0.01" value={draft.amount} onChange={e => setCustomerDrafts(current => ({ ...current, [invoice.sale_id]: { ...draft, amount: e.target.value } }))} /><select aria-label="Customer payment method" value={draft.method} onChange={e => setCustomerDrafts(current => ({ ...current, [invoice.sale_id]: { ...draft, method: e.target.value as "cash" | "bank" } }))}><option value="cash">Cash</option><option value="bank">Bank</option></select><button className="primary mini-button" disabled={saving} onClick={() => void payCustomer(invoice)}>Collect</button></div></td></tr>{expandedCustomer === invoice.sale_id && <tr className="finance-history-row"><td colSpan={6}>{invoice.payment_history.length ? invoice.payment_history.map((item,index) => <span key={`${invoice.sale_id}-${index}`}>{item.business_date} · {money(item.amount_sdg)} · {readable(item.method)}</span>) : <span>No customer payments have been applied to this invoice.</span>}</td></tr>}</Fragment>;
        })}</tbody></table></div> : <div className="empty finance-empty">No customer credit invoices are outstanding.</div>}
      </section>

      <section className="panel finance-panel">
        <div className="finance-section-heading"><div><span className="finance-eyebrow">PRICE MANAGEMENT</span><h3>Price adjustment center</h3><p>Preview the full list, confirm the change, then roll back the latest adjustment if needed.</p></div>{lastAdjustment && <button className="secondary" disabled={saving} onClick={() => void rollbackPrices()}>Roll back latest ({lastAdjustment.count})</button>}</div>
        <div className="finance-price-controls"><label>Product group<select value={priceScope} onChange={e => { setPriceScope(e.target.value as PriceScope); setPricePreview([]); }}><option value="all">All products</option><option value="otc">OTC</option><option value="prescription">Prescription</option><option value="unknown">Unclassified</option></select></label><label>Change (%)<input type="number" min="-90" max="500" step="0.01" value={pricePercent} onChange={e => { setPricePercent(e.target.value); setPricePreview([]); }} /></label><label>Reason<input maxLength={240} value={priceReason} onChange={e => setPriceReason(e.target.value)} placeholder="e.g. supplier cost update" /></label><button className="secondary" disabled={saving} onClick={() => void previewPrices()}>Preview changes</button></div>
        {pricePreview.length > 0 && <><div className="finance-preview-summary"><strong>{pricePreview.length} products</strong><span>{Number(pricePercent) >= 0 ? "+" : ""}{pricePercent}% · Prices are rounded to 0.01 SDG</span><button className="primary" disabled={saving || !priceReason.trim()} onClick={() => void applyPrices()}>Confirm & apply</button></div><div className="finance-table-wrap finance-preview-table"><table className="cart-table finance-data-table"><thead><tr><th>Product</th><th>Current price</th><th>New price</th><th>Change</th></tr></thead><tbody>{pricePreview.slice(0, 50).map(row => <tr key={row.product_id}><td>{row.name}</td><td>{money(row.old_price)}</td><td><strong>{money(row.new_price)}</strong></td><td className={row.change_percent >= 0 ? "finance-up" : "finance-down"}>{row.change_percent >= 0 ? "+" : ""}{row.change_percent}%</td></tr>)}</tbody></table>{pricePreview.length > 50 && <p className="hint">Showing 50 of {pricePreview.length} affected products; the confirmation applies to all.</p>}</div></>}
      </section>

      <section className="panel finance-panel">
        <div className="finance-section-heading"><div><span className="finance-eyebrow">CASH OPERATIONS</span><h3>Expenses</h3><p>Paid expenses count in cash movement; unpaid expenses remain obligations.</p></div><button className="primary" onClick={() => setExpenseOpen(value => !value)}>{expenseOpen ? "Cancel" : "Record expense"}</button></div>
        {expenseOpen && <form className="finance-expense-form" onSubmit={saveExpense}>
          <label>Date<input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required /></label>
          <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="rent">Rent</option><option value="payroll">Payroll</option><option value="utilities">Utilities</option><option value="transport">Transport</option><option value="maintenance">Maintenance</option><option value="bank_charges">Bank charges</option><option value="marketing">Marketing</option><option value="other">Other</option></select></label>
          <label>Description<input value={description} maxLength={240} onChange={e => setDescription(e.target.value)} required /></label>
          <label>Amount (SDG)<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
          <label>Supplier / payee<input value={supplier} onChange={e => setSupplier(e.target.value)} /></label>
          <label>Payment<select value={payment} onChange={e => setPayment(e.target.value as ExpensePaymentMethod)}><option value="cash">Paid from cash</option><option value="bank">Paid from bank</option><option value="unpaid">Unpaid / payable</option></select></label>
          <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save expense"}</button>
        </form>}
        {expenses.length ? <div className="finance-table-wrap"><table className="cart-table finance-data-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payee</th><th>Status</th><th>Amount (SDG)</th></tr></thead><tbody>{expenses.map(row => <tr key={row.id}><td>{row.business_date}</td><td>{readable(row.category)}</td><td>{row.description}</td><td>{row.supplier || "—"}</td><td><span className="finance-status">{readable(row.payment_method)}</span></td><td>{money(row.amount_sdg)}</td></tr>)}</tbody></table></div> : <div className="empty finance-empty">No expenses recorded in this period.</div>}
      </section>

      <section className="panel finance-panel">
        <div className="finance-section-heading"><div><span className="finance-eyebrow">AUDIT TRAIL</span><h3>Recent transactions</h3><p>{report.financial_event_count} journal events · SDG entries are immutable; corrections use payment/reversal records.</p></div>
          {report.close && !report.close.reopened_at ? <button className="secondary" onClick={() => void reopenPeriod()} disabled={saving}>Reopen period</button> : <button className="secondary" onClick={() => void closePeriod()} disabled={saving || report.incomplete_cost_sales > 0}>Close period</button>}
        </div>
        {report.close && !report.close.reopened_at && <p className="finance-closed">Closed {new Date(report.close.closed_at).toLocaleString()} by {report.close.closed_by || "owner"}. New entries dated in this period are blocked.</p>}
        {report.incomplete_cost_sales > 0 && <p className="flag finance-flag">COGS needs review: {report.missing_cost_lines} sold unit(s) have no complete historical cost layer. Profit and period close are withheld.</p>}
        <p className="finance-policy">New COGS uses FIFO receipt cost layers; physical shelf picking still follows FEFO. Earlier sales retain their recorded batch costs. Costing method: {report.costing_method}.</p>
        {journal.length ? <div className="finance-table-wrap"><table className="cart-table finance-data-table"><thead><tr><th>Date</th><th>Entry</th><th>Description</th><th>Amount (SDG)</th><th>Completeness</th></tr></thead><tbody>{journal.map(row => <tr key={row.id}><td>{row.business_date}</td><td><span className="finance-status">{readable(row.entry_type)}</span></td><td>{row.description}</td><td>{money(row.amount_sdg)}</td><td>{row.is_complete ? "Complete" : "Needs review"}</td></tr>)}</tbody></table></div> : <div className="empty finance-empty">No journal entries in this period.</div>}
      </section>
    </>}
  </div>;
}
