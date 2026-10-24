import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildStockDisplay } from "@/services/inventory/stock";
import { kmToMeters } from "@/services/geo";
import { Errors } from "@/lib/errors";
import type {
  PharmacyInventory,
  PharmacyWithInventory,
  StockDisplay,
  AvailabilityStatus,
} from "@/types";

/** Choose the most favorable usable stock display (availability first, then freshness). */
export function pickBestStock(
  displays: (StockDisplay | null | undefined)[],
): StockDisplay | null {
  const usable = displays.filter(
    (d): d is StockDisplay => !!d && d.hasUsableData,
  );
  if (usable.length === 0) {
    const unknown = displays.find((d) => !!d);
    return unknown ?? null;
  }

  const rank = {
    AVAILABLE: 3,
    UNKNOWN: 1,
    OUT_OF_STOCK: 0,
  } as const;
  const freshnessRank = { recent: 3, older: 2, stale: 1, unknown: 0 } as const;

  return usable.sort((a, b) => {
    const byStatus = rank[b.availability] - rank[a.availability];
    if (byStatus !== 0) return byStatus;
    return freshnessRank[b.freshness] - freshnessRank[a.freshness];
  })[0];
}

export async function getInventoryForPharmacy(pharmacyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pharmacy_inventory")
    .select(
      "*, products:products(*)",
    )
    .eq("pharmacy_id", pharmacyId)
    .order("last_updated_at", { ascending: false });
  if (error) throw error;
  return data as unknown as Array<
    PharmacyInventory & { products: { id: string; canonical_name: string; brand_name: string | null; strength: string | null; dosage_form: string | null } }
  >;
}

/** Product detail page: nearby pharmacies and their stock for one product. */
export async function getProductAvailability(
  productId: string,
  location: { latitude: number; longitude: number; radiusKm: number },
): Promise<PharmacyWithInventory[]> {
  const supabase = await createClient();

  // Verify the product exists; throw 404 for unknown/invalid ids.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) throw Errors.notFound("Product");

  const radiusM = kmToMeters(location.radiusKm);

  const { data: nearby, error: geoError } = await supabase.rpc(
    "nearby_pharmacies",
    {
      search_lat: location.latitude,
      search_lng: location.longitude,
      radius_m: radiusM,
      include_demo: true,
      result_limit: 50,
    },
  );
  if (geoError) throw geoError;
  const pharmacies = (nearby ?? []) as PharmacyWithInventory[];

  const pharmacyIds = pharmacies.map((p) => p.id);
  const { data: inventory, error: invError } = await supabase
    .from("pharmacy_inventory")
    .select("*")
    .eq("product_id", productId)
    .in("pharmacy_id", pharmacyIds);
  if (invError) throw invError;

  const byPharmacy = new Map(
    ((inventory ?? []) as PharmacyInventory[]).map((r) => [r.pharmacy_id, r]),
  );

  return pharmacies.map((p) => {
    const inv = byPharmacy.get(p.id) ?? null;
    const stock = buildStockDisplay(
      inv?.availability_status,
      inv?.last_verified_at,
    );
    return { ...p, inventory: inv, stock };
  });
}

export interface UpsertInventoryInput {
  productId: string;
  availabilityStatus: AvailabilityStatus;
  quantity?: number | null;
  price?: number | null;
  currency?: string | null;
}

/**
 * Pharmacy staff update their own pharmacy's inventory. Caller authorization
 * (membership) is enforced by the API layer via requirePharmacyMember.
 */
export async function upsertInventory(
  pharmacyId: string,
  input: UpsertInventoryInput,
  actorId: string,
): Promise<PharmacyInventory> {
  const supabase = await createClient();

  // Verify the product exists (so staff cannot create inventory for a
  // non-existent product id).
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product) throw Errors.notFound("Product");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("pharmacy_inventory")
    .upsert(
      {
        pharmacy_id: pharmacyId,
        product_id: input.productId,
        availability_status: input.availabilityStatus,
        quantity: input.quantity ?? null,
        price: input.price ?? null,
        currency: input.currency ?? null,
        source: "PHARMACY_MANUAL",
        last_updated_at: now,
        last_verified_at: now,
        updated_by: actorId,
        expires_at: null,
      },
      { onConflict: "pharmacy_id,product_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as PharmacyInventory;
}
