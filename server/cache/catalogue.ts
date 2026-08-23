import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { CatalogueQuery } from "@/features/products/schemas/catalogue-query";
import {
  cacheTags,
  CATALOGUE_LISTING_TTL_SECONDS,
  CATALOGUE_STRUCTURE_TTL_SECONDS,
} from "@/server/cache/tags";
import {
  getCategoryAncestors,
  getCategoryBySlug,
  getCategoryFilterAttributes,
  getCategoryTree,
  type CategoryNode,
  type ResolvedAttribute,
} from "@/server/services/categories";
import {
  getProductAttributes,
  getProductBySlug,
  listBrandsForCategory,
  listProducts,
  listProductsByIds,
  type ProductDetail,
  type ProductListItem,
  type ProductPage,
} from "@/server/services/products";

const CACHE_NAMESPACE = "catalogue";

export function canonicaliseCatalogueQuery(query: CatalogueQuery): CatalogueQuery {
  const brandSlugs =
    query.brandSlugs && query.brandSlugs.length > 0
      ? [...new Set(query.brandSlugs)].sort()
      : undefined;

  const search = query.search?.trim().toLowerCase();

  const attributeEntries = Object.entries(query.attributes ?? {})
    .map(
      ([slug, values]) =>
        [
          slug.toLowerCase(),
          [...new Set(values.map((v) => v.toLowerCase()))].sort(),
        ] as const,
    )
    .filter(([, values]) => values.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const attributes =
    attributeEntries.length > 0 ? Object.fromEntries(attributeEntries) : undefined;

  return {
    ...(attributes ? { attributes } : {}),
    ...(brandSlugs ? { brandSlugs } : {}),
    ...(query.categorySlug ? { categorySlug: query.categorySlug } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.inStockOnly ? { inStockOnly: true } : {}),
    limit: query.limit,
    ...(query.maxPrice === undefined ? {} : { maxPrice: query.maxPrice }),
    ...(query.minPrice === undefined ? {} : { minPrice: query.minPrice }),
    ...(query.minRating === undefined ? {} : { minRating: query.minRating }),
    ...(query.onSaleOnly ? { onSaleOnly: true } : {}),
    ...(search ? { search } : {}),
    sort: query.sort,
  };
}

export function catalogueQueryKey(query: CatalogueQuery) {
  return JSON.stringify(canonicaliseCatalogueQuery(query));
}

const cachedCategoryTree = unstable_cache(
  () => getCategoryTree(),
  [CACHE_NAMESPACE, "category-tree"],
  { revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS, tags: [cacheTags.categories()] },
);

export const getCachedCategoryTree = cache((): Promise<CategoryNode[]> =>
  cachedCategoryTree(),
);

export const getCachedCategoryBySlug = cache((slug: string) =>
  unstable_cache(
    () => getCategoryBySlug(slug),
    [CACHE_NAMESPACE, "category-by-slug", slug],
    {
      revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS,
      tags: [cacheTags.categories(), cacheTags.categorySlug(slug)],
    },
  )(),
);

export const getCachedCategoryAncestors = cache((categoryId: string) =>
  unstable_cache(
    () => getCategoryAncestors(categoryId),
    [CACHE_NAMESPACE, "category-ancestors", categoryId],
    {
      revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS,
      tags: [cacheTags.categories(), cacheTags.category(categoryId)],
    },
  )(),
);

export const getCachedCategoryFilterAttributes = cache(
  (categoryId: string): Promise<ResolvedAttribute[]> =>
    unstable_cache(
      () => getCategoryFilterAttributes(categoryId),
      [CACHE_NAMESPACE, "category-filter-attributes", categoryId],
      {
        revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS,
        tags: [cacheTags.categories(), cacheTags.category(categoryId)],
      },
    )(),
);

export const getCachedBrandsForCategory = cache((categorySlug?: string) =>
  unstable_cache(
    () => listBrandsForCategory(categorySlug),
    [CACHE_NAMESPACE, "brands-for-category", categorySlug ?? "all"],
    {
      revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS,
      tags: [
        cacheTags.brands(),
        cacheTags.products(),
        ...(categorySlug ? [cacheTags.categorySlug(categorySlug)] : []),
      ],
    },
  )(),
);

const productPageForKey = cache((key: string): Promise<ProductPage> => {
  const canonical = JSON.parse(key) as CatalogueQuery;

  return unstable_cache(
    () => listProducts(canonical),
    [CACHE_NAMESPACE, "product-page", key],
    {
      revalidate: CATALOGUE_LISTING_TTL_SECONDS,
      tags: [
        cacheTags.products(),
        ...(canonical.categorySlug
          ? [cacheTags.categorySlug(canonical.categorySlug)]
          : []),
      ],
    },
  )();
});

export function getCachedProductPage(query: CatalogueQuery): Promise<ProductPage> {
  return productPageForKey(catalogueQueryKey(query));
}

const productsForIdKey = cache((key: string): Promise<ProductListItem[]> =>
  listProductsByIds(JSON.parse(key) as string[]),
);

export function getProductsByIds(
  productIds: readonly string[],
): Promise<ProductListItem[]> {
  if (productIds.length === 0) {
    return Promise.resolve([]);
  }

  return productsForIdKey(JSON.stringify([...productIds]));
}

export const getCachedProductBySlug = cache(
  (slug: string): Promise<ProductDetail | null> =>
    unstable_cache(
      () => getProductBySlug(slug),
      [CACHE_NAMESPACE, "product-by-slug", slug],
      {
        revalidate: CATALOGUE_LISTING_TTL_SECONDS,
        tags: [cacheTags.productSlug(slug)],
      },
    )(),
);

export function getCachedProductAttributes(productId: string) {
  return unstable_cache(
    () => getProductAttributes(productId),
    [CACHE_NAMESPACE, "product-attributes", productId],
    {
      revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS,
      tags: [cacheTags.product(productId), cacheTags.categories()],
    },
  )();
}
