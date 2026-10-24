import { afterEach, describe, expect, it, vi } from "vitest";
import { savePortalChange } from "@/components/pharmacy/portal-request";

afterEach(() => vi.unstubAllGlobals());
describe("portal mutation response handling", () => {
  it("sends explicit availability with the preserved route and returns only confirmed data", async () => {
    const saved = { id: "branch", is_available: false };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: saved })));
    vi.stubGlobal("fetch", fetcher);
    expect(await savePortalChange("availability", { pharmacy_id: "branch", is_available: false })).toEqual(saved);
    expect(fetcher).toHaveBeenCalledWith("/api/pharmacy/availability", expect.objectContaining({ method: "POST", body: JSON.stringify({ pharmacy_id: "branch", is_available: false }) }));
  });
  it.each([new Response("not json", { status: 502 }), new Response(JSON.stringify({ ok: true }), { status: 200 })])("rejects malformed response %#", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(savePortalChange("profile", {})).rejects.toThrow();
  });
  it("propagates network failure so the UI can retain saved state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(savePortalChange("availability", {})).rejects.toThrow("offline");
  });

  it("rejects a server refusal instead of accepting an optimistic change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { message: "Denied" } }), { status: 403 })));
    await expect(savePortalChange("profile", { pharmacy_id: "id" })).rejects.toThrow();
  });
});
