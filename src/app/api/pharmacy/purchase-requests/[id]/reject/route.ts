import { requireRole } from "@/lib/auth/session";
import { transitionPurchaseRequest } from "@/services/purchases/service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const profile = await requireRole("pharmacy_staff", "admin");
    const purchaseRequest = await transitionPurchaseRequest(profile, id, "reject");
    return ok(purchaseRequest);
  } catch (err) {
    return handleError(err);
  }
}
