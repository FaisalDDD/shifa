import "server-only";
import { createClient } from "@/lib/supabase/server";
import { kmToMeters } from "@/services/geo";
import { isOpenNow } from "@/services/pharmacies/hours";
import { buildStockDisplay } from "@/services/inventory/stock";
import { includeDemoData } from "@/lib/demo";
import type {
  Pharmacy,
  PharmacyInventory,
  PharmacyWithInventory,
} from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fetch a pharmacy by slug or id (used for the public detail page). */
export async function getPharmacyByIdentifier(
  idOrSlug: string,
): Promise<Pharmacy | null> {
  const supabase = await createClient();
  const { data, error } = UUID_RE.test(idOrSlug)
    ? await supabase.from("pharmacies").select("*").eq("id", idOrSlug).maybeSingle()
    : await supabase.from("pharmacies").select("*").eq("slug", idOrSlug).maybeSingle();
  if (error) throw error;
  return (data as Pharmacy | null) ?? null;
}

export interface NearbyOptions {
  latitude: number;
  longitude: number;
  radiusKm: number;
  openNow?: boolean;
  productId?: string | null;
}

/**
 * Pharmacies near a location (PostGIS ST_DWithin), optionally enriched with
 * stock for a specific product and filtered by "open now".
 */
export async function nearbyPharmacies(
  options: NearbyOptions,
): Promise<PharmacyWithInventory[]> {
  const supabase = await createClient();
  const radiusM = kmToMeters(options.radiusKm);

  const { data, error } = await supabase.rpc("nearby_pharmacies", {
    search_lat: options.latitude,
    search_lng: options.longitude,
    radius_m: radiusM,
    include_demo: includeDemoData(),
    result_limit: 50,
  });
  if (error) throw error;

  let pharmacies = (data ?? []) as PharmacyWithInventory[];

  if (options.productId) {
    const ids = pharmacies.map((p) => p.id);
    const { data: inv } = await supabase
      .from("pharmacy_inventory_public")
      .select("*")
      .eq("product_id", options.productId)
      .in("pharmacy_id", ids);
    const byPharmacy = new Map(
      ((inv ?? []) as PharmacyInventory[]).map((r) => [r.pharmacy_id, r]),
    );
    pharmacies = pharmacies.map((p) => {
      const inventory = byPharmacy.get(p.id) ?? null;
      return {
        ...p,
        inventory,
        stock: buildStockDisplay(
          inventory?.availability_status,
          inventory?.last_verified_at,
        ),
      };
    });
  }

  if (options.openNow) {
    const now = new Date();
    pharmacies = pharmacies.filter((p) => isOpenNow(p.opening_hours, now) !== false);
  }

  return pharmacies;
}

export interface ListPharmaciesOptions {
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
  verifiedOnly?: boolean;
}

export async function listPharmacies(
  options: ListPharmaciesOptions = {},
): Promise<{ pharmacies: Pharmacy[]; total: number }> {
  const supabase = await createClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;

  let query = supabase.from("pharmacies").select("*", { count: "exact" });

  if (!includeDemoData()) query = query.eq("is_demo", false);
  if (options.activeOnly) query = query.eq("is_active", true);
  if (options.verifiedOnly) query = query.eq("verification_status", "verified");

  query = query
    .range((page - 1) * pageSize, page * pageSize - 1)
    .order("name", { ascending: true });

  const { data, error, count } = await query;
  if (error) throw error;
  return { pharmacies: (data as Pharmacy[]) ?? [], total: count ?? 0 };
}
