// Authorization / RLS integration tests.
// These run against a real Supabase (local via `supabase start`, or a linked
// remote). They are skipped cleanly when the environment is not configured.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(url && anon && serviceKey);

const PHARMACY_1 = "10000000-0000-4000-8000-000000000001";
const PHARMACY_2 = "10000000-0000-4000-8000-000000000002";
const PRODUCT_1 = "a0000000-0000-4000-8000-000000000001";

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

const created: TestUser[] = [];
let adminClient: SupabaseClient;
let customer: TestUser;
let staff: TestUser;
let staff2: TestUser;
let admin: TestUser;

describe.skipIf(!configured)("authorization / RLS", () => {
  beforeAll(async () => {
    adminClient = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ts = Date.now();
    const mk = async (name: string): Promise<TestUser> => {
      const email = `${name}-${ts}@test.local`;
      const { data } = await adminClient.auth.admin.createUser({
        email,
        password: "password123",
        email_confirm: true,
      });
      const client = createClient(url!, anon!, { auth: { persistSession: false } });
      const { error } = await client.auth.signInWithPassword({
        email,
        password: "password123",
      });
      if (error) throw error;
      const user = data.user!;
      created.push({ id: user.id, email, client });
      return { id: user.id, email, client };
    };

    customer = await mk("cust");
    staff = await mk("staff");
    staff2 = await mk("staff2");
    admin = await mk("admin");

    // Promote admin + assign staff to PHARMACY_1 (service role bypasses RLS).
    await adminClient.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    await adminClient.from("profiles").update({ role: "pharmacy_staff" }).eq("id", staff.id);
    await adminClient.from("profiles").update({ role: "pharmacy_staff" }).eq("id", staff2.id);
    await adminClient
      .from("pharmacy_members")
      .insert({ pharmacy_id: PHARMACY_1, user_id: staff.id, membership_role: "staff" });
    await adminClient
      .from("pharmacy_members")
      .insert({ pharmacy_id: PHARMACY_2, user_id: staff2.id, membership_role: "staff" });
  });

  afterAll(async () => {
    for (const u of created) {
      await adminClient.auth.admin.deleteUser(u.id).catch(() => {});
    }
  });

  it("customer cannot create a VERIFIED pharmacy (no self-verification)", async () => {
    const { error } = await customer.client.from("pharmacies").insert({
      name: "Self Verified Pharmacy",
      slug: `self-verify-${Date.now()}`,
      address: "1 Test St",
      latitude: 0,
      longitude: 0,
      verification_status: "verified",
    });
    expect(error).toBeTruthy();
  });

  it("customer CAN create a PENDING pharmacy (self-serve registration)", async () => {
    const { error } = await customer.client.from("pharmacies").insert({
      name: "My New Pharmacy",
      slug: `my-pharmacy-${Date.now()}`,
      address: "2 Test St",
      latitude: 0,
      longitude: 0,
      verification_status: "pending",
    });
    expect(error).toBeFalsy();
  });

  it("customer cannot create a product (admin-only)", async () => {
    const { error } = await customer.client.from("products").insert({
      canonical_name: "Unauthorized Product",
      is_demo: false,
    });
    expect(error).toBeTruthy();
  });

  it("customer cannot change their own role", async () => {
    const { error } = await customer.client
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", customer.id);
    expect(error).toBeTruthy();
  });

  it("pharmacy staff cannot modify another pharmacy's inventory", async () => {
    const { error } = await staff.client.from("pharmacy_inventory").insert({
      pharmacy_id: PHARMACY_2,
      product_id: PRODUCT_1,
      availability_status: "AVAILABLE",
      source: "PHARMACY_MANUAL",
    });
    expect(error).toBeTruthy();
  });

  it("pharmacy staff CAN update their own pharmacy's inventory", async () => {
    const { error } = await staff.client.from("pharmacy_inventory").upsert(
      {
        pharmacy_id: PHARMACY_1,
        product_id: PRODUCT_1,
        availability_status: "AVAILABLE",
        quantity: 5,
        source: "PHARMACY_MANUAL",
        last_updated_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        updated_by: staff.id,
      },
      { onConflict: "pharmacy_id,product_id" },
    );
    expect(error).toBeFalsy();
  });

  it("a reservation is only visible to its owner, the pharmacy, and admins", async () => {
    // Customer creates their own reservation.
    const { data: createdReservation, error: createErr } = await customer.client
      .from("reservations")
      .insert({
        customer_id: customer.id,
        pharmacy_id: PHARMACY_1,
        product_id: PRODUCT_1,
        quantity: 1,
        status: "REQUESTED",
      })
      .select("*")
      .single();
    expect(createErr).toBeFalsy();

    // Staff of PHARMACY_1 CAN see it (authorized).
    const { data: staffView } = await staff.client
      .from("reservations")
      .select("*")
      .eq("id", createdReservation.id);
    expect(staffView).toHaveLength(1);
  });

  it("a non-member customer cannot read another customer's reservation", async () => {
    const second = await (async () => {
      const email = `cust2-${Date.now()}@test.local`;
      const { data } = await adminClient.auth.admin.createUser({
        email,
        password: "password123",
        email_confirm: true,
      });
      const client = createClient(url!, anon!, { auth: { persistSession: false } });
      await client.auth.signInWithPassword({ email, password: "password123" });
      created.push({ id: data.user!.id, email, client });
      return client;
    })();

    const { data, error } = await second.from("reservations").select("*");
    expect(error).toBeFalsy();
    expect(data).toHaveLength(0); // sees none of customer's reservations
  });

  it("admin can create a product (positive control)", async () => {
    const { error } = await admin.client.from("products").insert({
      canonical_name: `Admin Product ${Date.now()}`,
      is_demo: true,
    });
    expect(error).toBeFalsy();
  });

  it("B2B purchase request: buyer creates, cannot self-accept, seller accepts", async () => {
    // staff (member of PHARMACY_1) buys from PHARMACY_2.
    const { data: req, error: createErr } = await staff.client
      .from("purchase_requests")
      .insert({
        buyer_pharmacy_id: PHARMACY_1,
        seller_pharmacy_id: PHARMACY_2,
        product_id: PRODUCT_1,
        quantity: 100,
        status: "REQUESTED",
      })
      .select("*")
      .single();
    expect(createErr).toBeFalsy();

    // Buyer cannot accept their own outgoing request (trigger blocks non-seller).
    const { error: buyerAcceptErr } = await staff.client
      .from("purchase_requests")
      .update({ status: "ACCEPTED" })
      .eq("id", req.id);
    expect(buyerAcceptErr).toBeTruthy();

    // Seller (staff2, member of PHARMACY_2) accepts it.
    const { error: sellerAcceptErr } = await staff2.client
      .from("purchase_requests")
      .update({ status: "ACCEPTED" })
      .eq("id", req.id);
    expect(sellerAcceptErr).toBeFalsy();
  });
});
