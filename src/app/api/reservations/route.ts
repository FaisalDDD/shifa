import { requireRole } from "@/lib/auth/session";
import { createReservation, listReservationsForUser } from "@/services/reservations/service";
import { reservationCreateSchema } from "@/lib/validation/schemas";
import { created, ok, handleError, errorResponse } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await requireRole("customer", "pharmacy_staff", "admin");
    const reservations = await listReservationsForUser(profile);
    return ok(reservations);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const rl = rateLimit(
      rateLimitKey("reservation", clientIp(request)),
      RATE_LIMITS.reservation,
    );
    if (!rl.allowed) {
      return errorResponse(429, "rate_limited", "Too many requests. Please try again shortly.");
    }

    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");

    const input = reservationCreateSchema.parse(body);
    const profile = await requireRole("customer", "admin");

    const reservation = await createReservation(profile, {
      pharmacyId: input.pharmacy_id,
      productId: input.product_id,
      quantity: input.quantity,
      requestNotes: input.request_notes,
    });

    return created(reservation);
  } catch (err) {
    return handleError(err);
  }
}
