import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePharmacyMember } from "@/lib/auth/session";
import { ok, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Toggle a pharmacy's "available" status (pharmacy staff or admin only). */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body.pharmacy_id !== "string" ||
      typeof body.is_available !== "boolean"
    ) {
      return errorResponse(400, "bad_request", "Invalid request body.");
    }

    // Authorizes the caller against this pharmacy (throws 401/404).
    await requirePharmacyMember(body.pharmacy_id);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pharmacies")
      .update({ is_available: body.is_available })
      .eq("id", body.pharmacy_id)
      .select("*")
      .single();
    if (error) throw error;

    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
