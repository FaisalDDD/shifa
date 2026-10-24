import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pharmacy } from "@/types";
const language = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/lib/i18n", () => ({ useLanguage: () => ({ lang: language.lang, t: (key: string) => key }) }));
import { PharmacyDashboard } from "@/components/pharmacy/pharmacy-dashboard";

const pharmacy: Pharmacy = {
  id: "11111111-1111-4111-8111-111111111111", name: "Al Noor Pharmacy", slug: "al-noor", description: "Your neighbourhood pharmacy",
  address: "10 Main Street", city: "Baghdad", postal_code: null, country_code: "IQ", latitude: 33, longitude: 44,
  phone: "+9647700000000", website: null, verification_status: "pending", is_active: true, is_available: true, is_demo: false,
  opening_hours: null, services: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
};
const release = { filename: "Shifa Pro Setup 0.1.0.exe", version: "0.1.0", sizeBytes: 1024 };
beforeEach(() => { language.lang = "en"; });

describe("lightweight pharmacy portal", () => {
  it("uses actual release metadata for a real download, never a placeholder", () => {
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [pharmacy], ownerPharmacyIds: [pharmacy.id], release }));
    expect(html).toContain('href="/api/downloads/pro"');
    expect(html).toContain("v0.1.0");
    expect(html).toContain("Edit profile");
    expect(html).not.toContain("Owner access required");
  });
  it("shows unavailable release honestly without a dead download link", () => {
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [pharmacy], release: null }));
    expect(html).toContain("Installer unavailable");
    expect(html).not.toContain('href="/api/downloads/pro"');
    expect(html).toContain('href="/contact"');
  });
  it("defaults to read-only, disabling availability and hiding profile editing", () => {
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [pharmacy] }));
    expect(html).toContain("Read-only access");
    expect(html).not.toContain("Edit profile");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Set temporarily unavailable/);
    expect(html).toContain("Protected identity");
  });
  it("uses the supplied branch listings, without fake branches", () => {
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [pharmacy, { ...pharmacy, id: "second", name: "Second branch" }] }));
    expect(html).toContain('value="second"');
    expect(html).toContain("Second branch");
  });
  it("offers onboarding when there are no listings", () => {
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [] }));
    expect(html).toContain('href="/pharmacy/register"');
    expect(html).not.toContain('id="portal-branch"');
    expect(html).not.toContain("Temporary availability");
  });
  it.each(["verified", "rejected", "suspended"] as const)("renders verification state %s", (verification_status) => {
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [{ ...pharmacy, verification_status }] }));
    expect(html).toContain(({ verified: "Verified listing", rejected: "Review needed", suspended: "Listing suspended" })[verification_status]);
  });
  it("renders Arabic labels with RTL without changing global i18n", () => {
    language.lang = "ar";
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [pharmacy] }));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("بوابة الصيدلية");
    expect(html).toContain("حالة الاتصال غير معروفة");
    expect(html).toContain("الهوية المحمية");
    expect(html).not.toContain("Connection unknown");
  });

  it("renders listing, verification and honest connection status instead of operational management", () => {
    const html = renderToStaticMarkup(createElement(PharmacyDashboard, { pharmacies: [pharmacy] }));
    expect(html).toContain("Pharmacy portal");
    expect(html).toContain("Connection unknown");
    expect(html).toContain("Pending review");
    expect(html).toContain('href="/pharmacies/al-noor"');
    expect(html).not.toMatch(/InventoryPanel|SuppliersPanel|Purchase requests|Add product|pd\.tab\.inventory/);
  });
});
