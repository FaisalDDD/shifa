import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code
 * (migrations, seed scripts, admin bootstrap, audit logging) and never in
 * code reachable from the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
