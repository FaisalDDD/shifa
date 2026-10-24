import "server-only";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/errors";

/** No admin/staff shortcut: portal mutations require an explicit owner membership. */
export async function requirePortalOwner(pharmacyId: string) {
  const user = await requireUser();
  const client = await createClient();
  const { data, error } = await client.from("pharmacy_members")
    .select("membership_role")
    .eq("pharmacy_id", pharmacyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data?.membership_role !== "owner") throw Errors.notFound("Pharmacy");
  return { user, client };
}

/** UI capability hint only. Every mutation independently rechecks ownership. */
export async function getPortalOwnerIds(userId: string): Promise<string[]> {
  const client = await createClient();
  const { data, error } = await client.from("pharmacy_members")
    .select("pharmacy_id")
    .eq("user_id", userId)
    .eq("membership_role", "owner");
  if (error) throw error;
  return (data ?? []).map((row) => row.pharmacy_id);
}
