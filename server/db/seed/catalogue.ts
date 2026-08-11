import { neon } from "@neondatabase/serverless";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { buildSku, uniqueSlug } from "@/lib/slug";
import { toMinorUnits } from "@/lib/money";
import * as schema from "@/server/db/schema";
import {
  seedAttributes,
  seedBrands,
  seedCategories,
  seedCategoryAttributes,
  seedProducts,
  type SeedProduct,
} from "@/server/db/seed/catalogue-data";

const {
  attributeOptions,
  attributes,
  brands,
  categories,
  categoryAttributes,
  inventory,
  productAttributeValues,
  productVariants,
  products,
} = schema;

function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function createClient() {
  return drizzle(neon(requireEnv("DATABASE_URL")), { schema });
}

type Client = ReturnType<typeof createClient>;

function toStoredRating(rating: number | undefined) {
  return rating === undefined ? null : Math.round(rating * 100);
}

async function seedBrandRows(db: Client) {
  await db
    .insert(brands)
    .values(seedBrands.map((brand) => ({ ...brand, status: "active" as const })))
    .onConflictDoNothing({ target: brands.slug });

  const rows = await db.select({ id: brands.id, slug: brands.slug }).from(brands);

  return new Map(rows.map((row) => [row.slug, row.id]));
}

async function seedCategoryRows(db: Client) {
  const bySlug = new Map(seedCategories.map((category) => [category.slug, category]));

  function depthOf(slug: string, guard = 0): number {
    const category = bySlug.get(slug);

    if (!category?.parent || guard > 8) {
      return 0;
    }

    return depthOf(category.parent, guard + 1) + 1;
  }

  const ordered = [...seedCategories].sort(
    (left, right) => depthOf(left.slug) - depthOf(right.slug),
  );

  const ids = new Map<string, string>();

  for (const category of ordered) {
    const parentId = category.parent ? ids.get(category.parent) : undefined;

    if (category.parent && !parentId) {
      throw new Error(`Category ${category.slug} references unknown parent`);
    }

    await db
      .insert(categories)
      .values({
        description: category.description ?? null,
        icon: category.icon ?? null,
        name: category.name,
        parentId: parentId ?? null,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: "active",
      })
      .onConflictDoNothing({ target: categories.slug });

    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, category.slug))
      .limit(1);

    const id = existing[0]?.id;

    if (!id) {
      throw new Error(`Category ${category.slug} was not persisted`);
    }

    ids.set(category.slug, id);
  }

  return ids;
}

async function seedAttributeRows(db: Client) {
  await db
    .insert(attributes)
    .values(
      seedAttributes.map((attribute) => ({
        isFilterable: attribute.isFilterable,
        isVariantOption: attribute.isVariantOption,
        name: attribute.name,
        slug: attribute.slug,
        sortOrder: attribute.sortOrder,
        type: attribute.type,
        unit: attribute.unit ?? null,
      })),
    )
    .onConflictDoNothing({ target: attributes.slug });

  const rows = await db
    .select({ id: attributes.id, slug: attributes.slug })
    .from(attributes);
  const attributeIds = new Map(rows.map((row) => [row.slug, row.id]));

  const optionValues = seedAttributes.flatMap((attribute) => {
    const attributeId = attributeIds.get(attribute.slug);

    if (!attributeId || !attribute.options) {
      return [];
    }

    return attribute.options.map((value, index) => ({
      attributeId,
      sortOrder: index,
      value,
    }));
  });

  if (optionValues.length > 0) {
    await db.insert(attributeOptions).values(optionValues).onConflictDoNothing();
  }

  const options = await db
    .select({
      attributeId: attributeOptions.attributeId,
      id: attributeOptions.id,
      value: attributeOptions.value,
    })
    .from(attributeOptions);

  const optionIds = new Map<string, string>();
  const slugByAttributeId = new Map([...attributeIds].map(([slug, id]) => [id, slug]));

  for (const option of options) {
    const attributeSlug = slugByAttributeId.get(option.attributeId);

    if (attributeSlug) {
      optionIds.set(`${attributeSlug}::${option.value}`, option.id);
    }
  }

  return { attributeIds, optionIds };
}

async function seedCategoryAttributeRows(
  db: Client,
  categoryIds: Map<string, string>,
  attributeIds: Map<string, string>,
) {
  const rows: {
    attributeId: string;
    categoryId: string;
    isRequired: boolean;
    sortOrder: number;
  }[] = [];

  for (const [categorySlug, attributeSlugs] of Object.entries(seedCategoryAttributes)) {
    const categoryId = categoryIds.get(categorySlug);

    if (!categoryId) {
      throw new Error(`Attribute mapping references unknown category ${categorySlug}`);
    }

    attributeSlugs.forEach((attributeSlug, index) => {
      const attributeId = attributeIds.get(attributeSlug);

      if (!attributeId) {
        throw new Error(
          `Attribute mapping references unknown attribute ${attributeSlug}`,
        );
      }

      rows.push({ attributeId, categoryId, isRequired: false, sortOrder: index });
    });
  }

  if (rows.length > 0) {
    await db.insert(categoryAttributes).values(rows).onConflictDoNothing();
  }

  return rows.length;
}

async function resolveProductSlugs(db: Client) {
  const existing = await db.select({ slug: products.slug }).from(products);
  const taken = new Set(existing.map((row) => row.slug));
  const bySeedName = new Map<string, string>();

  for (const product of seedProducts) {
    const slug = uniqueSlug(product.name, taken);
    taken.add(slug);
    bySeedName.set(product.name, slug);
  }

  return bySeedName;
}

function variantRowsFor(product: SeedProduct, slug: string) {
  const values = product.variantValues ?? [];
  const stock = product.stock;

  if (values.length === 0 || !product.variantAttribute) {
    return [
      {
        available: typeof stock === "number" ? stock : (stock?.[0] ?? 0),
        optionValues: {} as Record<string, string>,
        sku: buildSku([slug, "default"]),
      },
    ];
  }

  return values.map((value, index) => ({
    available: typeof stock === "number" ? stock : (stock?.[index] ?? 0),
    optionValues: { [product.variantAttribute as string]: value },
    sku: buildSku([slug, value]),
  }));
}

async function seedProductRows(
  db: Client,
  context: {
    attributeIds: Map<string, string>;
    brandIds: Map<string, string>;
    categoryIds: Map<string, string>;
    optionIds: Map<string, string>;
  },
) {
  const slugByName = await resolveProductSlugs(db);

  const attributeTypes = new Map(
    seedAttributes.map((attribute) => [attribute.slug, attribute.type]),
  );

  for (const product of seedProducts) {
    const slug = slugByName.get(product.name);
    const brandId = context.brandIds.get(product.brand);
    const categoryId = context.categoryIds.get(product.category);

    if (!slug || !brandId || !categoryId) {
      throw new Error(`Product ${product.name} references unknown brand or category`);
    }

    await db
      .insert(products)
      .values({
        basePrice: toMinorUnits(product.price),
        brandId,
        categoryId,
        comparePrice:
          product.compareAt === undefined ? null : toMinorUnits(product.compareAt),
        description: product.description,
        name: product.name,
        popularity: product.popularity ?? 0,
        rating: toStoredRating(product.rating),
        ratingCount: product.ratingCount ?? 0,
        seoDescription: product.description.slice(0, 155),
        seoTitle: `${product.name} | ShopVerse`,
        slug,
        status: "active",
      })
      .onConflictDoNothing({ target: products.slug });

    const persisted = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    const productId = persisted[0]?.id;

    if (!productId) {
      throw new Error(`Product ${product.name} was not persisted`);
    }

    const attributeRows = Object.entries(product.attributes ?? {}).map(
      ([attributeSlug, value]) => {
        const attributeId = context.attributeIds.get(attributeSlug);
        const type = attributeTypes.get(attributeSlug);

        if (!attributeId || !type) {
          throw new Error(
            `Product ${product.name} references unknown attribute ${attributeSlug}`,
          );
        }

        if (type === "select" || type === "multiselect") {
          const optionId = context.optionIds.get(`${attributeSlug}::${String(value)}`);

          if (!optionId) {
            throw new Error(
              `Product ${product.name} uses undefined option ${attributeSlug}=${String(value)}`,
            );
          }

          return { attributeId, optionId, productId };
        }

        if (type === "number") {
          return { attributeId, productId, valueNumber: Math.round(Number(value)) };
        }

        if (type === "boolean") {
          return { attributeId, productId, valueBoolean: Boolean(value) };
        }

        return { attributeId, productId, valueText: String(value) };
      },
    );

    if (attributeRows.length > 0) {
      await db
        .insert(productAttributeValues)
        .values(attributeRows)
        .onConflictDoNothing();
    }

    const variants = variantRowsFor(product, slug);

    await db
      .insert(productVariants)
      .values(
        variants.map((variant) => ({
          optionValues: variant.optionValues,
          productId,
          sku: variant.sku,
          status: "active" as const,
        })),
      )
      .onConflictDoNothing({ target: productVariants.sku });

    const persistedVariants = await db
      .select({ id: productVariants.id, sku: productVariants.sku })
      .from(productVariants)
      .where(
        inArray(
          productVariants.sku,
          variants.map((variant) => variant.sku),
        ),
      );

    const variantIdBySku = new Map(persistedVariants.map((row) => [row.sku, row.id]));

    const inventoryRows = variants
      .map((variant) => {
        const variantId = variantIdBySku.get(variant.sku);

        return variantId
          ? { available: variant.available, reserved: 0, variantId }
          : null;
      })
      .filter(
        (row): row is { available: number; reserved: number; variantId: string } =>
          row !== null,
      );

    if (inventoryRows.length > 0) {
      await db.insert(inventory).values(inventoryRows).onConflictDoNothing();
    }
  }

  return slugByName.size;
}

export async function seedCatalogue() {
  const db = createClient();

  const brandIds = await seedBrandRows(db);
  const categoryIds = await seedCategoryRows(db);
  const { attributeIds, optionIds } = await seedAttributeRows(db);
  const mappings = await seedCategoryAttributeRows(db, categoryIds, attributeIds);
  const productCount = await seedProductRows(db, {
    attributeIds,
    brandIds,
    categoryIds,
    optionIds,
  });

  return {
    attributes: attributeIds.size,
    brands: brandIds.size,
    categories: categoryIds.size,
    categoryAttributeMappings: mappings,
    options: optionIds.size,
    products: productCount,
  };
}
