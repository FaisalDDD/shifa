import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rankProducts, normalizeQuery, type ProductFilters } from "./rank";
import { buildStockDisplay } from "@/services/inventory/stock";
import { pickBestStock } from "@/services/inventory/catalog";
import { kmToMeters } from "@/services/geo";
import { includeDemoData } from "@/lib/demo";
import type {
  Product,
  ProductSearchHit,
  PharmacyInventory,
  PharmacyWithInventory,
  SortOption,
} from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProduct(id: string): Promise<Product | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const product = data as Product;
  const { data: ingredients } = await supabase
    .from("product_active_ingredients")
    .select("active_ingredient")
    .eq("product_id", id);
  product.active_ingredients = (ingredients ?? []).map(
    (r: { active_ingredient: string }) => r.active_ingredient,
  );
  return product;
}

export async function listProducts(options: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{ products: Product[]; total: number }> {
  const supabase = await createClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;

  let query = supabase.from("products").select("*", { count: "exact" });
  if (!includeDemoData()) query = query.eq("is_demo", false);
  query = query
    .range((page - 1) * pageSize, page * pageSize - 1)
    .order("canonical_name", { ascending: true });

  const { data, error, count } = await query;
  if (error) throw error;
  return { products: (data as Product[]) ?? [], total: count ?? 0 };
}

export interface SearchProductsOptions {
  q: string;
  strength?: string;
  dosageForm?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  /** Exclude these pharmacies from availability results (e.g. the buyer's own). */
  excludePharmacyIds?: string[];
}

export async function searchProducts(
  options: SearchProductsOptions,
): Promise<{ hits: ProductSearchHit[]; total: number }> {
  const supabase = await createClient();
  const term = normalizeQuery(options.q);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;

  if (term === "") {
    return { hits: [], total: 0 };
  }

  const { data, error } = await supabase.rpc("search_products", {
    search_term: term,
    include_demo: includeDemoData(),
    result_limit: 100,
  });
  if (error) throw error;

  const candidates = (data ?? []) as (Product & { base_score: number })[];

  const filters: ProductFilters = {
    strength: options.strength,
    dosageForm: options.dosageForm,
  };
  const ranked = rankProducts(
    candidates.map((c) => c as Product),
    term,
    filters,
  );

  // Enrich with availability from nearby pharmacies.
  const enriched = await enrichAvailability(
    ranked.map((r) => r.product),
    options,
  );

  // Global, location-independent pharmacy counts for the "N pharmacies have this" label.
  const counts = await getGlobalPharmacyCounts(ranked.map((r) => r.product.id));

  const hits: ProductSearchHit[] = ranked.map((r) => {
    const pharmacies = enriched.get(r.product.id) ?? [];
    const stockDisplays = pharmacies
      .map((p) => p.stock)
      .filter((s): s is NonNullable<typeof s> => !!s);
    const best = pickBestStock(stockDisplays);
    const nearest =
      pharmacies
        .map((p) => p.distance_m)
        .filter((d): d is number => d != null)
        .sort((a, b) => a - b)[0] ?? null;

    return {
      product: r.product,
      pharmacies,
      best,
      nearest_distance_m: nearest,
      pharmacy_count: counts.get(r.product.id) ?? 0,
      score: r.score,
    };
  });

  const sorted = sortHits(hits, options.sort ?? "relevance");

  const start = (page - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);
  return { hits: paged, total: sorted.length };
}

function sortHits(hits: ProductSearchHit[], sort: SortOption): ProductSearchHit[] {
  const freshnessRank = { recent: 3, older: 2, stale: 1, unknown: 0 } as const;
  const copy = [...hits];
  switch (sort) {
    case "distance":
      return copy.sort(
        (a, b) =>
          (a.nearest_distance_m ?? Infinity) - (b.nearest_distance_m ?? Infinity),
      );
    case "freshness":
      return copy.sort(
        (a, b) =>
          (freshnessRank[b.best?.freshness ?? "unknown"] ?? 0) -
          (freshnessRank[a.best?.freshness ?? "unknown"] ?? 0),
      );
    default:
      return copy.sort(
        (a, b) =>
          b.score - a.score ||
          (a.nearest_distance_m ?? Infinity) - (b.nearest_distance_m ?? Infinity),
      );
  }
}

async function enrichAvailability(
  products: Product[],
  options: {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    excludePharmacyIds?: string[];
  },
): Promise<Map<string, PharmacyWithInventory[]>> {
  const supabase = await createClient();
  const result = new Map<string, PharmacyWithInventory[]>();
  if (!products.length) return result;

  const productIds = products.map((p) => p.id);

  if (
    options.latitude == null ||
    options.longitude == null ||
    options.radiusKm == null
  ) {
    // No location: return empty pharmacy lists (callers prompt for a location).
    for (const id of productIds) result.set(id, []);
    return result;
  }

  const { data: nearby, error: geoError } = await supabase.rpc(
    "nearby_pharmacies",
    {
      search_lat: options.latitude,
      search_lng: options.longitude,
      radius_m: kmToMeters(options.radiusKm),
      include_demo: includeDemoData(),
      result_limit: 50,
    },
  );
  if (geoError) throw geoError;
  const exclude = options.excludePharmacyIds ?? [];
  const pharmacies = ((nearby ?? []) as PharmacyWithInventory[]).filter(
    (p) => !exclude.includes(p.id),
  );
  const pharmacyIds = pharmacies.map((p) => p.id);

  const { data: inventory } = await supabase
    .from("pharmacy_inventory_public")
    .select("*")
    .in("product_id", productIds)
    .in("pharmacy_id", pharmacyIds);
  const rows = (inventory ?? []) as PharmacyInventory[];

  const key = (pharmacyId: string, productId: string) =>
    `${pharmacyId}:${productId}`;
  const byKey = new Map(rows.map((r) => [key(r.pharmacy_id, r.product_id), r]));

  for (const productId of productIds) {
    const list: PharmacyWithInventory[] = pharmacies
      .filter((p) => byKey.has(key(p.id, productId)))
      .map((p) => {
        const inv = byKey.get(key(p.id, productId)) ?? null;
        return {
          ...p,
          inventory: inv,
          stock: buildStockDisplay(inv?.availability_status, inv?.last_verified_at),
        };
      });
    result.set(productId, list);
  }
  return result;
}

/** Count distinct pharmacies reporting each product as available, globally. */
async function getGlobalPharmacyCounts(
  productIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!productIds.length) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pharmacy_inventory_public")
    .select("product_id, pharmacy_id")
    .in("product_id", productIds)
    .in("availability_status", ["AVAILABLE", "LOW_STOCK"]);
  if (error) throw error;

  const sets = new Map<string, Set<string>>();
  for (const row of (data ?? []) as { product_id: string; pharmacy_id: string }[]) {
    if (!sets.has(row.product_id)) sets.set(row.product_id, new Set());
    sets.get(row.product_id)!.add(row.pharmacy_id);
  }
  for (const [pid, s] of sets) result.set(pid, s.size);
  return result;
}
