import { listProducts } from "@/services/products/catalog";
import { ok, handleError } from "@/lib/api";
import { productSearchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = productSearchSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 20;
    const { products, total } = await listProducts({ page, pageSize });
    return ok(products, { total, page, pageSize, hasMore: page * pageSize < total });
  } catch (err) {
    return handleError(err);
  }
}
