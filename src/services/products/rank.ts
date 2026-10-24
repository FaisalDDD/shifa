import type { Product } from "@/types";

/** Fold Arabic spelling variants + strip diacritics, mirroring the SQL
 * normalize_arabic() so the app-layer ranker and the DB ranker agree. */
export function normalizeArabic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و");
}

/** Lowercase, fold Arabic variants, trim and collapse runs of whitespace. */
export function normalizeQuery(q: string): string {
  return normalizeArabic(q).replace(/\s+/g, " ").trim();
}

export interface ProductFilters {
  strength?: string;
  dosageForm?: string;
}

export interface ScoredProduct {
  product: Product;
  score: number;
  reasons: string[];
  strengthExact: boolean;
  formExact: boolean;
}

/**
 * Explainable relevance scoring. Higher = better match. The `reasons` array
 * documents exactly why a result matched (for transparent ranking).
 */
export function scoreProductMatch(
  product: Product,
  query: string,
  filters: ProductFilters = {},
): ScoredProduct {
  const q = normalizeQuery(query);
  const name = normalizeQuery(product.canonical_name);
  const brand = product.brand_name ? normalizeQuery(product.brand_name) : "";
  const identifier = product.product_identifier
    ? normalizeQuery(product.product_identifier)
    : "";
  const ingredients = (product.active_ingredients ?? []).map(normalizeQuery);

  const exactName = name === q;
  const exactBrand = brand !== "" && brand === q;
  const exactIdentifier = identifier !== "" && identifier === q;
  const prefixName = !exactName && name.startsWith(q);
  const prefixBrand = !exactBrand && brand !== "" && brand.startsWith(q);
  const ingredientMatch = ingredients.some(
    (i) => i === q || i.startsWith(q) || i.includes(q),
  );

  const strengthExact =
    !filters.strength ||
    normalizeQuery(product.strength ?? "") === normalizeQuery(filters.strength);
  const formExact =
    !filters.dosageForm ||
    normalizeQuery(product.dosage_form ?? "") ===
      normalizeQuery(filters.dosageForm);

  let score = 0;
  const reasons: string[] = [];
  if (exactName) { score += 100; reasons.push("Exact name match"); }
  if (exactBrand) { score += 90; reasons.push("Exact brand match"); }
  if (exactIdentifier) { score += 85; reasons.push("Exact product identifier match"); }
  if (prefixName) { score += 70; reasons.push("Name prefix match"); }
  if (prefixBrand) { score += 65; reasons.push("Brand prefix match"); }
  if (ingredientMatch) { score += 55; reasons.push("Active ingredient match"); }
  if (strengthExact && filters.strength) { score += 10; reasons.push("Strength matches"); }
  if (formExact && filters.dosageForm) { score += 5; reasons.push("Dosage form matches"); }

  return { product, score, reasons, strengthExact, formExact };
}

/**
 * When a strength or dosage-form filter is supplied, only EXACT matches are
 * kept (never approximate) so we do not misrepresent a result as the
 * requested strength/formulation.
 */
export function filterExactStrengthForm(
  scored: ScoredProduct[],
  filters: ProductFilters,
): ScoredProduct[] {
  return scored.filter(
    (s) =>
      (!filters.strength || s.strengthExact) &&
      (!filters.dosageForm || s.formExact),
  );
}

/** Rank candidates by relevance (ties broken alphabetically for stability). */
export function rankProducts(
  products: Product[],
  query: string,
  filters: ProductFilters = {},
): ScoredProduct[] {
  const scored = products.map((p) => scoreProductMatch(p, query, filters));
  const exact = filterExactStrengthForm(scored, filters);
  return exact.sort(
    (a, b) =>
      b.score - a.score ||
      a.product.canonical_name.localeCompare(b.product.canonical_name),
  );
}
