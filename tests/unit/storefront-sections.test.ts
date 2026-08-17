import { describe, expect, it } from "vitest";

import {
  campaignContentSchema,
  collectionRulesSchema,
  sectionLayoutConfigSchema,
  SECTION_DEFAULT_ITEMS,
  SECTION_MAX_ITEMS,
} from "@/features/storefront/schemas/section-config";
import {
  buildCollectionQuery,
  buildSectionQuery,
  resolveSectionItemLimit,
  type StorefrontSection,
} from "@/server/services/storefront";

function section(overrides: Partial<StorefrontSection> = {}): StorefrontSection {
  return {
    brandSlug: null,
    campaign: null,
    categorySlug: null,
    collectionId: null,
    collectionRules: null,
    collectionType: null,
    desktopConfig: {},
    id: "00000000-0000-4000-8000-000000000001",
    mobileConfig: {},
    slug: "test-section",
    sortOrder: 0,
    sourceKind: "trending",
    sourceRef: null,
    title: "Test section",
    type: "product_rail",
    viewMoreHref: null,
    ...overrides,
  };
}

describe("sectionLayoutConfigSchema", () => {
  it("degrades malformed stored JSON to a default instead of throwing", () => {
    expect(sectionLayoutConfigSchema.parse(null)).toStrictEqual({});
    expect(sectionLayoutConfigSchema.parse("nonsense")).toStrictEqual({});
    expect(sectionLayoutConfigSchema.parse({ columns: "many" })).toStrictEqual({});
    expect(sectionLayoutConfigSchema.parse({ itemLimit: 999 })).toStrictEqual({});
  });

  it("keeps values inside the allowed range", () => {
    expect(
      sectionLayoutConfigSchema.parse({ columns: 4, itemLimit: 12 }),
    ).toStrictEqual({
      columns: 4,
      itemLimit: 12,
    });
  });
});

describe("collectionRulesSchema", () => {
  it("accepts only the supported filter vocabulary", () => {
    const parsed = collectionRulesSchema.parse({
      inStockOnly: true,
      maxPrice: 10_000_000,
      sort: "price_asc",
    });

    expect(parsed).toStrictEqual({
      inStockOnly: true,
      maxPrice: 10_000_000,
      sort: "price_asc",
    });
  });

  it("discards rules it cannot compile rather than passing them through", () => {
    expect(collectionRulesSchema.parse({ sort: "cheapest" })).toStrictEqual({});
    expect(collectionRulesSchema.parse({ maxPrice: -1 })).toStrictEqual({});
    expect(
      collectionRulesSchema.parse({ rawSql: "1=1; drop table products" }),
    ).toStrictEqual({});
  });
});

describe("campaignContentSchema", () => {
  it("bounds admin-authored copy", () => {
    expect(campaignContentSchema.parse({ body: "x".repeat(241) })).toStrictEqual({});
    expect(campaignContentSchema.parse({ body: "Free delivery" })).toStrictEqual({
      body: "Free delivery",
    });
  });

  it("degrades a malformed content column to an empty object", () => {
    expect(campaignContentSchema.parse(42)).toStrictEqual({});
  });
});

describe("resolveSectionItemLimit", () => {
  it("falls back to the default when nothing is configured", () => {
    expect(resolveSectionItemLimit(section())).toBe(SECTION_DEFAULT_ITEMS);
  });

  it("prefers the desktop limit, then the mobile one", () => {
    expect(resolveSectionItemLimit(section({ desktopConfig: { itemLimit: 8 } }))).toBe(
      8,
    );
    expect(resolveSectionItemLimit(section({ mobileConfig: { itemLimit: 6 } }))).toBe(
      6,
    );
  });

  it("clamps to the maximum so a section cannot render unbounded items", () => {
    const oversized = section({ desktopConfig: { itemLimit: SECTION_MAX_ITEMS } });

    expect(resolveSectionItemLimit(oversized)).toBeLessThanOrEqual(SECTION_MAX_ITEMS);
  });
});

describe("buildSectionQuery", () => {
  it("maps trending, best sellers and recommended to popularity ordering", () => {
    for (const sourceKind of ["trending", "best_sellers", "recommended"] as const) {
      expect(buildSectionQuery(section({ sourceKind }))?.sort).toBe("popularity");
    }
  });

  it("maps new arrivals to newest ordering", () => {
    expect(buildSectionQuery(section({ sourceKind: "new_arrivals" }))?.sort).toBe(
      "newest",
    );
  });

  it("maps offers to a sale-only query", () => {
    expect(buildSectionQuery(section({ sourceKind: "offers" }))?.onSaleOnly).toBe(true);
  });

  it("scopes a category section to its bound category", () => {
    const query = buildSectionQuery(
      section({ categorySlug: "smartphones", sourceKind: "category" }),
    );

    expect(query?.categorySlug).toBe("smartphones");
  });

  it("falls back to sourceRef when no category is bound", () => {
    const query = buildSectionQuery(
      section({ sourceKind: "category", sourceRef: "furniture" }),
    );

    expect(query?.categorySlug).toBe("furniture");
  });

  it("returns null for a category section with nothing to scope to", () => {
    expect(buildSectionQuery(section({ sourceKind: "category" }))).toBeNull();
  });

  it("returns null for source kinds it cannot express as a catalogue query", () => {
    expect(buildSectionQuery(section({ sourceKind: "manual" }))).toBeNull();
    expect(buildSectionQuery(section({ sourceKind: "collection" }))).toBeNull();
  });

  it("always bounds the query", () => {
    const query = buildSectionQuery(section({ sourceKind: "trending" }));

    expect(query?.limit).toBeLessThanOrEqual(SECTION_MAX_ITEMS);
  });
});

describe("buildCollectionQuery", () => {
  it("returns null for a manual collection, which uses explicit membership", () => {
    expect(buildCollectionQuery(section({ collectionType: "manual" }))).toBeNull();
    expect(buildCollectionQuery(section({ collectionType: null }))).toBeNull();
  });

  it("compiles dynamic rules into a bounded catalogue query", () => {
    const query = buildCollectionQuery(
      section({
        collectionRules: { inStockOnly: true, maxPrice: 10_000_000, sort: "price_asc" },
        collectionType: "dynamic",
      }),
    );

    expect(query).toStrictEqual({
      inStockOnly: true,
      limit: SECTION_DEFAULT_ITEMS,
      maxPrice: 10_000_000,
      sort: "price_asc",
    });
  });

  it("ignores rule keys that are not part of the compiled vocabulary (SEC-11)", () => {
    const query = buildCollectionQuery(
      section({
        collectionRules: { maxPrice: 5_000, sql: "drop table products" },
        collectionType: "dynamic",
      }),
    );

    expect(query).not.toHaveProperty("sql");
    expect(query?.maxPrice).toBe(5_000);
  });

  it("defaults to popularity when the rules omit a sort", () => {
    const query = buildCollectionQuery(
      section({ collectionRules: {}, collectionType: "dynamic" }),
    );

    expect(query?.sort).toBe("popularity");
  });

  it("survives a null or corrupt rules column", () => {
    expect(
      buildCollectionQuery(
        section({ collectionRules: null, collectionType: "dynamic" }),
      )?.sort,
    ).toBe("popularity");
    expect(
      buildCollectionQuery(
        section({ collectionRules: "garbage", collectionType: "dynamic" }),
      )?.sort,
    ).toBe("popularity");
  });
});
