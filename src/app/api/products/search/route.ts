import { searchProducts } from "@/services/products/catalog";
import { ok, handleError, errorResponse } from "@/lib/api";
import { productSearchSchema } from "@/lib/validation/schemas";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const rl = rateLimit(
      rateLimitKey("search", clientIp(request)),
      RATE_LIMITS.search,
    );
    if (!rl.allowed) {
      return errorResponse(
        429,
        "rate_limited",
        "Too many requests. Please try again shortly.",
      );
    }

    const params = productSearchSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    const { hits, total } = await searchProducts({
      q: params.q ?? "",
      strength: params.strength,
      dosageForm: params.dosage_form,
      latitude: params.latitude,
      longitude: params.longitude,
      radiusKm: params.radius,
      sort: params.sort,
      page: params.page,
      pageSize: params.page_size,
    });

    return ok(hits, {
      total,
      page: params.page,
      pageSize: params.page_size,
      hasMore: params.page * params.page_size < total,
    });
  } catch (err) {
    return handleError(err);
  }
}
