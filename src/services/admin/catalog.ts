import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/services/audit";
import { Errors } from "@/lib/errors";
import type { Pharmacy, Product } from "@/types";

export interface AdminPharmacyInput {
  name: string;
  slug: string;
  description?: string | null;
  address: string;
  city?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website?: string | null;
  verification_status?: "pending" | "verified" | "rejected" | "suspended";
  is_active?: boolean;
}

export async function createPharmacy(
  input: AdminPharmacyInput,
  actorId: string,
): Promise<Pharmacy> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pharmacies")
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      address: input.address,
      city: input.city ?? null,
      postal_code: input.postal_code ?? null,
      country_code: input.country_code ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone ?? null,
      website: input.website || null,
      verification_status: input.verification_status ?? "pending",
      is_active: input.is_active ?? true,
      is_demo: false,
    })
    .select("*")
    .single();
  if (error) throw error;

  await recordAudit({
    actorUserId: actorId,
    action: "pharmacy.create",
    entityType: "pharmacy",
    entityId: data.id,
  });
  return data as Pharmacy;
}

export interface AdminPharmacyUpdateInput extends Partial<AdminPharmacyInput> {
  opening_hours?: Pharmacy["opening_hours"];
  services?: string[] | null;
}

export async function updatePharmacy(
  id: string,
  input: AdminPharmacyUpdateInput,
  actorId: string,
): Promise<Pharmacy> {
  const supabase = await createClient();

  // Verify existence before updating (avoid revealing existence via errors).
  const { data: existing } = await supabase
    .from("pharmacies")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw Errors.notFound("Pharmacy");

  const { data, error } = await supabase
    .from("pharmacies")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.postal_code !== undefined ? { postal_code: input.postal_code } : {}),
      ...(input.country_code !== undefined ? { country_code: input.country_code } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.website !== undefined ? { website: input.website || null } : {}),
      ...(input.verification_status !== undefined
        ? { verification_status: input.verification_status }
        : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.opening_hours !== undefined ? { opening_hours: input.opening_hours } : {}),
      ...(input.services !== undefined ? { services: input.services } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await recordAudit({
    actorUserId: actorId,
    action: "pharmacy.update",
    entityType: "pharmacy",
    entityId: id,
    metadata: { verification_status: input.verification_status, is_active: input.is_active },
  });
  return data as Pharmacy;
}

export interface AdminProductInput {
  canonical_name: string;
  brand_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  barcode?: string | null;
  product_identifier?: string | null;
  prescription_classification?: "otc" | "prescription" | "unknown";
  active_ingredients?: string[];
}

export async function createProduct(
  input: AdminProductInput,
  actorId: string,
): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      canonical_name: input.canonical_name,
      brand_name: input.brand_name ?? null,
      strength: input.strength ?? null,
      dosage_form: input.dosage_form ?? null,
      barcode: input.barcode ?? null,
      product_identifier: input.product_identifier ?? null,
      prescription_classification: input.prescription_classification ?? "unknown",
      is_demo: false,
    })
    .select("*")
    .single();
  if (error) throw error;

  const ingredients = input.active_ingredients ?? [];
  if (ingredients.length > 0) {
    const rows = ingredients.map((ingredient) => ({
      product_id: data.id,
      active_ingredient: ingredient,
    }));
    const { error: aiError } = await supabase
      .from("product_active_ingredients")
      .insert(rows);
    if (aiError) throw aiError;
  }

  await recordAudit({
    actorUserId: actorId,
    action: "product.create",
    entityType: "product",
    entityId: data.id,
  });

  return { ...(data as Product), active_ingredients: ingredients };
}
