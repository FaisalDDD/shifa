import { requireRole } from "@/lib/auth/session";
import { transitionReservation } from "@/services/reservations/service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const profile = await requireRole("customer", "pharmacy_staff", "admin");
    const { reservation } = await transitionReservation(profile, id, "cancel");
    return ok(reservation);
  } catch (err) {
    return handleError(err);
  }
}
