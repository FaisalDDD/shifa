import { requireAdmin } from "@/lib/auth/session";
import { updatePharmacy } from "@/services/admin/catalog";
import { adminPharmacyUpdateSchema } from "@/lib/validation/schemas";
import { ok, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");

    const input = adminPharmacyUpdateSchema.parse(body);
    const admin = await requireAdmin();

    const pharmacy = await updatePharmacy(id, input, admin.id);
    return ok(pharmacy);
  } catch (err) {
    return handleError(err);
  }
}
