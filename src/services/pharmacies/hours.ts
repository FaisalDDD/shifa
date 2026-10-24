// Opening-hours helpers. Pure functions (unit-testable).
// Opening hours are an array of { day: 0(Sun)..6(Sat), open, close, closed },
// with "HH:MM" 24-hour times.

import type { OpeningHour } from "@/types";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Whether the pharmacy is currently open.
 * Returns null when no usable hours data exists (unknown), so callers can
 * distinguish "unknown" from "closed" and never mislead users.
 */
export function isOpenNow(
  hours: OpeningHour[] | null | undefined,
  date: Date = new Date(),
): boolean | null {
  if (!hours || !Array.isArray(hours) || hours.length === 0) return null;
  const entry = hours.find((h) => h.day === date.getDay());
  if (!entry) return null;
  if (entry.closed) return false;
  if (!entry.open || !entry.close) return null;

  const now = date.getHours() * 60 + date.getMinutes();
  const open = toMinutes(entry.open);
  const close = toMinutes(entry.close);

  // Overnight shift (e.g. open 20:00, close 06:00).
  if (close <= open) {
    return now >= open || now < close;
  }
  return now >= open && now < close;
}

/** Human label for the current-day opening window, or null if unknown. */
export function todaysHoursLabel(
  hours: OpeningHour[] | null | undefined,
  date: Date = new Date(),
): string | null {
  if (!hours || !Array.isArray(hours) || hours.length === 0) return null;
  const entry = hours.find((h) => h.day === date.getDay());
  if (!entry) return null;
  if (entry.closed) return "Closed today";
  if (!entry.open || !entry.close) return null;
  return `${entry.open}–${entry.close}`;
}
