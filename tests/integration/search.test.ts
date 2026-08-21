import { describe, expect, it } from "vitest";

import { hasRealDatabase } from "@/tests/setup/env";
import { hasSuggestions, searchSuggestions } from "@/server/services/search";

describe.skipIf(!hasRealDatabase)("searchSuggestions", () => {
  it("finds products by a partial name", async () => {
    const result = await searchSuggestions("galaxy");

    expect(result.products.length).toBeGreaterThan(0);
    expect(
      result.products.every((product) => product.name.toLowerCase().includes("galaxy")),
    ).toBe(true);
  });

  it("is case-insensitive", async () => {
    const lower = await searchSuggestions("galaxy");
    const upper = await searchSuggestions("GALAXY");

    expect(upper.products.map((p) => p.id).sort()).toStrictEqual(
      lower.products.map((p) => p.id).sort(),
    );
  });

  it("matches categories and brands, not only products", async () => {
    const result = await searchSuggestions("phone");

    expect(hasSuggestions(result)).toBe(true);
  });

  it("returns nothing for a term that matches nothing", async () => {
    const result = await searchSuggestions("zzzznotathing");

    expect(hasSuggestions(result)).toBe(false);
  });

  it("treats a LIKE wildcard as a literal, not a match-all (SRCH-09)", async () => {
    const wildcard = await searchSuggestions("%");

    for (const product of wildcard.products) {
      expect(product.name).toContain("%");
    }

    const underscore = await searchSuggestions("_");

    for (const product of underscore.products) {
      expect(product.name).toContain("_");
    }
  });

  it("does not let a wildcard match everything the way an unescaped LIKE would", async () => {
    const wildcard = await searchSuggestions("%");
    const broad = await searchSuggestions("a");

    expect(wildcard.products.length).toBeLessThan(broad.products.length);
  });

  it("treats SQL metacharacters as data", async () => {
    const result = await searchSuggestions("'; drop table products; --");

    expect(hasSuggestions(result)).toBe(false);

    const survivors = await searchSuggestions("galaxy");
    expect(survivors.products.length).toBeGreaterThan(0);
  });

  it("bounds each suggestion group", async () => {
    const result = await searchSuggestions("a");

    expect(result.products.length).toBeLessThanOrEqual(6);
    expect(result.categories.length).toBeLessThanOrEqual(4);
    expect(result.brands.length).toBeLessThanOrEqual(4);
  });

  it("returns only active products", async () => {
    const result = await searchSuggestions("a");

    for (const product of result.products) {
      expect(product.slug.length).toBeGreaterThan(0);
      expect(Number.isInteger(product.basePrice)).toBe(true);
    }
  });

  it("normalises the echoed term", async () => {
    const result = await searchSuggestions("  galaxy   s24  ");

    expect(result.term).toBe("galaxy s24");
  });
});
