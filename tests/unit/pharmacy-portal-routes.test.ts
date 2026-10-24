import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user, requirePharmacyMember: vi.fn().mockResolvedValue({ id: "owner-user" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/services/audit", () => ({ recordAudit: mocks.audit }));
import { POST as setAvailability } from "@/app/api/pharmacy/availability/route";
import { PATCH } from "@/app/api/pharmacy/profile/route";
import { Errors } from "@/lib/errors";

const pharmacyId = "11111111-1111-4111-8111-111111111111";
const request = (changes: unknown = { phone: "123" }) => new Request("http://localhost/api/pharmacy/profile", {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pharmacy_id: pharmacyId, changes }),
});

function database(role: string | null, options: { membershipError?: boolean; writeError?: boolean } = {}) {
  const eq = vi.fn().mockReturnThis();
  const membership = { select: vi.fn().mockReturnThis(), eq, maybeSingle: vi.fn().mockResolvedValue({ data: role ? { membership_role: role } : null, error: options.membershipError ? new Error("membership failed") : null }) };
  const single = vi.fn().mockResolvedValue({ data: options.writeError ? null : { id: pharmacyId, phone: "123" }, error: options.writeError ? new Error("write failed") : null });
  const pharmacy = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single };
  mocks.client.mockResolvedValue({ from: (name: string) => name === "pharmacy_members" ? membership : pharmacy });
  return { membership, pharmacy, eq };
}

beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "owner-user" }); mocks.audit.mockResolvedValue(undefined); });

describe("owner-only availability route", () => {
  const availabilityRequest = (body: unknown = { pharmacy_id: pharmacyId, is_available: false }) => new Request("http://localhost/api/pharmacy/availability", { method: "POST", body: JSON.stringify(body) });
  it.each(["staff", null])("rejects non-owner %s", async (role) => {
    const db = database(role);
    expect((await setAvailability(availabilityRequest())).status).toBe(404);
    expect(db.pharmacy.update).not.toHaveBeenCalled();
  });
  it("persists the explicit boolean for an authenticated owner and audits", async () => {
    const db = database("owner");
    expect((await setAvailability(availabilityRequest())).status).toBe(200);
    expect(db.pharmacy.update).toHaveBeenCalledWith({ is_available: false });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "owner-user", action: "pharmacy.portal.availability.update", entityId: pharmacyId }));
  });
  it("rejects malformed ids and non-booleans without querying", async () => {
    expect((await setAvailability(availabilityRequest({ pharmacy_id: "bad", is_available: "false" }))).status).toBe(422);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});

describe("owner-only profile route", () => {
  it("requires authentication even when a pharmacy id is known", async () => {
    const db = database("owner");
    mocks.user.mockRejectedValue(Errors.unauthenticated());
    expect((await PATCH(request())).status).toBe(401);
    expect(db.pharmacy.update).not.toHaveBeenCalled();
  });

  it("hides non-owned listings and checks the authenticated user, not a client user id", async () => {
    const db = database(null);
    expect((await PATCH(request())).status).toBe(404);
    expect(db.eq).toHaveBeenCalledWith("user_id", "owner-user");
    expect(db.eq).toHaveBeenCalledWith("pharmacy_id", pharmacyId);
    expect(db.pharmacy.update).not.toHaveBeenCalled();
  });

  it("writes only allowed columns through the verified session and records field names", async () => {
    const db = database("owner");
    const response = await PATCH(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.phone).toBe("123");
    expect(db.pharmacy.update).toHaveBeenCalledWith({ phone: "123" });
    expect(db.pharmacy.eq).toHaveBeenCalledWith("id", pharmacyId);
    expect(mocks.audit).toHaveBeenCalledWith({ actorUserId: "owner-user", action: "pharmacy.portal.profile.update", entityType: "pharmacy", entityId: pharmacyId, metadata: { fields: ["phone"] } });
  });

  it("rejects protected fields before writes", async () => {
    const db = database("owner");
    expect((await PATCH(request({ phone: "123", verification_status: "verified" }))).status).toBe(422);
    expect(db.pharmacy.update).not.toHaveBeenCalled();
  });

  it("handles malformed JSON as validation failure", async () => {
    expect((await PATCH(new Request("http://localhost/api/pharmacy/profile", { method: "PATCH", body: "{" }))).status).toBe(422);
  });

  it.each(["membership", "write"])("does not report success on a %s failure", async (stage) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = database("owner", { membershipError: stage === "membership", writeError: stage === "write" });
    const response = await PATCH(request());
    expect(response.status).toBe(500);
    expect(mocks.audit).not.toHaveBeenCalled();
    if (stage === "membership") expect(db.pharmacy.update).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("rejects staff before a write or audit", async () => {
    const db = database("staff");
    expect((await PATCH(request())).status).toBe(404);
    expect(db.pharmacy.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
