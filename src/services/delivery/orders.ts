import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export interface DeliveryOrderItemInput {
  product_id: string;
  quantity: number;
}

export async function listDeliveryOrders(profile: Profile) {
  const client = await createClient();
  const query = client.from("delivery_orders")
    .select("*, delivery_order_items(*)")
    .order("created_at", { ascending: false });
  if (profile.role === "customer") query.eq("customer_id", profile.id);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createDeliveryOrder(input: {
  pharmacy_id: string;
  delivery_address: string;
  contact_phone: string;
  notes?: string | null;
  items: DeliveryOrderItemInput[];
}) {
  const client = await createClient();
  const { data, error } = await client.rpc("create_delivery_order", {
    p_pharmacy_id: input.pharmacy_id,
    p_delivery_address: input.delivery_address,
    p_contact_phone: input.contact_phone,
    p_notes: input.notes ?? null,
    p_items: input.items,
  });
  if (error) throw error;
  return data;
}

export async function deliveryAction(
  action: "accept_delivery_order" | "reject_delivery_order" | "cancel_delivery_order" | "submit_delivery_payment_receipt" | "confirm_delivery_payment" | "deliver_delivery_order",
  orderId: string,
  payload: Record<string, unknown> = {},
) {
  const client = await createClient();
  const args = { p_order_id: orderId, ...payload };
  const { data, error } = await client.rpc(action, args);
  if (error) throw error;
  return data;
}
