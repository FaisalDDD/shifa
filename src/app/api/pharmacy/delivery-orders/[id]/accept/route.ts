import { deliveryAction } from "@/services/delivery/orders";
import { requireUser } from "@/lib/auth/session";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    return ok(await deliveryAction("accept_delivery_order", (await params).id));
  }
  catch (err) { return handleError(err); }
}
