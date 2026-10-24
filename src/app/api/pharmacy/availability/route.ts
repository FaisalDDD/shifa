import "server-only";
import { ok, handleError } from "@/lib/api";
import { requirePortalOwner } from "@/services/pharmacy-portal/ownership";
import { portalAvailabilitySchema } from "@/services/pharmacy-portal/validation";
import { recordAudit } from "@/services/audit";

export const dynamic = "force-dynamic";

/** Retained endpoint; listing availability requires explicit owner membership. */
export async function POST(request: Request) {
  try {
    const input = portalAvailabilitySchema.parse(await request.json().catch(() => null));
    const { user, client } = await requirePortalOwner(input.pharmacy_id);
    const { data, error } = await client.from("pharmacies")
      .update({ is_available: input.is_available })
      .eq("id", input.pharmacy_id).select("*").single();
    if (error) throw error;
    await recordAudit({ actorUserId: user.id, action: "pharmacy.portal.availability.update",
      entityType: "pharmacy", entityId: input.pharmacy_id,
      metadata: { is_available: input.is_available } });
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
