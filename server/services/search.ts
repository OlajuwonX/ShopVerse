import "server-only";

import { and, asc, eq, ilike, sql } from "drizzle-orm";

import {
  SUGGESTION_BRAND_LIMIT,
  SUGGESTION_CATEGORY_LIMIT,
  SUGGESTION_PRODUCT_LIMIT,
} from "@/constants/search";
import { db } from "@/server/db";
import { brands, categories, productImages, products } from "@/server/db/schema";

export type SearchSuggestions = {
  brands: { name: string; slug: string }[];
  categories: { name: string; slug: string }[];
  products: {
    basePrice: number;
    id: string;
    imagePublicId: string | null;
    name: string;
    slug: string;
  }[];
  term: string;
};

export function normaliseSearchTerm(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function likePattern(term: string) {
  const escaped = term
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");

  return `%${escaped}%`;
}

export async function searchSuggestions(term: string): Promise<SearchSuggestions> {
  const normalised = normaliseSearchTerm(term);
  const pattern = likePattern(normalised);

  const [productRows, categoryRows, brandRows] = await Promise.all([
    db
      .select({
        basePrice: products.basePrice,
        id: products.id,
        imagePublicId: sql<string | null>`(
          select image.cloudinary_public_id from ${productImages} image
          where image.product_id = ${products.id}
          order by image.is_primary desc, image.sort_order asc
          limit 1
        )`,
        name: products.name,
        slug: products.slug,
      })
      .from(products)
      .where(and(eq(products.status, "active"), ilike(products.name, pattern)))
      .orderBy(
        sql`position(lower(${normalised}) in lower(${products.name}))`,
        asc(products.name),
      )
      .limit(SUGGESTION_PRODUCT_LIMIT),

    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .where(and(eq(categories.status, "active"), ilike(categories.name, pattern)))
      .orderBy(asc(categories.sortOrder), asc(categories.name))
      .limit(SUGGESTION_CATEGORY_LIMIT),

    db
      .selectDistinct({ name: brands.name, slug: brands.slug })
      .from(brands)
      .innerJoin(products, eq(products.brandId, brands.id))
      .where(
        and(
          eq(brands.status, "active"),
          eq(products.status, "active"),
          ilike(brands.name, pattern),
        ),
      )
      .orderBy(asc(brands.name))
      .limit(SUGGESTION_BRAND_LIMIT),
  ]);

  return {
    brands: brandRows,
    categories: categoryRows,
    products: productRows,
    term: normalised,
  };
}

export function hasSuggestions(suggestions: SearchSuggestions) {
  return (
    suggestions.products.length > 0 ||
    suggestions.categories.length > 0 ||
    suggestions.brands.length > 0
  );
}
