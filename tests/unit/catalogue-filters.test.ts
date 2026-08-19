import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  buildCatalogueSearchParams,
  EMPTY_FILTER_STATE,
  hasActiveFilters,
  parseCatalogueFilters,
  toggleValue,
  type CatalogueFilterState,
} from "@/features/filters/catalogue-url";
import { toMinorUnits } from "@/lib/money";

function parse(query: string) {
  return parseCatalogueFilters(new URLSearchParams(query));
}

function state(overrides: Partial<CatalogueFilterState> = {}): CatalogueFilterState {
  return { ...EMPTY_FILTER_STATE, ...overrides };
}

describe("parseCatalogueFilters", () => {
  it("returns empty defaults for an empty query", () => {
    expect(parse("")).toStrictEqual(EMPTY_FILTER_STATE);
  });

  it("reads prices as naira and stores them as kobo (DATA-01)", () => {
    const filters = parse("minPrice=50000&maxPrice=400000");

    expect(filters.minPrice).toBe(toMinorUnits(50_000));
    expect(filters.maxPrice).toBe(toMinorUnits(400_000));
  });

  it("drops malformed values instead of throwing (SRCH-04)", () => {
    const filters = parse("minPrice=abc&maxPrice=-5&rating=nine&sort=cheapest");

    expect(filters.minPrice).toBeNull();
    expect(filters.maxPrice).toBeNull();
    expect(filters.minRating).toBeNull();
    expect(filters.sort).toBe(EMPTY_FILTER_STATE.sort);
  });

  it("swaps an inverted price range (SRCH-06)", () => {
    const filters = parse("minPrice=400000&maxPrice=50000");

    expect(filters.minPrice).toBe(toMinorUnits(50_000));
    expect(filters.maxPrice).toBe(toMinorUnits(400_000));
  });

  it("rejects an out-of-range rating", () => {
    expect(parse("rating=0").minRating).toBeNull();
    expect(parse("rating=6").minRating).toBeNull();
    expect(parse("rating=4").minRating).toBe(4);
  });

  it("accepts comma-separated and repeated brand params, deduped and sorted", () => {
    expect(parse("brand=ikea,adidas&brand=ikea").brandSlugs).toStrictEqual([
      "adidas",
      "ikea",
    ]);
  });

  it("bounds the number of brand filters", () => {
    const many = Array.from({ length: 40 }, (_, i) => `brand-${i}`).join(",");

    expect(parse(`brand=${many}`).brandSlugs.length).toBeLessThanOrEqual(20);
  });

  it("parses attribute filters from prefixed params", () => {
    const filters = parse("attr.storage=256gb,512gb&attr.colour=black");

    expect(filters.attributes).toStrictEqual({
      colour: ["black"],
      storage: ["256gb", "512gb"],
    });
  });

  it("ignores an attribute param with no usable values", () => {
    expect(parse("attr.storage=").attributes).toStrictEqual({});
    expect(parse("attr.=256gb").attributes).toStrictEqual({});
  });

  it("bounds attribute values per attribute", () => {
    const many = Array.from({ length: 40 }, (_, i) => `v${i}`).join(",");

    expect(
      parse(`attr.storage=${many}`).attributes.storage?.length,
    ).toBeLessThanOrEqual(20);
  });

  it("treats flags as explicit opt-in only", () => {
    expect(parse("inStock=1").inStockOnly).toBe(true);
    expect(parse("inStock=true").inStockOnly).toBe(true);
    expect(parse("inStock=0").inStockOnly).toBe(false);
    expect(parse("inStock=maybe").inStockOnly).toBe(false);
  });

  it("lowercases values so casing cannot fragment the filter set", () => {
    expect(parse("brand=IKEA&attr.Colour=BLACK").brandSlugs).toStrictEqual(["ikea"]);
    expect(parse("attr.Colour=BLACK").attributes).toStrictEqual({ colour: ["black"] });
  });
});

describe("buildCatalogueSearchParams", () => {
  it("omits everything for an empty state, keeping the canonical URL clean", () => {
    expect(buildCatalogueSearchParams(EMPTY_FILTER_STATE).toString()).toBe("");
  });

  it("writes prices back as naira", () => {
    const params = buildCatalogueSearchParams(
      state({ maxPrice: toMinorUnits(400_000), minPrice: toMinorUnits(50_000) }),
    );

    expect(params.get("minPrice")).toBe("50000");
    expect(params.get("maxPrice")).toBe("400000");
  });

  it("round-trips a full filter state (SRCH-12)", () => {
    const original = state({
      attributes: { colour: ["black"], storage: ["256gb", "512gb"] },
      brandSlugs: ["adidas", "ikea"],
      inStockOnly: true,
      maxPrice: toMinorUnits(400_000),
      minPrice: toMinorUnits(50_000),
      minRating: 4,
      onSaleOnly: true,
      sort: "price_asc",
    });

    const roundTripped = parseCatalogueFilters(buildCatalogueSearchParams(original));

    expect(roundTripped).toStrictEqual(original);
  });

  it("produces a stable string regardless of input ordering", () => {
    const a = buildCatalogueSearchParams(
      state({
        attributes: { storage: ["512gb", "256gb"] },
        brandSlugs: ["ikea", "adidas"],
      }),
    ).toString();
    const b = buildCatalogueSearchParams(
      state({
        attributes: { storage: ["256gb", "512gb"] },
        brandSlugs: ["adidas", "ikea"],
      }),
    ).toString();

    expect(a).toBe(b);
  });

  it("omits the default sort so the clean URL stays canonical", () => {
    expect(buildCatalogueSearchParams(state({ sort: "popularity" })).has("sort")).toBe(
      false,
    );
    expect(buildCatalogueSearchParams(state({ sort: "newest" })).get("sort")).toBe(
      "newest",
    );
  });
});

describe("activeFilterCount", () => {
  it("counts nothing for a clean state", () => {
    expect(activeFilterCount(EMPTY_FILTER_STATE)).toBe(0);
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false);
  });

  it("counts a price range as one filter regardless of which edge is set", () => {
    expect(activeFilterCount(state({ minPrice: 100 }))).toBe(1);
    expect(activeFilterCount(state({ maxPrice: 100, minPrice: 100 }))).toBe(1);
  });

  it("counts each brand and attribute value", () => {
    const count = activeFilterCount(
      state({
        attributes: { storage: ["256gb", "512gb"] },
        brandSlugs: ["ikea"],
        minRating: 4,
      }),
    );

    expect(count).toBe(4);
  });

  it("ignores sort, which is not a filter", () => {
    expect(activeFilterCount(state({ sort: "price_desc" }))).toBe(0);
  });
});

describe("toggleValue", () => {
  it("adds a value that is absent and removes one that is present", () => {
    expect(toggleValue([], "a")).toStrictEqual(["a"]);
    expect(toggleValue(["a", "b"], "a")).toStrictEqual(["b"]);
  });
});
