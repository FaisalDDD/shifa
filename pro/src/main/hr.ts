// HR / scheduling: shifts (month planning), vacation requests, and shift-swap
// requests. Stored locally; staff identify by name for now.

import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { all, run } from "./db";
import type { Shift, ShiftSwapRequest, VacationRequest } from "../shared/types";

export function addShift(
  db: Database,
  input: { staff_name: string; date: string; start_time: string; end_time: string },
): Shift {
  const id = randomUUID();
  run(
    db,
    `INSERT INTO shifts (id, staff_name, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)`,
    [id, input.staff_name, input.date, input.start_time, input.end_time],
  );
  return {
    id, ...input, status: "draft", location: null, role_label: null,
    break_minutes: 0, timezone: "Africa/Khartoum", published_at: null,
  };
}

export function listShifts(db: Database, month?: string): Shift[] {
  if (month) {
    return all<Shift>(
      db,
      `SELECT id, staff_name, date, start_time, end_time FROM shifts
       WHERE date LIKE ? ORDER BY date, start_time`,
      [`${month}%`],
    );
  }
  return all<Shift>(
    db,
    `SELECT id, staff_name, date, start_time, end_time FROM shifts ORDER BY date, start_time`,
  );
}

export function addVacation(
  db: Database,
  input: { staff_name: string; start_date: string; end_date: string; reason?: string | null },
): VacationRequest {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  run(
    db,
    `INSERT INTO vacation_requests (id, staff_name, start_date, end_date, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [id, input.staff_name, input.start_date, input.end_date, input.reason ?? null, createdAt],
  );
  return {
    id,
    staff_name: input.staff_name,
    start_date: input.start_date,
    end_date: input.end_date,
    reason: input.reason ?? null,
    status: "pending",
    created_at: createdAt,
  };
}

export function listVacations(db: Database): VacationRequest[] {
  return all<VacationRequest>(
    db,
    `SELECT id, staff_name, start_date, end_date, reason, status, created_at
     FROM vacation_requests ORDER BY created_at DESC`,
  );
}

export function addShiftSwap(
  db: Database,
  input: { staff_name: string; colleague_name: string; date: string; note?: string | null },
): ShiftSwapRequest {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  run(
    db,
    `INSERT INTO shift_swap_requests (id, staff_name, colleague_name, date, note, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [id, input.staff_name, input.colleague_name, input.date, input.note ?? null, createdAt],
  );
  return {
    id,
    staff_name: input.staff_name,
    colleague_name: input.colleague_name,
    date: input.date,
    note: input.note ?? null,
    status: "pending",
    created_at: createdAt,
  };
}

export function listShiftSwaps(db: Database): ShiftSwapRequest[] {
  return all<ShiftSwapRequest>(
    db,
    `SELECT id, staff_name, colleague_name, date, note, status, created_at
     FROM shift_swap_requests ORDER BY created_at DESC`,
  );
}
