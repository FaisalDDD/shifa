import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import type { Profile, UserRole } from "@/types";

export type SessionUser = {
  id: string;
  email: string | null;
};

/** Returns the authenticated user or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? null };
}

/** Returns the caller's profile row (role, display name, ...) or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

/** Throws 401 if unauthenticated; returns the user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

/** Throws 401/403 unless the caller has one of the given roles. */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw Errors.unauthenticated();
  if (!roles.includes(profile.role)) throw Errors.forbidden();
  return profile;
}

/** Requires admin role. */
export async function requireAdmin(): Promise<Profile> {
  return requireRole("admin");
}

/**
 * Requires the caller to be an admin or a member of the given pharmacy.
 * Returns the caller's profile.
 */
export async function requirePharmacyMember(
  pharmacyId: string,
): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw Errors.unauthenticated();
  if (profile.role === "admin") return profile;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pharmacy_members")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!data) {
    // 404 (not 403) so we do not reveal whether the pharmacy exists.
    throw Errors.notFound("Pharmacy");
  }
  return profile;
}
