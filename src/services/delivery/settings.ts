import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/services/audit";

export async function getDeliverySettings(pharmacyId: string) {
  const client = await createClient();
  const { data, error } = await client.from("pharmacy_delivery_settings").select("*").eq("pharmacy_id", pharmacyId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDeliverySettings(userId: string, pharmacyId: string, input: Record<string, unknown>) {
  const client = await createClient();
  const { data, error } = await client.from("pharmacy_delivery_settings")
    .upsert({ pharmacy_id: pharmacyId, ...input, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "pharmacy_id" })
    .select("*").single();
  if (error) throw error;
  await recordAudit({ actorUserId: userId, action: "pharmacy.delivery_settings.update", entityType: "pharmacy", entityId: pharmacyId, metadata: { enabled: input.enabled, delivery_fee: input.delivery_fee } });
  return data;
}
