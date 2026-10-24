import { requireUser } from "@/lib/auth/session";
import { registerPharmacy } from "@/services/pharmacies/register";
import { pharmacyRegisterSchema } from "@/lib/validation/schemas";
import { created, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");

    const input = pharmacyRegisterSchema.parse(body);
    const user = await requireUser();

    const pharmacy = await registerPharmacy(user.id, {
      name: input.name,
      address: input.address,
      city: input.city,
      postal_code: input.postal_code,
      country_code: input.country_code,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone,
      website: input.website,
      description: input.description,
    });

    return created(pharmacy);
  } catch (err) {
    return handleError(err);
  }
}
