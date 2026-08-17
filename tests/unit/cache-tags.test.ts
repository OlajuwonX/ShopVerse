import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: (tag: string, profile: string) => revalidateTag(tag, profile),
  unstable_cache: (fn: unknown) => fn,
}));

const { cacheTags } = await import("@/server/cache/tags");
const {
  revalidateCategory,
  revalidateCollection,
  revalidateProduct,
  revalidateProductPricing,
  revalidateStorefrontSections,
} = await import("@/server/cache/revalidate");

function purgedTags() {
  return new Set(revalidateTag.mock.calls.map((call) => call[0] as string));
}

beforeEach(() => {
  revalidateTag.mockReset();
});

describe("cacheTags", () => {
  it("namespaces entity tags so they cannot collide", () => {
    expect(cacheTags.product("abc")).toBe("product:abc");
    expect(cacheTags.category("abc")).toBe("category:abc");
    expect(cacheTags.productSlug("abc")).toBe("product-slug:abc");
    expect(cacheTags.categorySlug("abc")).toBe("category-slug:abc");
    expect(cacheTags.collection("abc")).toBe("collection:abc");
  });

  it("keeps an id tag distinct from a slug tag for the same value", () => {
    expect(cacheTags.product("x")).not.toBe(cacheTags.productSlug("x"));
    expect(cacheTags.category("x")).not.toBe(cacheTags.categorySlug("x"));
  });

  it("exposes stable collection-wide tags", () => {
    expect(cacheTags.products()).toBe("products");
    expect(cacheTags.categories()).toBe("categories");
    expect(cacheTags.homepage()).toBe("homepage");
    expect(cacheTags.storefront()).toBe("storefront");
  });
});

describe("revalidateProduct (CACHE-02)", () => {
  it("purges the product, its slug, the listing and the homepage", () => {
    revalidateProduct({
      categoryId: "cat-1",
      categorySlug: "phones",
      productId: "prod-1",
      slug: "galaxy-s24",
    });

    expect(purgedTags()).toStrictEqual(
      new Set([
        "product:prod-1",
        "product-slug:galaxy-s24",
        "products",
        "category:cat-1",
        "category-slug:phones",
        "homepage",
      ]),
    );
  });

  it("omits category tags when the product has no category context", () => {
    revalidateProduct({ productId: "prod-1", slug: "galaxy-s24" });

    expect(purgedTags()).toStrictEqual(
      new Set(["product:prod-1", "product-slug:galaxy-s24", "products", "homepage"]),
    );
  });

  it("never purges unrelated entities (CACHE-03)", () => {
    revalidateProduct({ productId: "prod-1", slug: "galaxy-s24" });

    expect(purgedTags().has("categories")).toBe(false);
    expect(purgedTags().has("storefront")).toBe(false);
    expect(purgedTags().has("brands")).toBe(false);
  });

  it("purges each tag exactly once even when inputs overlap", () => {
    revalidateProduct({ productId: "same", slug: "same" });

    expect(revalidateTag.mock.calls.length).toBe(purgedTags().size);
  });

  it("passes a cache-life profile so stale content can still be served", () => {
    revalidateProduct({ productId: "prod-1", slug: "galaxy-s24" });

    for (const call of revalidateTag.mock.calls) {
      expect(call[1]).toBe("max");
    }
  });
});

describe("revalidateProductPricing", () => {
  it("additionally purges offers and any dependent collections", () => {
    revalidateProductPricing({
      collectionIds: ["col-1", "col-2"],
      productId: "prod-1",
      slug: "galaxy-s24",
    });

    const tags = purgedTags();

    expect(tags.has("offers")).toBe(true);
    expect(tags.has("collection:col-1")).toBe(true);
    expect(tags.has("collection:col-2")).toBe(true);
  });

  it("works when no collections depend on the price", () => {
    revalidateProductPricing({ productId: "prod-1", slug: "galaxy-s24" });

    expect(purgedTags().has("offers")).toBe(true);
  });
});

describe("revalidateCategory", () => {
  it("purges the category, the tree and the homepage", () => {
    revalidateCategory({ categoryId: "cat-1", slug: "phones" });

    expect(purgedTags()).toStrictEqual(
      new Set(["category:cat-1", "category-slug:phones", "categories", "homepage"]),
    );
  });

  it("does not purge the whole product listing", () => {
    revalidateCategory({ categoryId: "cat-1", slug: "phones" });

    expect(purgedTags().has("products")).toBe(false);
  });
});

describe("revalidateCollection and storefront sections", () => {
  it("purges a collection and the homepage only", () => {
    revalidateCollection({ collectionId: "col-1" });

    expect(purgedTags()).toStrictEqual(new Set(["collection:col-1", "homepage"]));
  });

  it("purges the homepage and storefront for a section change", () => {
    revalidateStorefrontSections();

    expect(purgedTags()).toStrictEqual(new Set(["homepage", "storefront"]));
  });
});

describe("purge failure handling", () => {
  it("logs and continues rather than rolling back committed data", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    revalidateTag.mockImplementation(() => {
      throw new Error("revalidation unavailable");
    });

    expect(() => {
      revalidateProduct({ productId: "prod-1", slug: "galaxy-s24" });
    }).not.toThrow();

    expect(consoleError).toHaveBeenCalled();
    expect(consoleError.mock.calls[0]?.[0]).toBe("cache_purge_failed");

    consoleError.mockRestore();
  });
});
