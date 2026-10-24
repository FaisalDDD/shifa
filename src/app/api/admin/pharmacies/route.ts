import { requireAdmin } from "@/lib/auth/session";
import { createPharmacy } from "@/services/admin/catalog";
import { adminPharmacyCreateSchema } from "@/lib/validation/schemas";
import { created, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");

    const input = adminPharmacyCreateSchema.parse(body);
    const admin = await requireAdmin();

    const pharmacy = await createPharmacy(
      {
        name: input.name,
        slug: input.slug,
        description: input.description,
        address: input.address,
        city: input.city,
        postal_code: input.postal_code,
        country_code: input.country_code,
        latitude: input.latitude,
        longitude: input.longitude,
        phone: input.phone,
        website: input.website || null,
        verification_status: input.verification_status,
        is_active: input.is_active,
      },
      admin.id,
    );

    return created(pharmacy);
  } catch (err) {
    return handleError(err);
  }
}
