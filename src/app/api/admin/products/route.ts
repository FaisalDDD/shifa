import { requireAdmin } from "@/lib/auth/session";
import { createProduct } from "@/services/admin/catalog";
import { productCreateSchema } from "@/lib/validation/schemas";
import { created, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");

    const input = productCreateSchema.parse(body);
    const admin = await requireAdmin();

    const product = await createProduct(
      {
        canonical_name: input.canonical_name,
        brand_name: input.brand_name,
        strength: input.strength,
        dosage_form: input.dosage_form,
        barcode: input.barcode,
        product_identifier: input.product_identifier,
        prescription_classification: input.prescription_classification,
        active_ingredients: input.active_ingredients,
      },
      admin.id,
    );

    return created(product);
  } catch (err) {
    return handleError(err);
  }
}
