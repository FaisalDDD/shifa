import { requireRole } from "@/lib/auth/session";
import {
  createPurchaseRequest,
  listPurchaseRequests,
} from "@/services/purchases/service";
import { purchaseRequestCreateSchema } from "@/lib/validation/schemas";
import { created, ok, handleError, errorResponse } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  pharmacy_id: z.string().uuid(),
  direction: z.enum(["incoming", "outgoing"]).default("incoming"),
});

export async function GET(request: Request) {
  try {
    const profile = await requireRole("pharmacy_staff", "admin");
    const params = listQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const requests = await listPurchaseRequests(
      profile,
      params.pharmacy_id,
      params.direction,
    );
    return ok(requests);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");

    const input = purchaseRequestCreateSchema.parse(body);
    const profile = await requireRole("pharmacy_staff", "admin");

    const purchaseRequest = await createPurchaseRequest(profile, {
      buyerPharmacyId: input.buyer_pharmacy_id,
      sellerPharmacyId: input.seller_pharmacy_id,
      productId: input.product_id,
      quantity: input.quantity,
      notes: input.notes,
    });

    return created(purchaseRequest);
  } catch (err) {
    return handleError(err);
  }
}
