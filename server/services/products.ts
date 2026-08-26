import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  CATALOGUE_MAX_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  type CatalogueCursor,
  type CatalogueQuery,
  type CatalogueSort,
} from "@/features/products/schemas/catalogue-query";
import { discountPercent } from "@/lib/money";
import { db } from "@/server/db";
import {
  attributeOptions,
  attributes as attributesTable,
  brands,
  categories,
  inventory,
  productAttributeValues,
  productImages,
  productVariants,
  products,
} from "@/server/db/schema";
import { getCategoryAndDescendantIds } from "@/server/services/categories";

export const POSTGRES_INTEGER_MAX = 2_147_483_647;
export const MAX_PRICE_MINOR_UNITS = POSTGRES_INTEGER_MAX;
export const CATALOGUE_PRICE_CEILING = 5_000_000_00;

export type ProductListItem = {
  basePrice: number;
  brandName: string;
  categoryName: string;
  categorySlug: string;
  comparePrice: number | null;
  defaultVariantId: string | null;
  defaultVariantLabel: string | null;
  discountPercent: number | null;
  id: string;
  imageAlt: string | null;
  imagePublicId: string | null;
  inStock: boolean;
  name: string;
  rating: number | null;
  ratingCount: number;
  requiresSelection: boolean;
  slug: string;
};

export type ProductPage = {
  items: ProductListItem[];
  nextCursor: string | null;
  totalCount: number;
};

export function resolveProductPrice(input: {
  basePrice: number;
  comparePrice?: number | null;
  variantComparePrice?: number | null;
  variantPrice?: number | null;
}) {
  const price = input.variantPrice ?? input.basePrice;
  const compareAt =
    input.variantPrice != null
      ? (input.variantComparePrice ?? null)
      : (input.comparePrice ?? null);

  return {
    comparePrice: compareAt,
    discountPercent: discountPercent(price, compareAt),
    price,
  };
}

export function normalisePriceRange(input: {
  maxPrice?: number | undefined;
  minPrice?: number | undefined;
}): { maxPrice: number | null; minPrice: number | null } {
  const clamp = (value: number) => Math.max(0, Math.min(value, MAX_PRICE_MINOR_UNITS));

  const min = input.minPrice === undefined ? null : clamp(input.minPrice);
  const max = input.maxPrice === undefined ? null : clamp(input.maxPrice);

  if (min !== null && max !== null && min > max) {
    return { maxPrice: min, minPrice: max };
  }

  return { maxPrice: max, minPrice: min };
}

type SortPlan = {
  keyset: (cursor: CatalogueCursor) => SQL;
  orderBy: SQL;
};

function getSortPlan(sort: CatalogueSort): SortPlan {
  const tiebreaker = (cursor: CatalogueCursor) => sql`${products.id} > ${cursor.id}`;

  const ratingExpression = sql`coalesce(${products.rating}, 0)`;

  switch (sort) {
    case "price_asc":
      return {
        orderBy: sql`${products.basePrice} asc, ${products.id} asc`,
        keyset: (cursor) =>
          sql`(${products.basePrice} > ${cursor.value} or (${products.basePrice} = ${cursor.value} and ${tiebreaker(cursor)}))`,
      };
    case "price_desc":
      return {
        orderBy: sql`${products.basePrice} desc, ${products.id} asc`,
        keyset: (cursor) =>
          sql`(${products.basePrice} < ${cursor.value} or (${products.basePrice} = ${cursor.value} and ${tiebreaker(cursor)}))`,
      };
    case "popularity":
      return {
        orderBy: sql`${products.popularity} desc, ${products.id} asc`,
        keyset: (cursor) =>
          sql`(${products.popularity} < ${cursor.value} or (${products.popularity} = ${cursor.value} and ${tiebreaker(cursor)}))`,
      };
    case "rating":
      return {
        orderBy: sql`${ratingExpression} desc, ${products.id} asc`,
        keyset: (cursor) =>
          sql`(${ratingExpression} < ${cursor.value} or (${ratingExpression} = ${cursor.value} and ${tiebreaker(cursor)}))`,
      };
    default:
      return {
        orderBy: sql`${products.createdAt} desc, ${products.id} asc`,
        keyset: (cursor) =>
          sql`(${products.createdAt} < ${cursor.value}::timestamptz or (${products.createdAt} = ${cursor.value}::timestamptz and ${tiebreaker(cursor)}))`,
      };
  }
}

const inStockExpression = sql<boolean>`exists (
  select 1
  from ${productVariants} variant
  join ${inventory} stock on stock.variant_id = variant.id
  where variant.product_id = ${products.id}
    and variant.status = 'active'
    and stock.available > 0
)`;

const productListSelection = {
  basePrice: products.basePrice,
  brandName: brands.name,
  categoryName: categories.name,
  categorySlug: categories.slug,
  comparePrice: products.comparePrice,
  createdAt: products.createdAt,
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
  defaultVariantComparePrice: sql<number | null>`(
    select variant.compare_price from ${productVariants} variant
    where variant.product_id = ${products.id} and variant.status = 'active'
    order by variant.sku asc
    limit 1
  )`,
  defaultVariantId: sql<string | null>`(
    select variant.id from ${productVariants} variant
    where variant.product_id = ${products.id} and variant.status = 'active'
    order by variant.sku asc
    limit 1
  )`,
  defaultVariantLabel: sql<string | null>`(
    select coalesce(
      nullif(
        (
          select string_agg(value, ' · ')
          from jsonb_each_text(variant.option_values)
        ),
        ''
      ),
      variant.sku
    )
    from ${productVariants} variant
    where variant.product_id = ${products.id} and variant.status = 'active'
    order by variant.sku asc
    limit 1
  )`,
  defaultVariantPrice: sql<number | null>`(
    select variant.price from ${productVariants} variant
    where variant.product_id = ${products.id} and variant.status = 'active'
    order by variant.sku asc
    limit 1
  )`,
  inStock: inStockExpression,
  name: products.name,
  popularity: products.popularity,
  rating: products.rating,
  ratingCount: products.ratingCount,
  slug: products.slug,
  variantCount: sql<number>`(
    select count(*)::int from ${productVariants} variant
    where variant.product_id = ${products.id} and variant.status = 'active'
  )`,
} as const;

type ProductListRow = {
  basePrice: number;
  brandName: string;
  categoryName: string;
  categorySlug: string;
  comparePrice: number | null;
  createdAt: Date;
  defaultVariantComparePrice: number | null;
  defaultVariantId: string | null;
  defaultVariantLabel: string | null;
  defaultVariantPrice: number | null;
  id: string;
  imageAlt: string | null;
  imagePublicId: string | null;
  inStock: boolean;
  name: string;
  popularity: number;
  rating: number | null;
  ratingCount: number;
  slug: string;
  variantCount: number;
};

function toProductListItem(row: ProductListRow): ProductListItem {
  const isSingleVariant = row.variantCount === 1;

  const price = resolveProductPrice({
    basePrice: row.basePrice,
    comparePrice: row.comparePrice,
    variantComparePrice: isSingleVariant ? row.defaultVariantComparePrice : null,
    variantPrice: isSingleVariant ? row.defaultVariantPrice : null,
  });

  return {
    basePrice: price.price,
    brandName: row.brandName,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    comparePrice: price.comparePrice,
    defaultVariantId: row.defaultVariantId,
    defaultVariantLabel: isSingleVariant ? null : row.defaultVariantLabel,
    discountPercent: price.discountPercent,
    id: row.id,
    imageAlt: row.imageAlt,
    imagePublicId: row.imagePublicId,
    inStock: row.inStock,
    name: row.name,
    rating: row.rating,
    ratingCount: row.ratingCount,
    requiresSelection: row.variantCount > 1,
    slug: row.slug,
  };
}

function attributeConditions(attributes: CatalogueQuery["attributes"]) {
  if (!attributes) {
    return [];
  }

  return Object.entries(attributes)
    .filter(([, values]) => values.length > 0)
    .map(([slug, values]) => {
      const wanted = sql.join(
        values.map((entry) => sql`${entry.toLowerCase()}`),
        sql`, `,
      );

      return sql`(
          exists (
            select 1
            from ${productAttributeValues} pav
            join ${attributesTable} attr on attr.id = pav.attribute_id
            join ${attributeOptions} opt on opt.id = pav.option_id
            where pav.product_id = ${products.id}
              and attr.slug = ${slug}
              and lower(opt.value) in (${wanted})
          )
          or exists (
            select 1
            from ${productVariants} pv
            where pv.product_id = ${products.id}
              and pv.status = 'active'
              and lower(pv.option_values ->> ${slug}) in (${wanted})
          )
        )`;
    });
}

export async function listProducts(query: CatalogueQuery): Promise<ProductPage> {
  const limit = Math.min(query.limit, CATALOGUE_MAX_PAGE_SIZE);
  const { maxPrice, minPrice } = normalisePriceRange({
    ...(query.maxPrice === undefined ? {} : { maxPrice: query.maxPrice }),
    ...(query.minPrice === undefined ? {} : { minPrice: query.minPrice }),
  });

  const conditions = [eq(products.status, "active")];

  if (minPrice !== null) {
    conditions.push(gte(products.basePrice, minPrice));
  }

  if (maxPrice !== null) {
    conditions.push(lte(products.basePrice, maxPrice));
  }

  if (query.categorySlug) {
    const category = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.slug, query.categorySlug), eq(categories.status, "active")),
      )
      .limit(1);

    const categoryId = category[0]?.id;

    if (!categoryId) {
      return { items: [], nextCursor: null, totalCount: 0 };
    }

    const categoryIds = await getCategoryAndDescendantIds(categoryId);

    conditions.push(inArray(products.categoryId, categoryIds));
  }

  if (query.brandSlugs && query.brandSlugs.length > 0) {
    conditions.push(inArray(brands.slug, query.brandSlugs));
  }

  if (query.minRating !== undefined) {
    conditions.push(gte(products.rating, query.minRating * 100));
  }

  if (query.onSaleOnly) {
    conditions.push(isNotNull(products.comparePrice));
    conditions.push(gt(products.comparePrice, products.basePrice));
  }

  if (query.search) {
    conditions.push(sql`${products.name} ilike ${`%${query.search}%`}`);
  }

  conditions.push(...attributeConditions(query.attributes));

  if (query.inStockOnly) {
    conditions.push(inStockExpression);
  }

  const filterConditions = [...conditions];

  const plan = getSortPlan(query.sort);
  const cursor = decodeCursor(query.cursor);

  if (cursor) {
    conditions.push(plan.keyset(cursor));
  }

  const countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...filterConditions));

  const rowsQuery = db
    .select(productListSelection)
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(plan.orderBy)
    .limit(limit + 1);

  const [rows, countRows] = await Promise.all([rowsQuery, countQuery]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  const items = page.map(toProductListItem);

  function cursorValueOf(row: typeof last) {
    if (!row) {
      return null;
    }

    switch (query.sort) {
      case "price_asc":
      case "price_desc":
        return row.basePrice;
      case "popularity":
        return row.popularity;
      case "rating":
        return row.rating ?? 0;
      default:
        return row.createdAt.toISOString();
    }
  }

  const cursorValue = cursorValueOf(last);

  return {
    items,
    nextCursor:
      hasMore && last && cursorValue !== null
        ? encodeCursor({ id: last.id, value: cursorValue })
        : null,
    totalCount: countRows[0]?.total ?? 0,
  };
}

export async function listProductsByIds(
  productIds: readonly string[],
): Promise<ProductListItem[]> {
  if (productIds.length === 0) {
    return [];
  }

  const wanted = [...new Set(productIds)];

  const rows = await db
    .select(productListSelection)
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.status, "active"), inArray(products.id, wanted)))
    .limit(wanted.length);

  const found = new Map(rows.map((row) => [row.id, toProductListItem(row)]));

  return wanted.flatMap((productId) => {
    const item = found.get(productId);

    return item ? [item] : [];
  });
}

export type ProductDetail = {
  basePrice: number;
  brandName: string;
  brandSlug: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  comparePrice: number | null;
  description: string | null;
  id: string;
  images: {
    alt: string;
    height: number;
    isPrimary: boolean;
    publicId: string;
    width: number;
  }[];
  name: string;
  rating: number | null;
  ratingCount: number;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  variants: {
    available: number;
    comparePrice: number | null;
    id: string;
    optionValues: Record<string, string>;
    price: number;
    sku: string;
  }[];
};

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const rows = await db
    .select({
      basePrice: products.basePrice,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      comparePrice: products.comparePrice,
      description: products.description,
      id: products.id,
      name: products.name,
      rating: products.rating,
      ratingCount: products.ratingCount,
      seoDescription: products.seoDescription,
      seoTitle: products.seoTitle,
      slug: products.slug,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.status, "active")))
    .limit(1);

  const product = rows[0];

  if (!product) {
    return null;
  }

  const [images, variants] = await Promise.all([
    db
      .select({
        alt: productImages.alt,
        height: productImages.height,
        isPrimary: productImages.isPrimary,
        publicId: productImages.cloudinaryPublicId,
        width: productImages.width,
      })
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder)),
    db
      .select({
        available: inventory.available,
        comparePrice: productVariants.comparePrice,
        id: productVariants.id,
        optionValues: productVariants.optionValues,
        price: productVariants.price,
        sku: productVariants.sku,
      })
      .from(productVariants)
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(
        and(
          eq(productVariants.productId, product.id),
          eq(productVariants.status, "active"),
        ),
      )
      .orderBy(asc(productVariants.sku)),
  ]);

  return {
    ...product,
    images,
    variants: variants.map((variant) => {
      const resolved = resolveProductPrice({
        basePrice: product.basePrice,
        comparePrice: product.comparePrice,
        variantComparePrice: variant.comparePrice,
        variantPrice: variant.price,
      });

      return {
        available: variant.available ?? 0,
        comparePrice: resolved.comparePrice,
        id: variant.id,
        optionValues: (variant.optionValues ?? {}) as Record<string, string>,
        price: resolved.price,
        sku: variant.sku,
      };
    }),
  };
}

export async function listBrandsForCategory(categorySlug?: string) {
  if (!categorySlug) {
    return db
      .selectDistinct({ name: brands.name, slug: brands.slug })
      .from(brands)
      .innerJoin(products, eq(products.brandId, brands.id))
      .where(and(eq(brands.status, "active"), eq(products.status, "active")))
      .orderBy(asc(brands.name));
  }

  const category = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.slug, categorySlug), eq(categories.status, "active")))
    .limit(1);

  const categoryId = category[0]?.id;

  if (!categoryId) {
    return [];
  }

  const categoryIds = await getCategoryAndDescendantIds(categoryId);

  return db
    .selectDistinct({ name: brands.name, slug: brands.slug })
    .from(brands)
    .innerJoin(products, eq(products.brandId, brands.id))
    .where(
      and(
        eq(brands.status, "active"),
        eq(products.status, "active"),
        inArray(products.categoryId, categoryIds),
      ),
    )
    .orderBy(asc(brands.name));
}

export type ProductSpecification = {
  name: string;
  slug: string;
  unit: string | null;
  value: string;
};

export async function getProductAttributes(
  productId: string,
): Promise<ProductSpecification[]> {
  const result = await db.execute<{
    name: string;
    slug: string;
    unit: string | null;
    value: string | null;
  }>(sql`
    select
      attribute.name,
      attribute.slug,
      attribute.unit,
      coalesce(
        opt.value,
        pav.value_text,
        pav.value_number::text,
        case
          when pav.value_boolean is null then null
          when pav.value_boolean then 'Yes'
          else 'No'
        end
      ) as value
    from ${productAttributeValues} pav
    join ${attributesTable} attribute on attribute.id = pav.attribute_id
    left join ${attributeOptions} opt on opt.id = pav.option_id
    where pav.product_id = ${productId}
    order by attribute.sort_order asc, attribute.name asc
  `);

  return result.rows
    .filter((row): row is typeof row & { value: string } => row.value !== null)
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      unit: row.unit,
      value: row.value,
    }));
}
