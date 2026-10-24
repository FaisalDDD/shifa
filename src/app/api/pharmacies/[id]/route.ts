import { getPharmacyByIdentifier } from "@/services/pharmacies/catalog";
import { ok, handleError, errorResponse } from "@/lib/api";

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
    return ok(pharmacy);
  } catch (err) {
    return handleError(err);
  }
}
