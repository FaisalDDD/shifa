import { deliveryAction } from "@/services/delivery/orders";
import { requireUser } from "@/lib/auth/session";
import { deliveryRejectSchema } from "@/lib/validation/schemas";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const input = deliveryRejectSchema.parse(await request.json().catch(() => ({})));
    return ok(await deliveryAction("reject_delivery_order", (await params).id, { p_note: input.note ?? null }));
  } catch (err) { return handleError(err); }
}
