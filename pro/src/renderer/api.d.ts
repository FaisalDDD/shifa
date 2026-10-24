import type {
  AuthSession,
  AuthSignInResult,
  AttendanceEvent,
  CartLine,
  CatalogEntry,
  Customer,
  CustomerCreditInvoice,
  ExpiryItem,
  FinancialReport,
  ExpenseInput,
  ExpenseRow,
  FinancialJournalRow,
  FinancialPeriodClose,
  EmployeeCompensation,
  HrAuditEvent,
  LeaveStatus,
  LeaveType,
  PharmacyEmployee,
  StaffLeaveRequest,
  StaffNotification,
  StaffEmployeeOption,
  StaffShiftSwapRequest,
  TimeCorrectionRequest,
  InventoryException,
  ReconciliationResult,
  InventorySuggestion,
  MostPurchasedRow,
  PayablesSummary,
  SaleHistoryRow,
  SaleResult,
  Shift,
  ShiftSwapRequest,
  StockLevel,
  SyncStatus,
  SupplierPayment,
  VacationRequest,
  WorkforceSettings,
} from "../shared/types";

export interface StockReceiveInput {
  id?: string;
  product_id: string;
  lot_no: string;
  expiry_date: string | null;
  mfg_date?: string | null;
  quantity: number;
  cost_price: number | null;
  sale_price?: number | null;
  supplier?: string | null;
  unit_cost?: number | null;
  payment_status?: string | null;
  amount_paid?: number | null;
  payment_method?: "cash" | "bank";
  invoice_no?: string | null;
  due_date?: string | null;
  notes?: string | null;
  notes?: string | null;
}

export interface ProductSubmissionInput {
  canonical_name: string;
  brand_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  barcode?: string | null;
  prescription_classification: string;
  image_url?: string | null;
  image_data_url?: string | null;
}

export interface CustomerAddInput {
  name: string;
  phone?: string | null;
  birth_date?: string | null;
  age?: string | null;
  address?: string | null;
}

export interface ShifaProApi {
  auth: {
    signIn(email: string, password: string): Promise<AuthSignInResult>;
    selectBranch(branchId: string): Promise<AuthSignInResult>;
    signOut(): Promise<void>;
  };
  settings: {
    changePassword(newPassword: string): Promise<void>;
    getBackend(): Promise<{ url: string; anonKey: string }>;
    setBackend(input: { url: string; anonKey: string }): Promise<{ url: string; anonKey: string }>;
  };
  sync: {
    pull(): Promise<{ count: number; financialCount?: number }>;
    push(): Promise<{ pushed: number; failed: number; reason?: string; reconciliation?: ReconciliationResult | null }>;
    reconcile(): Promise<ReconciliationResult>;
    status(): Promise<SyncStatus>;
  };
  catalog: {
    list(query?: string): Promise<CatalogEntry[]>;
  };
  stock: {
    receive(batch: StockReceiveInput): Promise<void>;
    remove(productId: string): Promise<number>;
    levels(): Promise<StockLevel[]>;
  };
  sale: {
    create(
      lines: CartLine[],
      opts?: { customer_id?: string | null; payment_method?: string | null; due_date?: string | null },
    ): Promise<SaleResult>;
  };
  customers: {
    add(input: CustomerAddInput): Promise<Customer>;
    list(): Promise<Customer[]>;
    invoices(): Promise<CustomerCreditInvoice[]>;
    settle(customerId: string, amount?: number, paymentMethod?: "cash" | "bank", invoiceId?: string | null): Promise<number>;
  };
  sales: {
    list(): Promise<SaleHistoryRow[]>;
    report(start: string, end: string): Promise<FinancialReport>;
    setRate(date: string, sdgPerUsd: number): Promise<void>;
    exportPdf(start: string, end: string): Promise<string>;
  };
  finance: {
    expenses(start: string, end: string): Promise<ExpenseRow[]>;
    addExpense(input: ExpenseInput): Promise<ExpenseRow>;
    journal(start: string, end: string): Promise<FinancialJournalRow[]>;
    closePeriod(start: string, end: string): Promise<FinancialPeriodClose>;
    reopenPeriod(start: string, end: string, reason: string): Promise<void>;
    pricePreview(scope: "all" | "otc" | "prescription" | "unknown", percent: number): Promise<{ product_id: string; name: string; old_price: number; new_price: number; change_percent: number }[]>;
    latestPriceAdjustment(): Promise<{ id: string; count: number } | null>;
    applyPriceAdjustment(scope: "all" | "otc" | "prescription" | "unknown", percent: number, reason: string): Promise<{ id: string; count: number }>;
    rollbackPriceAdjustment(id: string): Promise<number>;
  };
  inventory: {
    exceptions(): Promise<InventoryException[]>;
  };
  product: {
    submit(submission: ProductSubmissionInput): Promise<{ id: string }>;
    lookupImage(name: string): Promise<string | null>;
    setPrice(productId: string, price: number): Promise<void>;
    setThreshold(productId: string, threshold: number): Promise<number>;
  };
  insights: {
    expiring(): Promise<ExpiryItem[]>;
    suggestions(): Promise<InventorySuggestion[]>;
  };
  purchases: {
    mostPurchased(): Promise<MostPurchasedRow[]>;
    payables(): Promise<PayablesSummary>;
    markPaid(id: string, paymentMethod?: "cash" | "bank"): Promise<void>;
    pay(id: string, amount: number, paymentMethod?: "cash" | "bank"): Promise<number>;
    payments(id: string): Promise<SupplierPayment[]>;
    attach(id: string): Promise<string | null>;
    openAttachment(id: string): Promise<void>;
  };
  hr: {
    addShift(input: {
      id?: string;
      employee_user_id: string;
      date: string;
      start_time: string;
      end_time: string;
      location?: string | null;
      role_label?: string | null;
      break_minutes?: number;
      timezone?: string;
      notes?: string | null;
    }): Promise<Shift>;
    listShifts(month?: string, status?: "all" | "draft" | "published" | "cancelled"): Promise<Shift[]>;
    deleteShift(shiftId: string): Promise<{ deleted: boolean }>;
    setScheduleState(startDate: string, endDate: string, state: "published" | "draft"): Promise<{ updated: number; state: string }>;
    addVacation(input: {
      staff_name: string;
      start_date: string;
      end_date: string;
      reason?: string | null;
    }): Promise<VacationRequest>;
    listVacations(): Promise<VacationRequest[]>;
    addSwap(input: {
      staff_name: string;
      colleague_name: string;
      date: string;
      note?: string | null;
    }): Promise<ShiftSwapRequest>;
    listSwaps(): Promise<ShiftSwapRequest[]>;
  };
  team: {
    list(): Promise<PharmacyEmployee[]>;
    invite(email: string): Promise<{ invited: boolean; email: string }>;
    provisionAdmin(input: { email: string; password: string; display_name: string }): Promise<{ provisioned: boolean; user_id: string; email: string; display_name: string }>;
    remove(userId: string): Promise<{ removed: boolean; deactivated?: boolean }>;
    saveSettings(input: {
      user_id: string;
      display_name: string;
      job_title: string;
      display_color: string;
      avatar_data_url: string | null;
      weekly_target_hours: number;
      working_days: number[];
      shift_start: string;
      shift_end: string;
      employment_status: PharmacyEmployee["employment_status"];
      department?: string | null;
      location?: string | null;
      manager_user_id?: string | null;
      contract_type?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    }): Promise<PharmacyEmployee>;
    listLeaves(): Promise<StaffLeaveRequest[]>;
    requestLeave(input: {
      employee_user_id?: string;
      leave_type: LeaveType;
      start_date: string;
      end_date: string;
      reason?: string | null;
    }): Promise<StaffLeaveRequest>;
    reviewLeave(leaveId: string, status: "approved" | "rejected" | "needs_information", reason?: string): Promise<void>;
    respondLeave(leaveId: string, response: string): Promise<void>;
    withdrawLeave(leaveId: string): Promise<void>;
    notifications(): Promise<StaffNotification[]>;
    markNotificationRead(notificationId: string): Promise<void>;
    auditEvents(): Promise<HrAuditEvent[]>;
    workforceSettings(): Promise<WorkforceSettings>;
    saveWorkforceSettings(settings: WorkforceSettings): Promise<WorkforceSettings>;
    compensation(employeeUserId: string): Promise<EmployeeCompensation[]>;
    addCompensation(input: Omit<EmployeeCompensation, "id" | "created_at">): Promise<EmployeeCompensation>;
    attendance(month?: string): Promise<AttendanceEvent[]>;
    clock(eventType: AttendanceEvent["event_type"]): Promise<AttendanceEvent>;
    correctionRequests(): Promise<TimeCorrectionRequest[]>;
    requestCorrection(input: {
      event_id?: string | null;
      event_type: AttendanceEvent["event_type"];
      occurred_at: string;
      reason: string;
    }): Promise<TimeCorrectionRequest>;
    reviewCorrection(correctionId: string, status: "approved" | "rejected", reason?: string): Promise<void>;
    swapTargets(): Promise<StaffEmployeeOption[]>;
    shiftSwapRequests(): Promise<StaffShiftSwapRequest[]>;
    requestShiftSwap(input: { shift_id: string; target_user_id: string; note?: string | null }): Promise<{ id: string }>;
    reviewShiftSwap(requestId: string, status: "approved" | "rejected", reason?: string): Promise<void>;
  };
}

declare global {
  interface Window {
    api: ShifaProApi;
  }
}

export {};
