import { requireRole } from "@/lib/auth/session";
import { getUserPharmacies } from "@/services/pharmacies/register";
import { searchProducts } from "@/services/products/catalog";
import { productSearchSchema } from "@/lib/validation/schemas";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Supplier search for pharmacy users: find products carried by OTHER
 * pharmacies (the buyer's own pharmacies are excluded).
 */
export async function GET(request: Request) {
  try {
    const profile = await requireRole("pharmacy_staff", "admin");
    const params = productSearchSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    const myPharmacies = await getUserPharmacies(profile.id);
    const myIds = myPharmacies.map((p) => p.id);

    const { hits } = await searchProducts({
      q: params.q ?? "",
      strength: params.strength,
      dosageForm: params.dosage_form,
      latitude: params.latitude,
      longitude: params.longitude,
      radiusKm: params.radius,
      sort: params.sort,
      page: params.page,
      pageSize: params.page_size,
      excludePharmacyIds: myIds,
    });

    return ok(hits, { total: hits.length });
  } catch (err) {
    return handleError(err);
  }
}
