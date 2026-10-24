import { listPharmacies } from "@/services/pharmacies/catalog";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const page = Number(sp.get("page") ?? "1");
    const pageSize = Number(sp.get("page_size") ?? "20");
    const { pharmacies, total } = await listPharmacies({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 50) : 20,
      activeOnly: sp.get("active") === "true",
      verifiedOnly: sp.get("verified") === "true",
    });
    return ok(pharmacies, {
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (err) {
    return handleError(err);
  }
}
