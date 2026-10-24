import "server-only";
import { handleError, ok } from "@/lib/api";
import { recordAudit } from "@/services/audit";
import { requirePortalOwner } from "@/services/pharmacy-portal/ownership";
import { portalProfileSchema } from "@/services/pharmacy-portal/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const input = portalProfileSchema.parse(await request.json().catch(() => null));
    const { user, client } = await requirePortalOwner(input.pharmacy_id);
    // User-session/RLS write, never a service-role pharmacy update.
    const { data, error } = await client.from("pharmacies")
      .update(input.changes).eq("id", input.pharmacy_id).select("*").single();
    if (error) throw error;
    await recordAudit({ actorUserId: user.id, action: "pharmacy.portal.profile.update",
      entityType: "pharmacy", entityId: input.pharmacy_id,
      metadata: { fields: Object.keys(input.changes) } });
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}
