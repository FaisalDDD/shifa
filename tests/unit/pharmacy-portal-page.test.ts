import { createElement, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PharmacyDashboard } from "@/components/pharmacy/pharmacy-dashboard";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ profile: vi.fn(), pharmacies: vi.fn(), owners: vi.fn(), release: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentProfile: mocks.profile }));
vi.mock("@/services/pharmacies/register", () => ({ getUserPharmacies: mocks.pharmacies }));
vi.mock("@/services/pharmacy-portal/ownership", () => ({ getPortalOwnerIds: mocks.owners }));
vi.mock("@/services/pharmacy-portal/pro-release", () => ({ getProRelease: mocks.release }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/pharmacy/pharmacy-dashboard", () => ({ PharmacyDashboard: (props: ComponentProps<typeof PharmacyDashboard>) => createElement("div", props) }));
import PharmacyPage from "@/app/pharmacy/page";

describe("portal server page", () => {
  it("passes server-derived ownership and available installer metadata to the portal", async () => {
    mocks.profile.mockResolvedValue({ id: "owner-user" });
    mocks.pharmacies.mockResolvedValue([]);
    mocks.owners.mockResolvedValue(["branch"]);
    const release = { filename: "Shifa Pro Setup 0.1.0.exe", version: "0.1.0", sizeBytes: 10 };
    mocks.release.mockResolvedValue(release);
    const page = await PharmacyPage();
    expect(page.props.ownerPharmacyIds).toEqual(["branch"]);
    expect(page.props.release).toEqual(release);
    expect(mocks.owners).toHaveBeenCalledWith("owner-user");
  });
});
