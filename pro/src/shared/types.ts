// Shared types used across the main process, preload bridge, and renderer.
// Keep this file free of any Node or Electron imports so both sides can use it.

export type PrescriptionClassification = "otc" | "prescription" | "unknown";

export interface Product {
  id: string;
  canonical_name: string;
  brand_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  barcode: string | null;
  prescription_classification: PrescriptionClassification;
}

export interface Batch {
  id: string;
  product_id: string;
  lot_no: string;
  expiry_date: string | null;
  quantity: number;
  cost_price: number | null;
}

export interface CartLine {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface SaleLineResult {
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
}

export interface SaleShortage {
  product_name: string;
  short_by: number;
}

export interface SaleResult {
  sale_id: string;
  sale_no: string;
  total: number;
  lines: SaleLineResult[];
  created_at: string;
  flagged: boolean;
  shortages: SaleShortage[];
}

export interface AuthSession {
  access_token: string;
  user_id: string;
  email: string | null;
  role: string;
  membership_role?: "owner" | "staff" | null;
}

export interface PharmacyEmployee {
  user_id: string;
  membership_role: "owner" | "staff";
  email: string | null;
  display_name: string | null;
  employee_code: string;
  job_title: string;
  display_color: string;
  avatar_data_url: string | null;
  weekly_target_hours: number;
  working_days: number[];
  shift_start: string;
  shift_end: string;
  employment_status: "active" | "on_leave" | "suspended" | "deactivated";
  department: string | null;
  location: string | null;
  manager_user_id: string | null;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
}

export type LeaveType = "sick" | "annual" | "personal" | "unpaid" | "family";
export type LeaveStatus = "pending" | "needs_information" | "approved" | "rejected" | "cancelled" | "withdrawn";

export interface StaffLeaveRequest {
  id: string;
  employee_user_id: string;
  staff_name: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  review_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface SyncStatus {
  connected: boolean;
  last_pull_at: string | null;
  pending_ops: number;
  product_count: number;
}

export interface StockLevel {
  product_id: string;
  available: number;
}

export interface CatalogEntry {
  id: string;
  canonical_name: string;
  brand_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  barcode: string | null;
  image_url: string | null;
  prescription_classification: PrescriptionClassification;
  stock: number;
  price: number | null;
}

export interface ExpiryItem {
  batch_id: string;
  product_id: string;
  product_name: string;
  lot_no: string;
  quantity: number;
  expiry_date: string;
  days_left: number;
  status: "expired" | "critical" | "soon";
}

export interface InventorySuggestion {
  kind: "expired" | "near_expiry" | "low_stock" | "slow_mover" | "overstock";
  product_id: string;
  product_name: string;
  severity: "high" | "medium" | "info";
  message: string;
}

export type PaymentStatus = "paid" | "partial" | "unpaid";

export interface Purchase {
  id: string;
  product_id: string;
  supplier: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  payment_status: PaymentStatus;
  amount_paid: number;
  created_at: string;
}

export interface MostPurchasedRow {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_cost: number;
  purchase_count: number;
}

export interface PayableRow {
  id: string;
  product_name: string;
  supplier: string | null;
  total_cost: number;
  amount_paid: number;
  remaining: number;
  created_at: string;
  invoice_no?: string | null;
  due_date?: string | null;
  notes?: string | null;
  attachment_path?: string | null;
}

export interface PayablesSummary {
  rows: PayableRow[];
  total_owed: number;
}

export interface SupplierPayment {
  id: string;
  purchase_id: string;
  amount_sdg: number;
  payment_method: "cash" | "bank";
  business_date: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
  age: string | null;
  address: string | null;
  balance: number;
  top_products: { product_name: string; total_quantity: number }[];
  created_at: string;
}

export interface CustomerCreditInvoice {
  sale_id: string;
  sale_no: string;
  customer_id: string;
  customer_name: string;
  phone: string | null;
  total_sdg: number;
  paid_sdg: number;
  balance_sdg: number;
  due_date: string | null;
  created_at: string;
  payment_history: { amount_sdg: number; business_date: string; method: "cash" | "bank" }[];
}

export interface SaleHistoryItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface SaleHistoryRow {
  id: string;
  sale_no: string;
  total: number;
  flagged: boolean;
  customer_name: string | null;
  payment_method: string | null;
  created_at: string;
  business_date: string;
  cogs: number;
  missing_cost_lines: number;
  items: SaleHistoryItem[];
}

export interface FinancialReport {
  period: string;
  currency: "SDG";
  revenue_sdg: number;
  cogs_sdg: number;
  gross_profit_sdg: number | null;
  operating_expenses_sdg: number;
  inventory_writeoff_sdg: number;
  net_profit_sdg: number | null;
  cashflow_sdg: number;
  sales_collected_sdg: number;
  expenses_paid_sdg: number;
  cash_balance_sdg: number;
  bank_balance_sdg: number;
  receivables_sdg: number;
  payables_sdg: number;
  inventory_value_sdg: number;
  expense_count: number;
  financial_event_count: number;
  usd_revenue: number | null;
  usd_cogs: number | null;
  usd_gross_profit: number | null;
  usd_expenses: number | null;
  usd_net_profit: number | null;
  missing_rate_days: string[];
  missing_cost_lines: number;
  incomplete_cost_sales: number;
  costing_method: string;
  sale_count: number;
  daily_rates: { business_date: string; sdg_per_usd: number | null }[];
  close: FinancialPeriodClose | null;
}

export type ExpensePaymentMethod = "cash" | "bank" | "unpaid";

export interface ExpenseInput {
  business_date: string;
  category: string;
  description: string;
  supplier?: string | null;
  amount_sdg: number;
  payment_method: ExpensePaymentMethod;
}

export interface ExpenseRow {
  id: string;
  business_date: string;
  category: string;
  description: string;
  supplier: string | null;
  amount_sdg: number;
  payment_method: ExpensePaymentMethod;
  status: "posted" | "voided";
  created_at: string;
}

export interface FinancialJournalRow {
  id: string;
  business_date: string;
  entry_type: string;
  description: string;
  amount_sdg: number;
  currency: "SDG";
  is_complete: boolean;
  created_at: string;
}

export interface FinancialPeriodClose {
  id: string;
  period_start: string;
  period_end: string;
  closed_at: string;
  closed_by: string | null;
  snapshot_json: string;
  reopened_at: string | null;
  reopened_by?: string | null;
  reopen_reason: string | null;
}

export interface ReconciliationResult {
  compared: number;
  exceptions: InventoryException[];
}

export interface InventoryException {
  id: string;
  kind: string;
  product_id: string | null;
  expected_quantity: number | null;
  actual_quantity: number | null;
  details: string;
  detected_at: string;
}

export interface Shift {
  id: string;
  staff_name: string;
  employee_user_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "draft" | "published" | "cancelled";
  location: string | null;
  role_label: string | null;
  break_minutes: number;
  timezone: string;
  published_at: string | null;
}

export interface StaffNotification {
  id: string;
  event_type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
  delivery_status: "in_app" | "failed";
}

export interface HrAuditEvent {
  id: string;
  actor_user_id: string | null;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface WorkforceSettings {
  timezone: string;
  currency: string;
  week_starts_on: number;
  attendance_enabled: boolean;
  payroll_preparation_enabled: boolean;
}

export interface AttendanceEvent {
  id: string;
  employee_user_id: string;
  event_type: "clock_in" | "clock_out" | "break_start" | "break_end";
  occurred_at: string;
  source: string;
  created_at: string;
  staff_name?: string;
}

export interface TimeCorrectionRequest {
  id: string;
  employee_user_id: string;
  event_id: string | null;
  requested_event_type: "clock_in" | "clock_out" | "break_start" | "break_end";
  requested_at: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
  created_at: string;
  staff_name?: string;
}

export interface StaffEmployeeOption {
  user_id: string;
  display_name: string;
  employee_code: string;
  job_title: string;
}

export interface StaffShiftSwapRequest {
  id: string;
  shift_id: string;
  employee_user_id: string;
  target_user_id: string;
  employee_name: string;
  target_name: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
  shift: {
    shift_date: string;
    start_time: string;
    end_time: string;
    location: string | null;
    role_label: string | null;
  } | null;
}

export interface EmployeeCompensation {
  id: string;
  employee_user_id: string;
  effective_date: string;
  pay_basis: "day" | "week" | "month" | "hour" | "annual";
  amount: number;
  currency: string;
  pay_schedule: string | null;
  created_at: string;
}

export interface VacationRequest {
  id: string;
  staff_name: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface ShiftSwapRequest {
  id: string;
  staff_name: string;
  colleague_name: string;
  date: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
