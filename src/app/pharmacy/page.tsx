import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { getUserPharmacies } from "@/services/pharmacies/register";
import { getPortalOwnerIds } from "@/services/pharmacy-portal/ownership";
import { getProRelease } from "@/services/pharmacy-portal/pro-release";
import { PharmacyDashboard } from "@/components/pharmacy/pharmacy-dashboard";

export const dynamic = "force-dynamic";

export default async function PharmacyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/pharmacy");

  const [pharmacies, ownerPharmacyIds, release] = await Promise.all([
    getUserPharmacies(profile.id),
    getPortalOwnerIds(profile.id),
    getProRelease(),
  ]);

  return <PharmacyDashboard pharmacies={pharmacies} ownerPharmacyIds={ownerPharmacyIds} release={release} />;
}
