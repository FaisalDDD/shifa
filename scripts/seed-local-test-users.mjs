import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from `supabase status -o env` first.");
}
const parsed = new URL(url);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("Refusing to seed test accounts: this script only runs against a local Supabase URL.");
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const demoUsers = [
  {
    email: "pharma1@test.test",
    legacyEmail: "owner@shifa.test",
    password: "testtes",
    name: "Pharma 1 Administrator",
    role: "owner",
  },
  {
    email: "employee@shifa.test",
    password: "testtes",
    name: "Pharma 1 Employee",
    role: "staff",
  },
];

async function ensureUser(account) {
  const { data: page, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existing = page.users.find((user) => user.email?.toLowerCase() === account.email)
    ?? page.users.find((user) => user.email?.toLowerCase() === account.legacyEmail);
  const userMetadata = {
    display_name: account.name,
    account_type: account.role === "owner" ? "pharmacy_owner" : "pharmacy_employee",
  };
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: userMetadata,
    });
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (error) throw error;
  return data.user;
}

const [owner, employee] = await Promise.all(demoUsers.map(ensureUser));
const pharmacyId = "50000000-0000-4000-8000-000000000001";
const pharmacy = {
  id: pharmacyId,
  name: "Pharma 1 Test Pharmacy",
  slug: "pharma1-test-pharmacy",
  description: "Fictional local testing pharmacy.",
  address: "1 Local Test Street",
  city: "Khartoum",
  country_code: "SD",
  latitude: 15.5007,
  longitude: 32.5599,
  phone: "+249 000 000 000",
  verification_status: "verified",
  is_active: true,
  is_demo: true,
};
const { error: pharmacyError } = await supabase.from("pharmacies").upsert(pharmacy, { onConflict: "id" });
if (pharmacyError) throw pharmacyError;
for (const [account, user] of [[demoUsers[0], owner], [demoUsers[1], employee]]) {
  const { error } = await supabase.from("profiles")
    .update({ email: account.email, display_name: account.name })
    .eq("id", user.id);
  if (error) throw error;
}
const { error: membersError } = await supabase.from("pharmacy_members").upsert([
  { pharmacy_id: pharmacyId, user_id: owner.id, membership_role: "owner" },
  { pharmacy_id: pharmacyId, user_id: employee.id, membership_role: "staff" },
], { onConflict: "pharmacy_id,user_id" });
if (membersError) throw membersError;
const { data: branch, error: branchError } = await supabase
  .from("pharmacies")
  .select("business_id")
  .eq("id", pharmacyId)
  .single();
if (branchError || !branch?.business_id) throw branchError ?? new Error("Demo branch business was not created.");
const { error: businessMemberError } = await supabase.from("pharmacy_business_members").upsert(
  { business_id: branch.business_id, user_id: owner.id, membership_role: "owner" },
  { onConflict: "business_id,user_id" },
);
if (businessMemberError) throw businessMemberError;

const shiftDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const { error: shiftError } = await supabase.from("pharmacy_shifts").upsert({
  pharmacy_id: pharmacyId,
  employee_user_id: employee.id,
  shift_date: shiftDate,
  start_time: "09:00",
  end_time: "17:00",
  notes: "Local demo shift",
  created_by: owner.id,
}, { onConflict: "pharmacy_id,employee_user_id,shift_date,start_time" });
if (shiftError) throw shiftError;

console.log(`Local demo pharmacy ready: ${pharmacy.name} (${pharmacyId})`);
console.log(`Admin: ${demoUsers[0].email} / ${demoUsers[0].password}`);
console.log(`Employee profile: ${demoUsers[1].email} / ${demoUsers[1].password}`);
