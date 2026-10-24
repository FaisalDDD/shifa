import { z } from "zod";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const openingHour = z.object({
  day: z.number().int().min(0).max(6),
  open: time.nullable(),
  close: time.nullable(),
  closed: z.boolean(),
}).strict().refine((h) => h.closed || (h.open !== null && h.close !== null), {
  message: "Set opening and closing times for an open day.",
});

export const portalProfileSchema = z.object({
  pharmacy_id: z.uuid(),
  changes: z.object({
    phone: z.string().trim().max(50).nullable().optional(),
    website: z.url().max(500).refine((url) => /^https?:\/\//i.test(url), "Use an HTTP or HTTPS website.").nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    opening_hours: z.array(openingHour).max(7).refine(
      (hours) => new Set(hours.map((h) => h.day)).size === hours.length,
      "Only one opening window per day is supported.",
    ).nullable().optional(),
  }).strict().refine((changes) => Object.keys(changes).length > 0, "No changes provided."),
}).strict();

export const portalAvailabilitySchema = z.object({
  pharmacy_id: z.uuid(),
  is_available: z.boolean(),
}).strict();
