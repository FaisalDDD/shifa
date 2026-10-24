import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { getUserPharmacies } from "@/services/pharmacies/register";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardContent } from "@/components/dashboard/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/dashboard");

  const pharmacies =
    profile.role === "admin" ? [] : await getUserPharmacies(profile.id);

  const admin = createAdminClient();
  const { data: notifications } = await admin
    .from("notifications")
    .select("id, title, body, read_at, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <DashboardContent
      profile={{
        email: profile.email ?? null,
        display_name: profile.display_name ?? null,
        role: profile.role,
      }}
      pharmacies={pharmacies}
      notifications={(notifications ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        read_at: n.read_at,
        created_at: n.created_at,
      }))}
    />
  );
}
