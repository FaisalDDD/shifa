import { requirePortalOwner } from "@/services/pharmacy-portal/ownership";
import { getDeliverySettings, updateDeliverySettings } from "@/services/delivery/settings";
import { deliverySettingsSchema } from "@/lib/validation/schemas";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const pharmacyId = new URL(request.url).searchParams.get("pharmacy_id") ?? "";
    await requirePortalOwner(pharmacyId);
    return ok(await getDeliverySettings(pharmacyId));
  } catch (err) { return handleError(err); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const pharmacyId = typeof body?.pharmacy_id === "string" ? body.pharmacy_id : "";
    const { user } = await requirePortalOwner(pharmacyId);
    const input = deliverySettingsSchema.parse(body);
    return ok(await updateDeliverySettings(user.id, pharmacyId, input));
  } catch (err) { return handleError(err); }
}
