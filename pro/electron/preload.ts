// Preload bridge: exposes a typed, minimal API surface to the renderer.
// The renderer never gets direct Node/DB access — only these IPC methods.

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  auth: {
    signIn: (email: string, password: string) =>
      ipcRenderer.invoke("auth:signIn", email, password),
    selectBranch: (branchId: string) => ipcRenderer.invoke("auth:selectBranch", branchId),
    signOut: () => ipcRenderer.invoke("auth:signOut"),
  },
  settings: {
    changePassword: (newPassword: string) =>
      ipcRenderer.invoke("settings:changePassword", newPassword),
    getBackend: () => ipcRenderer.invoke("settings:getBackend"),
    setBackend: (input: { url: string; anonKey: string }) =>
      ipcRenderer.invoke("settings:setBackend", input),
  },
  sync: {
    pull: () => ipcRenderer.invoke("sync:pull"),
    push: () => ipcRenderer.invoke("sync:push"),
    status: () => ipcRenderer.invoke("sync:status"),
    reconcile: () => ipcRenderer.invoke("sync:reconcile"),
  },
  catalog: {
    list: (query?: string) => ipcRenderer.invoke("catalog:list", query ?? ""),
  },
  aliases: {
    add: (productId: string, alias: string) => ipcRenderer.invoke("aliases:add", productId, alias),
  },
  stock: {
    receive: (batch: {
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
    }) => ipcRenderer.invoke("stock:receive", batch),
    remove: (productId: string) => ipcRenderer.invoke("stock:remove", productId),
    levels: () => ipcRenderer.invoke("stock:levels"),
  },
  sale: {
    create: (
      lines: { product_id: string; quantity: number; unit_price: number }[],
      opts?: { customer_id?: string | null; payment_method?: string | null; due_date?: string | null },
    ) => ipcRenderer.invoke("sale:create", lines, opts),
  },
  customers: {
    add: (input: {
      name: string;
      phone?: string | null;
      birth_date?: string | null;
      age?: string | null;
      address?: string | null;
    }) => ipcRenderer.invoke("customers:add", input),
    list: () => ipcRenderer.invoke("customers:list"),
    invoices: () => ipcRenderer.invoke("customers:invoices"),
    settle: (customerId: string, amount?: number, paymentMethod?: "cash" | "bank", invoiceId?: string | null) =>
      ipcRenderer.invoke("customers:settle", customerId, amount, paymentMethod, invoiceId),
  },
  sales: {
    list: () => ipcRenderer.invoke("sales:list"),
    report: (start: string, end: string) => ipcRenderer.invoke("sales:report", start, end),
    setRate: (date: string, sdgPerUsd: number) => ipcRenderer.invoke("sales:setRate", date, sdgPerUsd),
    exportPdf: (start: string, end: string) => ipcRenderer.invoke("sales:exportPdf", start, end),
  },
  finance: {
    expenses: (start: string, end: string) => ipcRenderer.invoke("finance:expenses:list", start, end),
    addExpense: (input: {
      business_date: string;
      category: string;
      description: string;
      supplier?: string | null;
      amount_sdg: number;
      payment_method: "cash" | "bank" | "unpaid";
    }) => ipcRenderer.invoke("finance:expenses:create", input),
    journal: (start: string, end: string) => ipcRenderer.invoke("finance:journal:list", start, end),
    closePeriod: (start: string, end: string) => ipcRenderer.invoke("finance:period:close", start, end),
    reopenPeriod: (start: string, end: string, reason: string) => ipcRenderer.invoke("finance:period:reopen", start, end, reason),
    pricePreview: (scope: "all" | "otc" | "prescription" | "unknown", percent: number) => ipcRenderer.invoke("finance:prices:preview", scope, percent),
    latestPriceAdjustment: () => ipcRenderer.invoke("finance:prices:latest"),
    applyPriceAdjustment: (scope: "all" | "otc" | "prescription" | "unknown", percent: number, reason: string) => ipcRenderer.invoke("finance:prices:apply", scope, percent, reason),
    rollbackPriceAdjustment: (id: string) => ipcRenderer.invoke("finance:prices:rollback", id),
  },
  inventory: {
    exceptions: () => ipcRenderer.invoke("inventory:exceptions"),
  },
  product: {
    submit: (submission: {
      canonical_name: string;
      brand_name?: string | null;
      strength?: string | null;
      dosage_form?: string | null;
      barcode?: string | null;
      prescription_classification: string;
      image_url?: string | null;
      image_data_url?: string | null;
    }) => ipcRenderer.invoke("product:submit", submission),
    lookupImage: (name: string) => ipcRenderer.invoke("product:lookupImage", name),
    setPrice: (productId: string, price: number) =>
      ipcRenderer.invoke("product:setPrice", productId, price),
    setThreshold: (productId: string, threshold: number) =>
      ipcRenderer.invoke("product:setThreshold", productId, threshold),
  },
  insights: {
    expiring: () => ipcRenderer.invoke("insights:expiring"),
    suggestions: () => ipcRenderer.invoke("insights:suggestions"),
  },
  purchases: {
    mostPurchased: () => ipcRenderer.invoke("purchases:mostPurchased"),
    payables: () => ipcRenderer.invoke("purchases:payables"),
    pay: (id: string, amount: number, paymentMethod: "cash" | "bank" = "cash") => ipcRenderer.invoke("purchases:pay", id, amount, paymentMethod),
    payments: (id: string) => ipcRenderer.invoke("purchases:payments", id),
    attach: (id: string) => ipcRenderer.invoke("purchases:attach", id),
    openAttachment: (id: string) => ipcRenderer.invoke("purchases:openAttachment", id),
    markPaid: (id: string, paymentMethod: "cash" | "bank" = "cash") => ipcRenderer.invoke("purchases:markPaid", id, paymentMethod),
  },
  hr: {
    addShift: (input: {
      employee_user_id: string;
      date: string;
      start_time: string;
      end_time: string;
      id?: string;
      location?: string | null;
      role_label?: string | null;
      break_minutes?: number;
      timezone?: string;
      notes?: string | null;
    }) => ipcRenderer.invoke("hr:shift:add", input),
    listShifts: (month?: string, status?: "all" | "draft" | "published" | "cancelled") => ipcRenderer.invoke("hr:shift:list", month, status),
    deleteShift: (shiftId: string) => ipcRenderer.invoke("hr:shift:delete", shiftId),
    setScheduleState: (startDate: string, endDate: string, state: "published" | "draft") =>
      ipcRenderer.invoke("hr:schedule:state", startDate, endDate, state),
    addVacation: (input: {
      staff_name: string;
      start_date: string;
      end_date: string;
      reason?: string | null;
    }) => ipcRenderer.invoke("hr:vacation:add", input),
    listVacations: () => ipcRenderer.invoke("hr:vacation:list"),
    addSwap: (input: {
      staff_name: string;
      colleague_name: string;
      date: string;
      note?: string | null;
    }) => ipcRenderer.invoke("hr:swap:add", input),
    listSwaps: () => ipcRenderer.invoke("hr:swap:list"),
  },
  team: {
    list: () => ipcRenderer.invoke("team:list"),
    invite: (email: string) => ipcRenderer.invoke("team:invite", email),
    provisionAdmin: (input: { email: string; password: string; display_name: string }) => ipcRenderer.invoke("team:provisionAdmin", input),
    remove: (userId: string) => ipcRenderer.invoke("team:remove", userId),
    saveSettings: (input: {
      user_id: string;
      display_name: string;
      job_title: string;
      display_color: string;
      avatar_data_url: string | null;
      weekly_target_hours: number;
      working_days: number[];
      shift_start: string;
      shift_end: string;
      employment_status: "active" | "on_leave" | "suspended" | "deactivated";
      department?: string | null;
      location?: string | null;
      manager_user_id?: string | null;
      contract_type?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    }) => ipcRenderer.invoke("team:settings:save", input),
    listLeaves: () => ipcRenderer.invoke("team:leave:list"),
    requestLeave: (input: {
      employee_user_id?: string;
      leave_type: "sick" | "annual" | "personal";
      start_date: string;
      end_date: string;
      reason?: string | null;
    }) => ipcRenderer.invoke("team:leave:request", input),
    reviewLeave: (leaveId: string, status: "approved" | "rejected" | "needs_information", reason?: string) =>
      ipcRenderer.invoke("team:leave:review", leaveId, status, reason),
    respondLeave: (leaveId: string, response: string) => ipcRenderer.invoke("team:leave:respond", leaveId, response),
    withdrawLeave: (leaveId: string) => ipcRenderer.invoke("team:leave:withdraw", leaveId),
    notifications: () => ipcRenderer.invoke("team:notifications:list"),
    markNotificationRead: (notificationId: string) => ipcRenderer.invoke("team:notifications:read", notificationId),
    auditEvents: () => ipcRenderer.invoke("team:audit:list"),
    workforceSettings: () => ipcRenderer.invoke("team:workforce:get"),
    saveWorkforceSettings: (settings: {
      timezone: string; currency: string; week_starts_on: number;
      attendance_enabled: boolean; payroll_preparation_enabled: boolean;
    }) => ipcRenderer.invoke("team:workforce:save", settings),
    compensation: (employeeUserId: string) => ipcRenderer.invoke("team:compensation:list", employeeUserId),
    addCompensation: (input: {
      employee_user_id: string; effective_date: string;
      pay_basis: "day" | "week" | "month" | "hour" | "annual";
      amount: number; currency: string; pay_schedule: string | null;
    }) => ipcRenderer.invoke("team:compensation:add", input),
    attendance: (month?: string) => ipcRenderer.invoke("team:attendance:list", month),
    clock: (eventType: "clock_in" | "clock_out" | "break_start" | "break_end") =>
      ipcRenderer.invoke("team:attendance:clock", eventType),
    correctionRequests: () => ipcRenderer.invoke("team:attendance:corrections"),
    requestCorrection: (input: {
      event_id?: string | null; event_type: "clock_in" | "clock_out" | "break_start" | "break_end";
      occurred_at: string; reason: string;
    }) => ipcRenderer.invoke("team:attendance:correction:request", input),
    reviewCorrection: (correctionId: string, status: "approved" | "rejected", reason?: string) =>
      ipcRenderer.invoke("team:attendance:correction:review", correctionId, status, reason),
    swapTargets: () => ipcRenderer.invoke("team:shift-swap:targets"),
    shiftSwapRequests: () => ipcRenderer.invoke("team:shift-swap:list"),
    requestShiftSwap: (input: { shift_id: string; target_user_id: string; note?: string | null }) =>
      ipcRenderer.invoke("team:shift-swap:request", input),
    reviewShiftSwap: (requestId: string, status: "approved" | "rejected", reason?: string) =>
      ipcRenderer.invoke("team:shift-swap:review", requestId, status, reason),
  },
});
