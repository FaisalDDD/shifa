import { getProduct } from "@/services/products/catalog";
import { ok, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const product = await getProduct(id);
    if (!product) return errorResponse(404, "not_found", "Product was not found.");
    return ok(product);
  } catch (err) {
    return handleError(err);
  }
}
