import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePharmacyMember } from "@/lib/auth/session";
import { inventoryUpsertSchema } from "@/lib/validation/schemas";
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

    const input = inventoryUpsertSchema.parse(body);

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("pharmacy_inventory")
      .select("pharmacy_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      return errorResponse(404, "not_found", "Inventory record was not found.");
    }

    // Authorize against the owning pharmacy (throws 401/404 if not allowed).
    const profile = await requirePharmacyMember(existing.pharmacy_id);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("pharmacy_inventory")
      .update({
        availability_status: input.availability_status,
        quantity: input.quantity ?? null,
        price: input.price ?? null,
        currency: input.currency ?? null,
        source: "PHARMACY_MANUAL",
        last_updated_at: now,
        last_verified_at: now,
        updated_by: profile.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
