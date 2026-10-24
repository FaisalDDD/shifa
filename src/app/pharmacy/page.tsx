import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { getUserPharmacies } from "@/services/pharmacies/register";
import { PharmacyDashboard } from "@/components/pharmacy/pharmacy-dashboard";

export const dynamic = "force-dynamic";

export default async function PharmacyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/pharmacy");

  const pharmacies = await getUserPharmacies(profile.id);

  return <PharmacyDashboard pharmacies={pharmacies} />;
}
