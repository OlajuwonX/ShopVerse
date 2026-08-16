import "server-only";

import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { CatalogueQuery } from "@/features/products/schemas/catalogue-query";
import {
  campaignContentSchema,
  collectionRulesSchema,
  sectionLayoutConfigSchema,
  SECTION_DEFAULT_ITEMS,
  SECTION_MAX_ITEMS,
  type CampaignContent,
  type SectionLayoutConfig,
} from "@/features/storefront/schemas/section-config";
import { discountPercent } from "@/lib/money";
import { db } from "@/server/db";
import {
  brands,
  campaigns,
  categories,
  collectionProducts,
  collections,
  inventory,
  productImages,
  productVariants,
  products,
  storefrontSections,
} from "@/server/db/schema";
import type { ProductListItem } from "@/server/services/products";

export type SectionType = (typeof storefrontSections.$inferSelect)["type"];
export type SectionSourceKind = (typeof storefrontSections.$inferSelect)["sourceKind"];

export type SectionCampaign = {
  content: CampaignContent;
  href: string | null;
  image: string | null;
  title: string;
  type: "promo_banner" | "video_campaign" | "split_campaign";
  videoPublicId: string | null;
};

export type StorefrontSection = {
  brandSlug: string | null;
  campaign: SectionCampaign | null;
  categorySlug: string | null;
  collectionId: string | null;
  collectionRules: unknown;
  collectionType: "manual" | "dynamic" | null;
  desktopConfig: SectionLayoutConfig;
  id: string;
  mobileConfig: SectionLayoutConfig;
  slug: string;
  sortOrder: number;
  sourceKind: SectionSourceKind;
  sourceRef: string | null;
  title: string;
  type: SectionType;
  viewMoreHref: string | null;
};

function scheduleIsOpen(startsAt: AnyPgColumn, endsAt: AnyPgColumn) {
  return and(
    or(isNull(startsAt), lte(startsAt, sql`now()`)),
    or(isNull(endsAt), gt(endsAt, sql`now()`)),
  );
}

export async function listActiveSections(): Promise<StorefrontSection[]> {
  const rows = await db
    .select({
      brandSlug: brands.slug,
      campaignContent: campaigns.content,
      campaignHref: campaigns.href,
      campaignImage: campaigns.image,
      campaignTitle: campaigns.title,
      campaignType: campaigns.type,
      campaignVideoPublicId: campaigns.videoPublicId,
      categorySlug: categories.slug,
      collectionId: collections.id,
      collectionRules: collections.rules,
      collectionType: collections.type,
      desktopConfig: storefrontSections.desktopConfig,
      id: storefrontSections.id,
      mobileConfig: storefrontSections.mobileConfig,
      slug: storefrontSections.slug,
      sortOrder: storefrontSections.sortOrder,
      sourceKind: storefrontSections.sourceKind,
      sourceRef: storefrontSections.sourceRef,
      title: storefrontSections.title,
      type: storefrontSections.type,
      viewMoreHref: storefrontSections.viewMoreHref,
    })
    .from(storefrontSections)
    .leftJoin(
      campaigns,
      and(
        eq(storefrontSections.campaignId, campaigns.id),
        eq(campaigns.status, "active"),
        scheduleIsOpen(campaigns.startsAt, campaigns.endsAt),
      ),
    )
    .leftJoin(
      collections,
      and(
        eq(storefrontSections.collectionId, collections.id),
        eq(collections.status, "active"),
        scheduleIsOpen(collections.startsAt, collections.endsAt),
      ),
    )
    .leftJoin(
      categories,
      and(
        eq(storefrontSections.categoryId, categories.id),
        eq(categories.status, "active"),
      ),
    )
    .leftJoin(
      brands,
      and(eq(storefrontSections.brandId, brands.id), eq(brands.status, "active")),
    )
    .where(
      and(
        eq(storefrontSections.isActive, true),
        scheduleIsOpen(storefrontSections.startsAt, storefrontSections.endsAt),
      ),
    )
    .orderBy(asc(storefrontSections.sortOrder), asc(storefrontSections.slug));

  return rows.map((row) => ({
    brandSlug: row.brandSlug,
    campaign: row.campaignTitle
      ? {
          content: campaignContentSchema.parse(row.campaignContent ?? {}),
          href: row.campaignHref,
          image: row.campaignImage,
          title: row.campaignTitle,
          type: row.campaignType ?? "promo_banner",
          videoPublicId: row.campaignVideoPublicId,
        }
      : null,
    categorySlug: row.categorySlug,
    collectionId: row.collectionId,
    collectionRules: row.collectionRules,
    collectionType: row.collectionType,
    desktopConfig: sectionLayoutConfigSchema.parse(row.desktopConfig ?? {}),
    id: row.id,
    mobileConfig: sectionLayoutConfigSchema.parse(row.mobileConfig ?? {}),
    slug: row.slug,
    sortOrder: row.sortOrder,
    sourceKind: row.sourceKind,
    sourceRef: row.sourceRef,
    title: row.title,
    type: row.type,
    viewMoreHref: row.viewMoreHref,
  }));
}

export function resolveSectionItemLimit(section: StorefrontSection) {
  const configured = section.desktopConfig.itemLimit ?? section.mobileConfig.itemLimit;

  return Math.min(configured ?? SECTION_DEFAULT_ITEMS, SECTION_MAX_ITEMS);
}

export function buildSectionQuery(section: StorefrontSection): CatalogueQuery | null {
  const limit = resolveSectionItemLimit(section);
  const categorySlug = section.categorySlug ?? section.sourceRef ?? undefined;

  switch (section.sourceKind) {
    case "category":
      return categorySlug ? { limit, categorySlug, sort: "popularity" } : null;
    case "offers":
      return { limit, onSaleOnly: true, sort: "popularity" };
    case "new_arrivals":
      return { limit, sort: "newest" };
    case "trending":
    case "best_sellers":
    case "recommended":
      return { limit, sort: "popularity" };
    default:
      return null;
  }
}

export function buildCollectionQuery(
  section: StorefrontSection,
): CatalogueQuery | null {
  if (section.collectionType !== "dynamic") {
    return null;
  }

  const rules = collectionRulesSchema.parse(section.collectionRules ?? {});

  return {
    limit: resolveSectionItemLimit(section),
    ...(rules.categorySlug ? { categorySlug: rules.categorySlug } : {}),
    ...(rules.inStockOnly ? { inStockOnly: true } : {}),
    ...(rules.maxPrice === undefined ? {} : { maxPrice: rules.maxPrice }),
    ...(rules.minPrice === undefined ? {} : { minPrice: rules.minPrice }),
    ...(rules.minRating === undefined ? {} : { minRating: rules.minRating }),
    ...(rules.onSaleOnly ? { onSaleOnly: true } : {}),
    sort: rules.sort ?? "popularity",
  };
}

export async function listCollectionProducts(
  collectionId: string,
  limit: number,
): Promise<ProductListItem[]> {
  const rows = await db
    .select({
      basePrice: products.basePrice,
      brandName: brands.name,
      categorySlug: categories.slug,
      comparePrice: products.comparePrice,
      id: products.id,
      imageAlt: sql<string | null>`(
        select image.alt from ${productImages} image
        where image.product_id = ${products.id}
        order by image.is_primary desc, image.sort_order asc
        limit 1
      )`,
      imagePublicId: sql<string | null>`(
        select image.cloudinary_public_id from ${productImages} image
        where image.product_id = ${products.id}
        order by image.is_primary desc, image.sort_order asc
        limit 1
      )`,
      inStock: sql<boolean>`exists (
        select 1
        from ${productVariants} variant
        join ${inventory} stock on stock.variant_id = variant.id
        where variant.product_id = ${products.id}
          and variant.status = 'active'
          and stock.available > 0
      )`,
      name: products.name,
      rating: products.rating,
      ratingCount: products.ratingCount,
      slug: products.slug,
      variantCount: sql<number>`(
        select count(*)::int from ${productVariants} variant
        where variant.product_id = ${products.id} and variant.status = 'active'
      )`,
    })
    .from(collectionProducts)
    .innerJoin(products, eq(collectionProducts.productId, products.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        eq(collectionProducts.collectionId, collectionId),
        eq(products.status, "active"),
      ),
    )
    .orderBy(asc(collectionProducts.sortOrder), asc(products.id))
    .limit(Math.min(limit, SECTION_MAX_ITEMS));

  return rows.map((row) => ({
    basePrice: row.basePrice,
    brandName: row.brandName,
    categorySlug: row.categorySlug,
    comparePrice: row.comparePrice,
    discountPercent: discountPercent(row.basePrice, row.comparePrice),
    id: row.id,
    imageAlt: row.imageAlt,
    imagePublicId: row.imagePublicId,
    inStock: row.inStock,
    name: row.name,
    rating: row.rating,
    ratingCount: row.ratingCount,
    requiresSelection: row.variantCount > 1,
    slug: row.slug,
  }));
}

export async function listSectionCategories(
  parentSlug: string | null,
  limit: number,
): Promise<{ id: string; name: string; slug: string }[]> {
  const parent = parentSlug
    ? await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, parentSlug), eq(categories.status, "active")))
        .limit(1)
    : [];

  const parentId = parent[0]?.id ?? null;

  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(
      and(
        eq(categories.status, "active"),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
      ),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .limit(Math.min(limit, SECTION_MAX_ITEMS));
}

export async function listSectionBrands(
  limit: number,
): Promise<{ name: string; slug: string }[]> {
  return db
    .selectDistinct({ name: brands.name, slug: brands.slug })
    .from(brands)
    .innerJoin(products, eq(products.brandId, brands.id))
    .where(and(eq(brands.status, "active"), eq(products.status, "active")))
    .orderBy(asc(brands.name))
    .limit(Math.min(limit, SECTION_MAX_ITEMS));
}
