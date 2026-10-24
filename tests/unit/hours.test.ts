import { describe, it, expect } from "vitest";
import { isOpenNow, todaysHoursLabel } from "@/services/pharmacies/hours";
import type { OpeningHour } from "@/types";

const weekdayHours: OpeningHour[] = [
  { day: 0, open: null, close: null, closed: true },
  { day: 1, open: "09:00", close: "17:00", closed: false },
  { day: 2, open: "09:00", close: "17:00", closed: false },
  { day: 3, open: "09:00", close: "17:00", closed: false },
  { day: 4, open: "09:00", close: "17:00", closed: false },
  { day: 5, open: "09:00", close: "17:00", closed: false },
  { day: 6, open: "10:00", close: "14:00", closed: false },
];

// 2026-10-14 is a Wednesday (day 3).
const wednesdayMorning = new Date("2026-10-14T10:00:00Z");
const wednesdayEvening = new Date("2026-10-14T18:00:00Z");
const sunday = new Date("2026-10-11T12:00:00Z"); // Sunday (day 0)

describe("isOpenNow", () => {
  it("returns null when no hours are provided", () => {
    expect(isOpenNow(null)).toBeNull();
    expect(isOpenNow([])).toBeNull();
  });

  it("returns true during opening hours", () => {
    expect(isOpenNow(weekdayHours, wednesdayMorning)).toBe(true);
  });

  it("returns false outside opening hours", () => {
    expect(isOpenNow(weekdayHours, wednesdayEvening)).toBe(false);
  });

  it("returns false on a closed day", () => {
    expect(isOpenNow(weekdayHours, sunday)).toBe(false);
  });
});

describe("todaysHoursLabel", () => {
  it("shows the window for the current day", () => {
    expect(todaysHoursLabel(weekdayHours, wednesdayMorning)).toBe("09:00–17:00");
  });

  it("shows closed for a closed day", () => {
    expect(todaysHoursLabel(weekdayHours, sunday)).toBe("Closed today");
  });

  it("returns null when no hours", () => {
    expect(todaysHoursLabel(null)).toBeNull();
  });
});
