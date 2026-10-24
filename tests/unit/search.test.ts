import { describe, it, expect } from "vitest";
import {
  rankProducts,
  normalizeQuery,
  filterExactStrengthForm,
  scoreProductMatch,
} from "@/services/products/rank";
import type { Product } from "@/types";

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    canonical_name: "Paracetamol",
    brand_name: "Panadol",
    strength: "500 mg",
    dosage_form: "tablet",
    barcode: "5000157000001",
    product_identifier: "DEMO-PARA-500",
    prescription_classification: "otc",
    is_demo: true,
    active_ingredients: ["paracetamol"],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeQuery", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeQuery("  ParaCETAMOL  500 ")).toBe("paracetamol 500");
  });
});

describe("product ranking", () => {
  it("ranks exact name matches first", () => {
    const products = [
      makeProduct({ id: "a", canonical_name: "Paracetamol Extra" }),
      makeProduct({ id: "b", canonical_name: "Paracetamol" }),
      makeProduct({ id: "c", canonical_name: "Ibuprofen" }),
    ];
    const ranked = rankProducts(products, "Paracetamol");
    expect(ranked[0].product.id).toBe("b");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("matches by brand name", () => {
    const products = [
      makeProduct({ id: "a", canonical_name: "Acetaminophen", brand_name: "Tylenol" }),
      makeProduct({ id: "b", canonical_name: "Paracetamol", brand_name: "Panadol" }),
    ];
    const ranked = rankProducts(products, "Tylenol");
    expect(ranked[0].product.id).toBe("a");
  });

  it("prefix-matches (typo/partial query)", () => {
    const products = [makeProduct({ id: "a", canonical_name: "Paracetamol" })];
    const ranked = rankProducts(products, "paracet");
    expect(ranked[0].product.id).toBe("a");
    expect(ranked[0].reasons).toContain("Name prefix match");
  });

  it("matches by active ingredient", () => {
    const products = [
      makeProduct({
        id: "a",
        canonical_name: "Cold & Flu Relief",
        active_ingredients: ["paracetamol", "phenylephrine"],
      }),
    ];
    const ranked = rankProducts(products, "paracetamol");
    expect(ranked[0].product.id).toBe("a");
    expect(ranked[0].reasons).toContain("Active ingredient match");
  });

  it("scores a non-matching product as zero", () => {
    const s = scoreProductMatch(makeProduct({}), "zzzzzz");
    expect(s.score).toBe(0);
  });

  it("filters out non-exact strength matches when a strength filter is set", () => {
    const products = [
      makeProduct({ id: "a", strength: "500 mg" }),
      makeProduct({ id: "b", strength: "200 mg" }),
    ];
    const filtered = filterExactStrengthForm(
      products.map((p) => scoreProductMatch(p, "paracetamol", { strength: "500 mg" })),
      { strength: "500 mg" },
    );
    expect(filtered.map((s) => s.product.id)).toEqual(["a"]);
  });

  it("filters out non-exact dosage form matches", () => {
    const products = [
      makeProduct({ id: "a", dosage_form: "tablet" }),
      makeProduct({ id: "b", dosage_form: "syrup" }),
    ];
    const filtered = filterExactStrengthForm(
      products.map((p) => scoreProductMatch(p, "paracetamol", { dosageForm: "tablet" })),
      { dosageForm: "tablet" },
    );
    expect(filtered.map((s) => s.product.id)).toEqual(["a"]);
  });
});
