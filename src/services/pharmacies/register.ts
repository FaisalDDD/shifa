import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/services/audit";
import type { Pharmacy } from "@/types";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "pharmacy";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

export interface RegisterPharmacyInput {
  name: string;
  address: string;
  city?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
}

/**
 * Self-serve pharmacy registration. Creates a *pending* (unverified) pharmacy
 * via the user's own session (so RLS applies), then adds the user as owner and
 * promotes their role to pharmacy_staff via the service role.
 */
export async function registerPharmacy(
  userId: string,
  input: RegisterPharmacyInput,
): Promise<Pharmacy> {
  const supabase = await createClient();

  // Insert the pharmacy through the caller's session — RLS restricts this to
  // authenticated users creating a PENDING, non-demo listing.
  const { data, error } = await supabase
    .from("pharmacies")
    .insert({
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
      address: input.address,
      city: input.city ?? null,
      postal_code: input.postal_code ?? null,
      country_code: input.country_code ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone ?? null,
      website: input.website || null,
      verification_status: "pending",
      is_active: true,
      is_demo: false,
    })
    .select("*")
    .single();
  if (error) throw error;

  const pharmacy = data as Pharmacy;

  // The owner membership row is created automatically by the
  // pharmacies_assign_owner trigger. Role promotion (admin-only table) still
  // happens via the service role.
  const admin = createAdminClient();

  const { error: roleErr } = await admin
    .from("profiles")
    .update({ role: "pharmacy_staff" })
    .eq("id", userId);
  if (roleErr) throw roleErr;

  await recordAudit({
    actorUserId: userId,
    action: "pharmacy.register",
    entityType: "pharmacy",
    entityId: pharmacy.id,
  });

  return pharmacy;
}

/** The pharmacies a user is a member of (for dashboard / supplier scoping). */
export async function getUserPharmacies(userId: string): Promise<Pharmacy[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("pharmacy_members")
    .select("pharmacy_id, pharmacies:pharmacies(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (memberships ?? [])
    .map((m) => m.pharmacies)
    .filter(Boolean) as unknown as Pharmacy[];
}
