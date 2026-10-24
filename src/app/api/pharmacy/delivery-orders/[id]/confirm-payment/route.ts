import { deliveryAction } from "@/services/delivery/orders";
import { requireUser } from "@/lib/auth/session";
import { deliveryPaymentConfirmationSchema } from "@/lib/validation/schemas";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const input = deliveryPaymentConfirmationSchema.parse(await request.json().catch(() => null));
    return ok(await deliveryAction("confirm_delivery_payment", (await params).id, { p_reference: input.reference }));
  } catch (err) { return handleError(err); }
}
