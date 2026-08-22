import "server-only";

import { unstable_cache } from "next/cache";

import { EMPTY_FILTER_STATE } from "@/features/filters/catalogue-url";
import type { CatalogueRequest } from "@/features/products/schemas/catalogue-api";
import { getCachedProductPage } from "@/server/cache/catalogue";
import {
  cacheTags,
  CATALOGUE_LISTING_TTL_SECONDS,
  CATALOGUE_STRUCTURE_TTL_SECONDS,
} from "@/server/cache/tags";
import type { ProductListItem } from "@/server/services/products";
import {
  buildCollectionQuery,
  buildSectionQuery,
  listActiveSections,
  listCollectionProducts,
  listSectionBrands,
  listSectionCategories,
  resolveSectionItemLimit,
  type SectionCampaign,
  type StorefrontSection,
} from "@/server/services/storefront";

const CACHE_NAMESPACE = "storefront";
const SECTION_LIST_TTL_SECONDS = 60;

export type SectionPayload =
  | {
      items: ProductListItem[];
      kind: "products";
      nextCursor: string | null;
      totalCount: number;
    }
  | { items: { id: string; name: string; slug: string }[]; kind: "categories" }
  | { items: { name: string; slug: string }[]; kind: "brands" }
  | { campaign: SectionCampaign; kind: "campaign" }
  | { kind: "empty" }
  | { kind: "error" };

export type ResolvedSection = {
  continuation: CatalogueRequest | null;
  payload: SectionPayload;
  section: StorefrontSection;
};

const cachedActiveSections = unstable_cache(
  () => listActiveSections(),
  [CACHE_NAMESPACE, "active-sections"],
  {
    revalidate: SECTION_LIST_TTL_SECONDS,
    tags: [cacheTags.homepage(), cacheTags.storefront()],
  },
);

export function getCachedActiveSections(): Promise<StorefrontSection[]> {
  return cachedActiveSections();
}

function cachedCollectionProducts(collectionId: string, limit: number) {
  return unstable_cache(
    () => listCollectionProducts(collectionId, limit),
    [CACHE_NAMESPACE, "collection-products", collectionId, String(limit)],
    {
      revalidate: CATALOGUE_LISTING_TTL_SECONDS,
      tags: [cacheTags.collection(collectionId), cacheTags.products()],
    },
  )();
}

function cachedSectionCategories(parentSlug: string | null, limit: number) {
  return unstable_cache(
    () => listSectionCategories(parentSlug, limit),
    [CACHE_NAMESPACE, "section-categories", parentSlug ?? "root", String(limit)],
    {
      revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS,
      tags: [cacheTags.categories()],
    },
  )();
}

function cachedSectionBrands(limit: number) {
  return unstable_cache(
    () => listSectionBrands(limit),
    [CACHE_NAMESPACE, "section-brands", String(limit)],
    {
      revalidate: CATALOGUE_STRUCTURE_TTL_SECONDS,
      tags: [cacheTags.brands(), cacheTags.products()],
    },
  )();
}

async function resolveProductSection(
  section: StorefrontSection,
): Promise<SectionPayload> {
  const limit = resolveSectionItemLimit(section);

  if (section.sourceKind === "collection" || section.type === "collection") {
    if (!section.collectionId) {
      return { kind: "empty" };
    }

    const dynamicQuery = buildCollectionQuery(section);

    const items = dynamicQuery
      ? (await getCachedProductPage(dynamicQuery)).items
      : await cachedCollectionProducts(section.collectionId, limit);

    return items.length > 0
      ? { items, kind: "products", nextCursor: null, totalCount: items.length }
      : { kind: "empty" };
  }

  const query = buildSectionQuery(section);

  if (!query) {
    return { kind: "empty" };
  }

  const page = await getCachedProductPage(query);

  return page.items.length > 0
    ? {
        items: page.items,
        kind: "products",
        nextCursor: page.nextCursor,
        totalCount: page.totalCount,
      }
    : { kind: "empty" };
}

async function resolveSectionPayload(
  section: StorefrontSection,
): Promise<SectionPayload> {
  const limit = resolveSectionItemLimit(section);

  switch (section.type) {
    case "product_rail":
    case "product_grid":
    case "collection":
      return resolveProductSection(section);

    case "category_rail": {
      const items = await cachedSectionCategories(
        section.categorySlug ?? section.sourceRef,
        limit,
      );

      return items.length > 0 ? { items, kind: "categories" } : { kind: "empty" };
    }

    case "brand_rail": {
      const items = await cachedSectionBrands(limit);

      return items.length > 0 ? { items, kind: "brands" } : { kind: "empty" };
    }

    case "promo_banner":
    case "split_campaign":
      return section.campaign
        ? { campaign: section.campaign, kind: "campaign" }
        : { kind: "empty" };

    case "video_campaign":
      return { kind: "empty" };

    default:
      console.error("storefront_section_type_unsupported", {
        sectionSlug: section.slug,
        sectionType: section.type,
      });

      return { kind: "empty" };
  }
}

function continuationFor(section: StorefrontSection): CatalogueRequest | null {
  if (section.type !== "product_grid") {
    return null;
  }

  const query = buildSectionQuery(section);

  if (!query) {
    return null;
  }

  return {
    categorySlug: query.categorySlug ?? null,
    filters: {
      ...EMPTY_FILTER_STATE,
      ...(query.onSaleOnly ? { onSaleOnly: true } : {}),
      sort: query.sort,
    },
    limit: query.limit,
  };
}

export async function resolveSection(
  section: StorefrontSection,
): Promise<ResolvedSection> {
  try {
    return {
      continuation: continuationFor(section),
      payload: await resolveSectionPayload(section),
      section,
    };
  } catch (error) {
    console.error("storefront_section_resolve_failed", {
      error: error instanceof Error ? error.message : "unknown",
      sectionSlug: section.slug,
      sectionType: section.type,
    });

    return { continuation: null, payload: { kind: "error" }, section };
  }
}
