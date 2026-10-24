// Securely promote the first administrator.
//
// Procedure (see docs/setup.md):
//   1. Set ADMIN_BOOTSTRAP_TOKEN to a strong random secret in the environment.
//   2. Create the admin's account via normal sign-up in the app.
//   3. Run:  npm run create-admin -- --email=admin@example.com --token=<secret>
//
// The token must match ADMIN_BOOTSTRAP_TOKEN. This script uses the service-role
// key and therefore runs server-side only — never expose these to the browser.

import { createClient } from "@supabase/supabase-js";

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load your env first.",
  );
  process.exit(1);
}
if (!expectedToken) {
  console.error(
    "ADMIN_BOOTSTRAP_TOKEN is not set. Set it to a strong random secret before running this script.",
  );
  process.exit(1);
}

const email = arg("email");
const token = arg("token");

if (!email || !token) {
  console.error("Usage: npm run create-admin -- --email=admin@example.com --token=<bootstrap token>");
  process.exit(1);
}
if (token !== expectedToken) {
  console.error("Invalid bootstrap token. The token must match ADMIN_BOOTSTRAP_TOKEN.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const {
  data: { users },
  error: listError,
} = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Could not list users:", listError.message);
  process.exit(1);
}

const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No user found with email "${email}". Sign up first, then re-run this script.`);
  process.exit(1);
}

const { error: upsertError } = await supabase.from("profiles").upsert({
  id: user.id,
  email: user.email,
  display_name: user.user_metadata?.display_name ?? null,
  role: "admin",
});
if (upsertError) {
  console.error("Failed to promote user:", upsertError.message);
  process.exit(1);
}

console.log(`✓ Promoted ${user.email} to administrator.`);
