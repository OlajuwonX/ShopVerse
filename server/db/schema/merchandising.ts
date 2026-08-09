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
} from "drizzle-orm/pg-core";

import { brands, categories, products } from "@/server/db/schema/catalogue";
import { id, timestamps } from "@/server/db/schema/shared";

export const merchandisingStatus = pgEnum("merchandising_status", [
  "draft",
  "active",
  "archived",
]);

export const collectionType = pgEnum("collection_type", ["manual", "dynamic"]);

export const storefrontSectionType = pgEnum("storefront_section_type", [
  "product_rail",
  "product_grid",
  "category_rail",
  "collection",
  "promo_banner",
  "video_campaign",
  "split_campaign",
  "brand_rail",
]);

export const storefrontSourceKind = pgEnum("storefront_source_kind", [
  "manual",
  "category",
  "collection",
  "trending",
  "offers",
  "new_arrivals",
  "best_sellers",
  "recommended",
]);

export const campaignType = pgEnum("campaign_type", [
  "promo_banner",
  "video_campaign",
  "split_campaign",
]);

export const offerType = pgEnum("offer_type", [
  "percentage_off",
  "amount_off",
  "compare_price",
  "free_shipping",
]);

export const collections = pgTable(
  "collections",
  {
    id,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    image: text("image"),
    type: collectionType("type").notNull().default("manual"),
    rules: jsonb("rules"),
    status: merchandisingStatus("status").notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("collections_slug_unique").on(table.slug),
    index("collections_status_sort_idx").on(table.status, table.sortOrder),
    index("collections_schedule_idx").on(table.startsAt, table.endsAt),
    check("collections_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
    check(
      "collections_schedule_valid",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.startsAt} < ${table.endsAt}`,
    ),
    check(
      "collections_dynamic_rules_required",
      sql`(${table.type} = 'dynamic' and ${table.rules} is not null) or (${table.type} = 'manual')`,
    ),
  ],
);

export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("collection_products_unique").on(table.collectionId, table.productId),
    index("collection_products_collection_sort_idx").on(
      table.collectionId,
      table.sortOrder,
    ),
    index("collection_products_product_idx").on(table.productId),
    check("collection_products_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id,
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    type: campaignType("type").notNull(),
    status: merchandisingStatus("status").notNull().default("draft"),
    image: text("image"),
    videoPublicId: text("video_public_id"),
    href: text("href"),
    content: jsonb("content")
      .notNull()
      .default(sql`'{}'::jsonb`),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaigns_slug_unique").on(table.slug),
    index("campaigns_status_schedule_idx").on(
      table.status,
      table.startsAt,
      table.endsAt,
    ),
    check("campaigns_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
    check(
      "campaigns_schedule_valid",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.startsAt} < ${table.endsAt}`,
    ),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id,
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    type: offerType("type").notNull(),
    status: merchandisingStatus("status").notNull().default("draft"),
    value: integer("value"),
    collectionId: uuid("collection_id").references(() => collections.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("offers_slug_unique").on(table.slug),
    index("offers_status_schedule_idx").on(table.status, table.startsAt, table.endsAt),
    index("offers_collection_idx").on(table.collectionId),
    index("offers_product_idx").on(table.productId),
    check(
      "offers_value_nonnegative",
      sql`${table.value} is null or ${table.value} >= 0`,
    ),
    check(
      "offers_schedule_valid",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.startsAt} < ${table.endsAt}`,
    ),
    check(
      "offers_single_scope",
      sql`num_nonnulls(${table.collectionId}, ${table.productId}) <= 1`,
    ),
  ],
);

export const storefrontSections = pgTable(
  "storefront_sections",
  {
    id,
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    type: storefrontSectionType("type").notNull(),
    sourceKind: storefrontSourceKind("source_kind").notNull(),
    sourceRef: text("source_ref"),
    isActive: boolean("is_active").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    viewMoreHref: text("view_more_href"),
    desktopConfig: jsonb("desktop_config")
      .notNull()
      .default(sql`'{}'::jsonb`),
    mobileConfig: jsonb("mobile_config")
      .notNull()
      .default(sql`'{}'::jsonb`),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    collectionId: uuid("collection_id").references(() => collections.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("storefront_sections_slug_unique").on(table.slug),
    index("storefront_sections_active_sort_idx").on(table.isActive, table.sortOrder),
    index("storefront_sections_schedule_idx").on(table.startsAt, table.endsAt),
    index("storefront_sections_source_idx").on(table.sourceKind, table.sourceRef),
    check("storefront_sections_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
    check(
      "storefront_sections_schedule_valid",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.startsAt} < ${table.endsAt}`,
    ),
    check(
      "storefront_sections_single_bound_source",
      sql`num_nonnulls(${table.campaignId}, ${table.collectionId}, ${table.categoryId}, ${table.brandId}) <= 1`,
    ),
  ],
);
