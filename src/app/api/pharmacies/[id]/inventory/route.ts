import { getInventoryForPharmacy } from "@/services/inventory/catalog";
import { ok, handleError, errorResponse } from "@/lib/api";
import { getPharmacyByIdentifier } from "@/services/pharmacies/catalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const pharmacy = await getPharmacyByIdentifier(id);
    if (!pharmacy) {
      return errorResponse(404, "not_found", "Pharmacy was not found.");
    }
    const inventory = await getInventoryForPharmacy(pharmacy.id);
    return ok(inventory);
  } catch (err) {
    return handleError(err);
  }
}
