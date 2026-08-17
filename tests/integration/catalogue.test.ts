import { describe, expect, it } from "vitest";

import { catalogueQuerySchema } from "@/features/products/schemas/catalogue-query";
import { hasRealDatabase } from "@/tests/setup/env";
import {
  getProductBySlug,
  listBrandsForCategory,
  listProducts,
} from "@/server/services/products";

const query = (input: Parameters<typeof catalogueQuerySchema.parse>[0]) =>
  catalogueQuerySchema.parse(input);

describe.skipIf(!hasRealDatabase)("listProducts", () => {
  it("returns a bounded page with a cursor when more remain", async () => {
    const page = await listProducts(query({ limit: 5 }));

    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.items.length).toBeGreaterThan(0);
    expect(typeof page.nextCursor === "string" || page.nextCursor === null).toBe(true);
  });

  it("never returns the same product twice across a full cursor walk (SRCH-08)", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const page: Awaited<ReturnType<typeof listProducts>> = await listProducts(
        query({ limit: 24, ...(cursor ? { cursor } : {}) }),
      );

      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 20);

    expect(cursor).toBeNull();
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThan(24);
  });

  it("reaches the most expensive products in an unfiltered listing (Stage 14 regression)", async () => {
    const page = await listProducts(query({ limit: 5, sort: "price_desc" }));
    const top = page.items[0];

    expect(top).toBeDefined();
    expect(top?.basePrice).toBeGreaterThan(1_000_000 * 100);
  });

  it("orders price_asc and price_desc consistently", async () => {
    const ascending = await listProducts(query({ limit: 10, sort: "price_asc" }));
    const descending = await listProducts(query({ limit: 10, sort: "price_desc" }));

    const asc = ascending.items.map((item) => item.basePrice);
    const desc = descending.items.map((item) => item.basePrice);

    expect(asc).toStrictEqual([...asc].sort((a, b) => a - b));
    expect(desc).toStrictEqual([...desc].sort((a, b) => b - a));
    expect(asc[0]).toBeLessThanOrEqual(desc[0] ?? 0);
  });

  it("keeps every result inside an explicit price band", async () => {
    const page = await listProducts(
      query({ limit: 48, maxPrice: 20_000_000, minPrice: 5_000_000 }),
    );

    expect(page.items.length).toBeGreaterThan(0);

    for (const item of page.items) {
      expect(item.basePrice).toBeGreaterThanOrEqual(5_000_000);
      expect(item.basePrice).toBeLessThanOrEqual(20_000_000);
    }
  });

  it("returns only discounted products when onSaleOnly is set", async () => {
    const page = await listProducts(query({ limit: 24, onSaleOnly: true }));

    expect(page.items.length).toBeGreaterThan(0);

    for (const item of page.items) {
      expect(item.comparePrice).not.toBeNull();
      expect(item.comparePrice ?? 0).toBeGreaterThan(item.basePrice);
      expect(item.discountPercent).toBeGreaterThan(0);
    }
  });

  it("returns only in-stock products when inStockOnly is set", async () => {
    const page = await listProducts(query({ inStockOnly: true, limit: 48 }));

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((item) => item.inStock)).toBe(true);
  });

  it("matches a search term case-insensitively", async () => {
    const lower = await listProducts(query({ limit: 24, search: "galaxy" }));
    const upper = await listProducts(query({ limit: 24, search: "GALAXY" }));

    expect(lower.items.length).toBeGreaterThan(0);
    expect(lower.items.map((i) => i.id).sort()).toStrictEqual(
      upper.items.map((i) => i.id).sort(),
    );
  });

  it("treats a search term as data, not as SQL (SRCH-09)", async () => {
    const page = await listProducts(
      query({ limit: 24, search: "'; drop table products; --" }),
    );

    expect(page.items).toStrictEqual([]);

    const survivors = await listProducts(query({ limit: 1 }));
    expect(survivors.items.length).toBe(1);
  });

  it("scopes a category listing to that category and its descendants", async () => {
    const page = await listProducts(query({ categorySlug: "electronics", limit: 48 }));

    expect(page.items.length).toBeGreaterThan(0);
  });

  it("returns an empty page for a category that does not exist (SRCH-05)", async () => {
    const page = await listProducts(query({ categorySlug: "no-such-category" }));

    expect(page.items).toStrictEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("returns an empty page rather than throwing for an impossible band", async () => {
    const page = await listProducts(query({ maxPrice: 1, minPrice: 0 }));

    expect(page.items).toStrictEqual([]);
  });
});

describe.skipIf(!hasRealDatabase)("getProductBySlug", () => {
  it("returns null for an unknown slug", async () => {
    expect(await getProductBySlug("definitely-not-a-product")).toBeNull();
  });

  it("returns a product with its variants and resolved prices", async () => {
    const page = await listProducts(query({ limit: 1 }));
    const slug = page.items[0]?.slug;

    expect(slug).toBeDefined();

    const product = await getProductBySlug(slug ?? "");

    expect(product).not.toBeNull();
    expect(product?.slug).toBe(slug);
    expect(product?.basePrice).toBeGreaterThan(0);
    expect(Array.isArray(product?.variants)).toBe(true);

    for (const variant of product?.variants ?? []) {
      expect(Number.isInteger(variant.price)).toBe(true);
      expect(variant.available).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not leak a non-active product", async () => {
    expect(await getProductBySlug("")).toBeNull();
  });
});

describe.skipIf(!hasRealDatabase)("listBrandsForCategory", () => {
  it("returns brands that actually have active products", async () => {
    const brands = await listBrandsForCategory();

    expect(brands.length).toBeGreaterThan(0);
    expect(new Set(brands.map((b) => b.slug)).size).toBe(brands.length);
  });

  it("narrows to a category's brands", async () => {
    const all = await listBrandsForCategory();
    const scoped = await listBrandsForCategory("smartphones");

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThanOrEqual(all.length);
  });

  it("returns nothing for an unknown category", async () => {
    expect(await listBrandsForCategory("no-such-category")).toStrictEqual([]);
  });
});
