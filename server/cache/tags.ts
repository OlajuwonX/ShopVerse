import "server-only";

export const cacheTags = {
  brands: () => "brands",
  categories: () => "categories",
  category: (categoryId: string) => `category:${categoryId}`,
  categorySlug: (slug: string) => `category-slug:${slug}`,
  collection: (collectionId: string) => `collection:${collectionId}`,
  homepage: () => "homepage",
  offers: () => "offers",
  product: (productId: string) => `product:${productId}`,
  productSlug: (slug: string) => `product-slug:${slug}`,
  products: () => "products",
  storefront: () => "storefront",
  trending: () => "trending",
} as const;

export type CacheTag = ReturnType<(typeof cacheTags)[keyof typeof cacheTags]>;

export const CATALOGUE_STRUCTURE_TTL_SECONDS = 3600;
export const CATALOGUE_LISTING_TTL_SECONDS = 60;
