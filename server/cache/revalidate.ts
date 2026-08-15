import "server-only";

import { revalidateTag } from "next/cache";

import { cacheTags } from "@/server/cache/tags";

const PURGE_ATTEMPTS = 2;

function purgeTag(tag: string) {
  for (let attempt = 1; attempt <= PURGE_ATTEMPTS; attempt += 1) {
    try {
      revalidateTag(tag, "max");

      return;
    } catch (error) {
      if (attempt === PURGE_ATTEMPTS) {
        console.error("cache_purge_failed", {
          attempts: attempt,
          error: error instanceof Error ? error.message : "unknown",
          tag,
        });
      }
    }
  }
}

function purge(tags: readonly string[]) {
  for (const tag of new Set(tags)) {
    purgeTag(tag);
  }
}

export function revalidateProduct(input: {
  categoryId?: string | null;
  categorySlug?: string | null;
  productId: string;
  slug: string;
}) {
  purge([
    cacheTags.product(input.productId),
    cacheTags.productSlug(input.slug),
    cacheTags.products(),
    ...(input.categoryId ? [cacheTags.category(input.categoryId)] : []),
    ...(input.categorySlug ? [cacheTags.categorySlug(input.categorySlug)] : []),
    cacheTags.homepage(),
  ]);
}

export function revalidateProductPricing(input: {
  categoryId?: string | null;
  categorySlug?: string | null;
  collectionIds?: readonly string[];
  productId: string;
  slug: string;
}) {
  purge([
    cacheTags.product(input.productId),
    cacheTags.productSlug(input.slug),
    cacheTags.products(),
    ...(input.categoryId ? [cacheTags.category(input.categoryId)] : []),
    ...(input.categorySlug ? [cacheTags.categorySlug(input.categorySlug)] : []),
    ...(input.collectionIds ?? []).map((collectionId) =>
      cacheTags.collection(collectionId),
    ),
    cacheTags.offers(),
    cacheTags.homepage(),
  ]);
}

export function revalidateCategory(input: { categoryId: string; slug: string }) {
  purge([
    cacheTags.category(input.categoryId),
    cacheTags.categorySlug(input.slug),
    cacheTags.categories(),
    cacheTags.homepage(),
  ]);
}

export function revalidateCollection(input: { collectionId: string }) {
  purge([cacheTags.collection(input.collectionId), cacheTags.homepage()]);
}

export function revalidateStorefrontSections() {
  purge([cacheTags.homepage(), cacheTags.storefront()]);
}
