import { describe, expect, it } from "vitest";

import {
  catalogueQuerySchema,
  decodeCursor,
  encodeCursor,
  CATALOGUE_MAX_PAGE_SIZE,
  CATALOGUE_PAGE_SIZE,
} from "@/features/products/schemas/catalogue-query";
import { canonicaliseCatalogueQuery } from "@/server/cache/catalogue";

describe("catalogueQuerySchema", () => {
  it("applies defaults", () => {
    const parsed = catalogueQuerySchema.parse({});

    expect(parsed.limit).toBe(CATALOGUE_PAGE_SIZE);
    expect(parsed.sort).toBe("newest");
  });

  it("rejects a limit above the page-size cap (SRCH: unbounded result sets)", () => {
    expect(
      catalogueQuerySchema.safeParse({ limit: CATALOGUE_MAX_PAGE_SIZE + 1 }).success,
    ).toBe(false);
    expect(catalogueQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it("rejects malformed filter values rather than coercing them (SRCH-04)", () => {
    expect(catalogueQuerySchema.safeParse({ minPrice: "abc" }).success).toBe(false);
    expect(catalogueQuerySchema.safeParse({ minPrice: -1 }).success).toBe(false);
    expect(catalogueQuerySchema.safeParse({ minRating: 9 }).success).toBe(false);
    expect(catalogueQuerySchema.safeParse({ sort: "cheapest" }).success).toBe(false);
  });

  it("caps the search term server-side (SRCH-10)", () => {
    expect(catalogueQuerySchema.safeParse({ search: "a".repeat(121) }).success).toBe(
      false,
    );
    expect(catalogueQuerySchema.safeParse({ search: "a".repeat(120) }).success).toBe(
      true,
    );
  });

  it("bounds the number of brand filters", () => {
    const tooMany = Array.from({ length: 21 }, (_, index) => `brand-${index}`);

    expect(catalogueQuerySchema.safeParse({ brandSlugs: tooMany }).success).toBe(false);
  });
});

describe("cursor encoding", () => {
  it("round-trips numeric and string cursor values", () => {
    const numeric = { id: "1a3d9f2b-0000-4000-8000-000000000001", value: 125_000 };
    const temporal = {
      id: "1a3d9f2b-0000-4000-8000-000000000002",
      value: "2026-01-01T00:00:00.000Z",
    };

    expect(decodeCursor(encodeCursor(numeric))).toStrictEqual(numeric);
    expect(decodeCursor(encodeCursor(temporal))).toStrictEqual(temporal);
  });

  it("returns null for a forged or malformed cursor (SRCH-08)", () => {
    expect(decodeCursor("not-base64")).toBeNull();
    expect(decodeCursor(Buffer.from("{}", "utf8").toString("base64url"))).toBeNull();
    expect(
      decodeCursor(Buffer.from('{"id":"nope","value":1}').toString("base64url")),
    ).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("rejects a cursor whose id is not a uuid, so it cannot become a scan", () => {
    const forged = Buffer.from(
      JSON.stringify({ id: "' or 1=1 --", value: 0 }),
      "utf8",
    ).toString("base64url");

    expect(decodeCursor(forged)).toBeNull();
  });
});

describe("canonicaliseCatalogueQuery", () => {
  function keyOf(query: Parameters<typeof canonicaliseCatalogueQuery>[0]) {
    return JSON.stringify(canonicaliseCatalogueQuery(query));
  }

  it("produces a stable key regardless of property order", () => {
    const a = catalogueQuerySchema.parse({ limit: 12, sort: "popularity" });
    const b = catalogueQuerySchema.parse({ sort: "popularity", limit: 12 });

    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("collapses brand order and duplicates", () => {
    const a = catalogueQuerySchema.parse({ brandSlugs: ["ikea", "adidas", "ikea"] });
    const b = catalogueQuerySchema.parse({ brandSlugs: ["adidas", "ikea"] });

    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("collapses search casing, which the query treats case-insensitively", () => {
    const a = catalogueQuerySchema.parse({ search: "Galaxy" });
    const b = catalogueQuerySchema.parse({ search: "galaxy" });

    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("drops false booleans, which emit no predicate", () => {
    const a = catalogueQuerySchema.parse({ inStockOnly: false, onSaleOnly: false });
    const b = catalogueQuerySchema.parse({});

    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("preserves minRating 0, which is not equivalent to absent", () => {
    const withZero = canonicaliseCatalogueQuery(
      catalogueQuerySchema.parse({ minRating: 0 }),
    );
    const without = canonicaliseCatalogueQuery(catalogueQuerySchema.parse({}));

    expect(withZero.minRating).toBe(0);
    expect(without.minRating).toBeUndefined();
    expect(keyOf(catalogueQuerySchema.parse({ minRating: 0 }))).not.toBe(
      keyOf(without),
    );
  });

  it("keeps genuinely different queries on different keys", () => {
    const trending = catalogueQuerySchema.parse({ limit: 12, sort: "popularity" });
    const newest = catalogueQuerySchema.parse({ limit: 12, sort: "newest" });
    const offers = catalogueQuerySchema.parse({
      limit: 12,
      onSaleOnly: true,
      sort: "popularity",
    });

    expect(new Set([keyOf(trending), keyOf(newest), keyOf(offers)]).size).toBe(3);
  });

  it("gives trending and recommended sections the same cache entry", () => {
    const trending = catalogueQuerySchema.parse({ limit: 12, sort: "popularity" });
    const recommended = catalogueQuerySchema.parse({ limit: 12, sort: "popularity" });

    expect(keyOf(trending)).toBe(keyOf(recommended));
  });
});

describe("attribute filters in the cache key", () => {
  function keyOf(query: Parameters<typeof canonicaliseCatalogueQuery>[0]) {
    return JSON.stringify(canonicaliseCatalogueQuery(query));
  }

  it("keeps different attribute selections on different cache entries", () => {
    const storage256 = catalogueQuerySchema.parse({
      attributes: { storage: ["256gb"] },
    });
    const storage512 = catalogueQuerySchema.parse({
      attributes: { storage: ["512gb"] },
    });

    expect(keyOf(storage256)).not.toBe(keyOf(storage512));
  });

  it("keeps a filtered query distinct from an unfiltered one", () => {
    const filtered = catalogueQuerySchema.parse({ attributes: { colour: ["black"] } });
    const plain = catalogueQuerySchema.parse({});

    expect(keyOf(filtered)).not.toBe(keyOf(plain));
  });

  it("collapses attribute value order and casing", () => {
    const a = catalogueQuerySchema.parse({
      attributes: { storage: ["512GB", "256gb"] },
    });
    const b = catalogueQuerySchema.parse({
      attributes: { storage: ["256gb", "512gb"] },
    });

    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("collapses attribute key order", () => {
    const a = catalogueQuerySchema.parse({
      attributes: { colour: ["black"], storage: ["256gb"] },
    });
    const b = catalogueQuerySchema.parse({
      attributes: { storage: ["256gb"], colour: ["black"] },
    });

    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("distinguishes the same value under different attributes", () => {
    const a = catalogueQuerySchema.parse({ attributes: { colour: ["black"] } });
    const b = catalogueQuerySchema.parse({ attributes: { finish: ["black"] } });

    expect(keyOf(a)).not.toBe(keyOf(b));
  });
});
