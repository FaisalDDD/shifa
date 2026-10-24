import { describe, expect, it } from "vitest";
import { portalProfileSchema } from "@/services/pharmacy-portal/validation";

const pharmacyId = "11111111-1111-4111-8111-111111111111";

describe("portal profile allowlist", () => {
  it.each(["name", "slug", "address", "city", "postal_code", "country_code", "latitude", "longitude", "verification_status", "is_active", "is_demo", "is_available", "services"])("rejects protected column %s instead of silently ignoring it", (key) => {
    expect(portalProfileSchema.safeParse({ pharmacy_id: pharmacyId, changes: { [key]: "changed", phone: "123" } }).success).toBe(false);
  });

  it.each([
    { pharmacy_id: "invalid", changes: { phone: "123" } },
    { pharmacy_id: pharmacyId, changes: {} },
    { pharmacy_id: pharmacyId, changes: { website: "javascript:alert(1)" } },
    { pharmacy_id: pharmacyId, changes: { description: "x".repeat(2001) } },
    { pharmacy_id: pharmacyId, changes: { opening_hours: [{ day: 7, open: "09:00", close: "17:00", closed: false }] } },
    { pharmacy_id: pharmacyId, changes: { opening_hours: [{ day: 1, open: "25:00", close: "17:00", closed: false }] } },
    { pharmacy_id: pharmacyId, changes: { opening_hours: [{ day: 1, open: null, close: null, closed: false }] } },
    { pharmacy_id: pharmacyId, changes: { opening_hours: [0, 0].map((day) => ({ day, open: null, close: null, closed: true })) } },
  ])("rejects invalid profile payload %#", (payload) => {
    expect(portalProfileSchema.safeParse(payload).success).toBe(false);
  });

  it("accepts existing contact fields and opening hours without identity fields", () => {
    const result = portalProfileSchema.safeParse({
      pharmacy_id: pharmacyId,
      changes: { phone: " +964 770 123 4567 ", website: "https://example.com", description: null,
        opening_hours: [{ day: 1, open: "09:00", close: "17:00", closed: false }] },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.changes.phone).toBe("+964 770 123 4567");
  });
});
