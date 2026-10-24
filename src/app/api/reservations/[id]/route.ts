import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { ok, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    await requireUser();
    const supabase = await createClient();
    // RLS scopes this to the owner, the pharmacy, or admins.
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return errorResponse(404, "not_found", "Reservation was not found.");
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
