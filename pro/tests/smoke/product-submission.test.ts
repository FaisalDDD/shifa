// Live smoke test: pharmacy product submission end-to-end against the real
// local Supabase. Signs up a throwaway user, submits a product as 'pending',
// and verifies it is saved to the Shifa database but hidden from the public
// catalog until an admin verifies it (RLS scoping).

import { describe, expect, it } from "vitest";
import { insertProduct, postgrest, signUp } from "../../src/main/supabase";

// This creates real backend rows. Run only against an explicitly chosen test backend.
describe.skipIf(process.env.SHIFA_LIVE_SMOKE !== "1")("smoke: product submission (pending -> hidden until verified)", () => {
  it("saves a pending product and hides it from the public catalog", async () => {
    const email = `pro-test-${Date.now()}@example.com`;
    const session = await signUp(email, "test-password-123");
    expect(session.access_token).toBeTruthy();

    const created = await insertProduct(
      session.access_token,
      session.user_id,
      {
        canonical_name: `Shifa Pro Test ${Date.now()}`,
        brand_name: "TestBrand",
        strength: "10 mg",
        dosage_form: "tablet",
        barcode: null,
        prescription_classification: "otc",
        image_url: "https://example.com/test.png",
      },
    );
    expect(created.id).toBeTruthy();

    // Public (anon) read must NOT see the pending product.
    const pub = await postgrest<{ id: string }[]>(
      `products?id=eq.${created.id}&select=id`,
    );
    expect(pub).toHaveLength(0);

    // The submitter CAN see their own pending submission.
    const own = await postgrest<{ id: string }[]>(
      `products?id=eq.${created.id}&select=id`,
      { token: session.access_token },
    );
    expect(own).toHaveLength(1);

    // Verified products remain public.
    const catalog = await postgrest<{ id: string }[]>(
      `products?select=id&limit=1`,
    );
    expect(catalog.length).toBeGreaterThan(0);
  });
});
