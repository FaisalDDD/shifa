import { createClient } from "@/lib/supabase/server";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const pharmacyId = (await params).id;
    const client = await createClient();
    const { data, error } = await client.from("pharmacy_delivery_settings_public")
      .select("*").eq("pharmacy_id", pharmacyId).maybeSingle();
    if (error) throw error;
    return ok(data);
  } catch (err) { return handleError(err); }
}
