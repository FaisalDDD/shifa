import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Subscribe the caller to a back-in-stock notification for this product.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await requireRole("customer", "admin");
    const { id } = await params;
    const admin = createAdminClient();

    const { error } = await admin.from("saved_searches").upsert(
      {
        user_id: profile.id,
        product_id: id,
        normalized_query: id,
        notification_enabled: true,
      },
      { onConflict: "user_id,product_id" },
    );
    if (error) throw error;

    return ok({ notified: true });
  } catch (err) {
    return handleError(err);
  }
}
