import { describe, expect, it } from "vitest";
import { pharmacyBranchRegisterSchema } from "@/lib/validation/schemas";

describe("pharmacy branch registration validation", () => {
  it("requires a business and branch identity while preserving pending registration fields", () => {
    const result = pharmacyBranchRegisterSchema.parse({
      business_id: "11111111-1111-4111-8111-111111111111",
      branch_name: "Port Sudan branch",
      branch_code: "PORT-SUDAN",
      name: "Shifa Pharmacy Port Sudan",
      address: "Market Street",
      latitude: 19.6158,
      longitude: 37.2164,
    });
    expect(result.business_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.branch_code).toBe("PORT-SUDAN");
  });

  it("rejects an invalid branch code", () => {
    expect(() => pharmacyBranchRegisterSchema.parse({
      business_id: "11111111-1111-4111-8111-111111111111",
      branch_name: "Branch",
      branch_code: "not valid",
      name: "Pharmacy",
      address: "Address",
      latitude: 0,
      longitude: 0,
    })).toThrow();
  });
});
