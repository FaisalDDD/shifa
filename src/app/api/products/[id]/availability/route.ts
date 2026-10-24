import { getProductAvailability } from "@/services/inventory/catalog";
import { ok, handleError } from "@/lib/api";
import { nearbyPharmaciesSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const params = nearbyPharmaciesSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    // Validate the product exists.
    const pharmacies = await getProductAvailability(id, {
      latitude: params.latitude,
      longitude: params.longitude,
      radiusKm: params.radius ?? 10,
    });
    return ok(pharmacies);
  } catch (err) {
    return handleError(err);
  }
}
