import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "@/server/db/schema/shared";

export const catalogueStatus = pgEnum("catalogue_status", [
  "draft",
  "active",
  "archived",
]);
export const attributeType = pgEnum("attribute_type", [
  "text",
  "number",
  "boolean",
  "select",
  "multiselect",
  "range",
]);

export const brands = pgTable(
  "brands",
  {
    id,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    status: catalogueStatus("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("brands_slug_unique").on(table.slug),
    index("brands_status_idx").on(table.status),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    description: text("description"),
    image: text("image"),
    icon: text("icon"),
    status: catalogueStatus("status").notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_parent_sort_idx").on(table.parentId, table.sortOrder, table.name),
    index("categories_status_idx").on(table.status),
    check(
      "categories_not_own_parent",
      sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
    ),
  ],
);

export const attributes = pgTable(
  "attributes",
  {
    id,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: attributeType("type").notNull(),
    unit: text("unit"),
    isFilterable: boolean("is_filterable").notNull().default(false),
    isVariantOption: boolean("is_variant_option").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("attributes_slug_unique").on(table.slug),
    index("attributes_filterable_idx").on(table.isFilterable),
    index("attributes_variant_option_idx").on(table.isVariantOption),
    check("attributes_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const attributeOptions = pgTable(
  "attribute_options",
  {
    id,
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => attributes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("attribute_options_attribute_value_unique").on(
      table.attributeId,
      table.value,
    ),
    index("attribute_options_attribute_sort_idx").on(
      table.attributeId,
      table.sortOrder,
    ),
  ],
);

export const categoryAttributes = pgTable(
  "category_attributes",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => attributes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    isRequired: boolean("is_required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("category_attributes_unique").on(table.categoryId, table.attributeId),
    index("category_attributes_category_sort_idx").on(
      table.categoryId,
      table.sortOrder,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id,
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict", onUpdate: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: catalogueStatus("status").notNull().default("draft"),
    basePrice: integer("base_price").notNull(),
    comparePrice: integer("compare_price"),
    rating: integer("rating"),
    ratingCount: integer("rating_count").notNull().default(0),
    popularity: integer("popularity").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    index("products_category_status_idx").on(table.categoryId, table.status),
    index("products_brand_status_idx").on(table.brandId, table.status),
    index("products_status_created_idx").on(table.status, table.createdAt, table.id),
    check("products_base_price_nonnegative", sql`${table.basePrice} >= 0`),
    check(
      "products_compare_price_nonnegative",
      sql`${table.comparePrice} is null or ${table.comparePrice} >= 0`,
    ),
    check(
      "products_rating_range",
      sql`${table.rating} is null or (${table.rating} >= 0 and ${table.rating} <= 500)`,
    ),
    check("products_rating_count_nonnegative", sql`${table.ratingCount} >= 0`),
    check("products_popularity_nonnegative", sql`${table.popularity} >= 0`),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id,
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sku: text("sku").notNull(),
    optionValues: jsonb("option_values")
      .notNull()
      .default(sql`'{}'::jsonb`),
    price: integer("price"),
    comparePrice: integer("compare_price"),
    status: catalogueStatus("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_variants_sku_unique").on(table.sku),
    index("product_variants_product_status_idx").on(table.productId, table.status),
    check(
      "product_variants_price_nonnegative",
      sql`${table.price} is null or ${table.price} >= 0`,
    ),
    check(
      "product_variants_compare_price_nonnegative",
      sql`${table.comparePrice} is null or ${table.comparePrice} >= 0`,
    ),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id,
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    cloudinaryPublicId: text("cloudinary_public_id").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    alt: text("alt").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_images_cloudinary_public_id_unique").on(
      table.cloudinaryPublicId,
    ),
    index("product_images_product_sort_idx").on(table.productId, table.sortOrder),
    uniqueIndex("product_images_one_primary_per_product")
      .on(table.productId)
      .where(sql`${table.isPrimary} = true`),
    check("product_images_width_positive", sql`${table.width} > 0`),
    check("product_images_height_positive", sql`${table.height} > 0`),
    check("product_images_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const productAttributeValues = pgTable(
  "product_attribute_values",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => attributes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    optionId: uuid("option_id").references(() => attributeOptions.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    valueText: text("value_text"),
    valueNumber: integer("value_number"),
    valueBoolean: boolean("value_boolean"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_attribute_values_unique").on(
      table.productId,
      table.attributeId,
    ),
    index("product_attribute_values_attribute_option_idx").on(
      table.attributeId,
      table.optionId,
    ),
    index("product_attribute_values_attribute_number_idx").on(
      table.attributeId,
      table.valueNumber,
    ),
    check(
      "product_attribute_values_one_value",
      sql`num_nonnulls(${table.optionId}, ${table.valueText}, ${table.valueNumber}, ${table.valueBoolean}) = 1`,
    ),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    variantId: uuid("variant_id")
      .primaryKey()
      .references(() => productVariants.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    available: integer("available").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inventory_available_idx").on(table.available),
    check("inventory_available_nonnegative", sql`${table.available} >= 0`),
    check("inventory_reserved_nonnegative", sql`${table.reserved} >= 0`),
  ],
);
