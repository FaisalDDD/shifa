import { requirePharmacyMember } from "@/lib/auth/session";
import { upsertInventory } from "@/services/inventory/catalog";
import { pharmacyInventoryUpsertSchema } from "@/lib/validation/schemas";
import { created, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");

    const input = pharmacyInventoryUpsertSchema.parse(body);

    // Authorize: admin or member of the target pharmacy. Throws 401/404.
    const profile = await requirePharmacyMember(input.pharmacy_id);

    const inventory = await upsertInventory(
      input.pharmacy_id,
      {
        productId: input.product_id,
        availabilityStatus: input.availability_status,
        quantity: input.quantity,
        price: input.price,
        currency: input.currency,
      },
      profile.id,
    );

    return created(inventory);
  } catch (err) {
    return handleError(err);
  }
}
