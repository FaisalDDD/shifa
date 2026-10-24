import { deliveryAction } from "@/services/delivery/orders";
import { requireUser } from "@/lib/auth/session";
import { deliveryReceiptSchema } from "@/lib/validation/schemas";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const input = deliveryReceiptSchema.parse(await request.json().catch(() => null));
    return ok(await deliveryAction("submit_delivery_payment_receipt", (await params).id, { p_note: input.note }));
  } catch (err) { return handleError(err); }
}
