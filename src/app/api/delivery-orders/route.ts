import { requireRole, getCurrentProfile } from "@/lib/auth/session";
import { createDeliveryOrder, listDeliveryOrders } from "@/services/delivery/orders";
import { deliveryOrderCreateSchema } from "@/lib/validation/schemas";
import { created, handleError, ok, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return errorResponse(401, "unauthenticated", "Sign in to view delivery orders.");
    return ok(await listDeliveryOrders(profile));
  } catch (err) { return handleError(err); }
}

export async function POST(request: Request) {
  try {
    await requireRole("customer");
    const input = deliveryOrderCreateSchema.parse(await request.json().catch(() => null));
    return created(await createDeliveryOrder(input));
  } catch (err) { return handleError(err); }
}
