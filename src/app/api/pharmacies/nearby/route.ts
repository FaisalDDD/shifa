import { nearbyPharmacies } from "@/services/pharmacies/catalog";
import { ok, handleError, errorResponse } from "@/lib/api";
import { nearbyPharmaciesSchema } from "@/lib/validation/schemas";
import { isValidCoordinate } from "@/services/geo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = nearbyPharmaciesSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!isValidCoordinate(params.latitude, params.longitude)) {
      return errorResponse(422, "validation", "Invalid coordinates.");
    }

    const pharmacies = await nearbyPharmacies({
      latitude: params.latitude,
      longitude: params.longitude,
      radiusKm: params.radius ?? 10,
      openNow: params.open_now,
      productId: params.product_id,
    });

    return ok(pharmacies);
  } catch (err) {
    return handleError(err);
  }
}
