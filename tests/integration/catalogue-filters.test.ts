import { describe, expect, it } from "vitest";

import { catalogueQuerySchema } from "@/features/products/schemas/catalogue-query";
import { hasRealDatabase } from "@/tests/setup/env";
import { listProducts } from "@/server/services/products";
import {
  getCategoryBySlug,
  getCategoryFilterAttributes,
} from "@/server/services/categories";

const query = (input: Parameters<typeof catalogueQuerySchema.parse>[0]) =>
  catalogueQuerySchema.parse(input);

describe.skipIf(!hasRealDatabase)("totalCount", () => {
  it("reports the full match count, not the page size", async () => {
    const page = await listProducts(query({ limit: 5 }));

    expect(page.items.length).toBe(5);
    expect(page.totalCount).toBeGreaterThan(5);
  });

  it("stays consistent across pages of the same query", async () => {
    const first = await listProducts(query({ limit: 10, sort: "price_asc" }));
    const second = await listProducts(
      query({ cursor: first.nextCursor, limit: 10, sort: "price_asc" }),
    );

    expect(second.totalCount).toBe(first.totalCount);
  });

  it("matches the number of rows a full walk returns", async () => {
    const first = await listProducts(query({ inStockOnly: true, limit: 48 }));
    let cursor = first.nextCursor;
    let seen = first.items.length;
    let guard = 0;

    while (cursor && guard < 20) {
      const next = await listProducts(query({ cursor, inStockOnly: true, limit: 48 }));
      seen += next.items.length;
      cursor = next.nextCursor;
      guard += 1;
    }

    expect(seen).toBe(first.totalCount);
  });

  it("drops to zero when filters exclude everything (SRCH-03)", async () => {
    const page = await listProducts(query({ maxPrice: 1, minPrice: 0 }));

    expect(page.items).toStrictEqual([]);
    expect(page.totalCount).toBe(0);
  });

  it("narrows as filters are added (SRCH-11)", async () => {
    const all = await listProducts(query({ categorySlug: "electronics", limit: 48 }));
    const onSale = await listProducts(
      query({ categorySlug: "electronics", limit: 48, onSaleOnly: true }),
    );

    expect(onSale.totalCount).toBeLessThanOrEqual(all.totalCount);
    expect(all.totalCount).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasRealDatabase)("attribute filters", () => {
  async function smartphoneAttribute() {
    const category = await getCategoryBySlug("smartphones");
    const attributes = await getCategoryFilterAttributes(category?.id ?? "");

    return attributes.find((attribute) => attribute.options.length > 1) ?? null;
  }

  it("returns only products carrying the selected option", async () => {
    const attribute = await smartphoneAttribute();

    expect(attribute).not.toBeNull();

    const value = attribute?.options[0]?.value ?? "";
    const filtered = await listProducts(
      query({
        attributes: { [attribute?.slug ?? ""]: [value.toLowerCase()] },
        categorySlug: "smartphones",
        limit: 48,
      }),
    );
    const unfiltered = await listProducts(
      query({ categorySlug: "smartphones", limit: 48 }),
    );

    expect(filtered.totalCount).toBeLessThanOrEqual(unfiltered.totalCount);
    expect(filtered.items.length).toBe(filtered.totalCount);
  });

  it("matches option values case-insensitively", async () => {
    const attribute = await smartphoneAttribute();
    const value = attribute?.options[0]?.value ?? "";
    const slug = attribute?.slug ?? "";

    const lower = await listProducts(
      query({ attributes: { [slug]: [value.toLowerCase()] }, limit: 48 }),
    );
    const upper = await listProducts(
      query({ attributes: { [slug]: [value.toUpperCase()] }, limit: 48 }),
    );

    expect(upper.totalCount).toBe(lower.totalCount);
  });

  it("treats multiple values of one attribute as OR", async () => {
    const attribute = await smartphoneAttribute();
    const slug = attribute?.slug ?? "";
    const first = attribute?.options[0]?.value.toLowerCase() ?? "";
    const second = attribute?.options[1]?.value.toLowerCase() ?? "";

    const single = await listProducts(
      query({ attributes: { [slug]: [first] }, limit: 48 }),
    );
    const both = await listProducts(
      query({ attributes: { [slug]: [first, second] }, limit: 48 }),
    );

    expect(both.totalCount).toBeGreaterThanOrEqual(single.totalCount);
  });

  it("returns nothing for an unknown attribute slug rather than ignoring it", async () => {
    const page = await listProducts(
      query({ attributes: { "not-an-attribute": ["x"] }, limit: 48 }),
    );

    expect(page.totalCount).toBe(0);
  });

  it("treats attribute values as data, not SQL (SRCH-09)", async () => {
    const page = await listProducts(
      query({ attributes: { colour: ["'; drop table products; --"] }, limit: 10 }),
    );

    expect(page.totalCount).toBe(0);

    const survivors = await listProducts(query({ limit: 1 }));
    expect(survivors.items.length).toBe(1);
  });
});

describe.skipIf(!hasRealDatabase)("composed filters", () => {
  it("applies price, availability and sale together", async () => {
    const page = await listProducts(
      query({
        inStockOnly: true,
        limit: 48,
        maxPrice: 50_000_000,
        minPrice: 1_000_000,
        onSaleOnly: true,
      }),
    );

    for (const item of page.items) {
      expect(item.basePrice).toBeGreaterThanOrEqual(1_000_000);
      expect(item.basePrice).toBeLessThanOrEqual(50_000_000);
      expect(item.inStock).toBe(true);
      expect(item.comparePrice ?? 0).toBeGreaterThan(item.basePrice);
    }

    expect(page.items.length).toBe(page.totalCount);
  });
});

describe.skipIf(!hasRealDatabase)("price bounds (SRCH-07 regression)", () => {
  it("does not throw for a price above the column ceiling", async () => {
    const page = await listProducts(query({ limit: 24, minPrice: 10 ** 12 }));

    expect(page.totalCount).toBe(0);
    expect(page.items).toStrictEqual([]);
  });

  it("does not throw for an absurd range on both edges", async () => {
    const page = await listProducts(
      query({ limit: 24, maxPrice: 10 ** 15, minPrice: 10 ** 14 }),
    );

    expect(page.totalCount).toBe(0);
  });
});

describe.skipIf(!hasRealDatabase)("variant-option attributes", () => {
  it("matches products that have a variant carrying the value", async () => {
    const page = await listProducts(
      query({ attributes: { storage: ["256gb"] }, limit: 48 }),
    );

    expect(page.totalCount).toBeGreaterThan(0);
    expect(page.items.length).toBe(page.totalCount);
  });

  it("narrows further than the unfiltered category", async () => {
    const filtered = await listProducts(
      query({
        attributes: { storage: ["1tb"] },
        categorySlug: "smartphones",
        limit: 48,
      }),
    );
    const all = await listProducts(query({ categorySlug: "smartphones", limit: 48 }));

    expect(filtered.totalCount).toBeGreaterThan(0);
    expect(filtered.totalCount).toBeLessThan(all.totalCount);
  });

  it("treats multiple variant values as OR", async () => {
    const one = await listProducts(
      query({ attributes: { storage: ["256gb"] }, limit: 48 }),
    );
    const two = await listProducts(
      query({ attributes: { storage: ["256gb", "512gb"] }, limit: 48 }),
    );

    expect(two.totalCount).toBeGreaterThanOrEqual(one.totalCount);
  });

  it("still matches non-variant attributes stored as option rows", async () => {
    const page = await listProducts(
      query({ attributes: { colour: ["black"] }, limit: 48 }),
    );

    expect(page.totalCount).toBeGreaterThan(0);
  });

  it("combines a variant attribute with a price filter", async () => {
    const page = await listProducts(
      query({ attributes: { storage: ["256gb"] }, limit: 48, maxPrice: 100_000_000 }),
    );

    for (const item of page.items) {
      expect(item.basePrice).toBeLessThanOrEqual(100_000_000);
    }
  });
});
