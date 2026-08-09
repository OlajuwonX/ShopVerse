CREATE TYPE "public"."campaign_type" AS ENUM('promo_banner', 'video_campaign', 'split_campaign');--> statement-breakpoint
CREATE TYPE "public"."collection_type" AS ENUM('manual', 'dynamic');--> statement-breakpoint
CREATE TYPE "public"."merchandising_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."offer_type" AS ENUM('percentage_off', 'amount_off', 'compare_price', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."storefront_section_type" AS ENUM('product_rail', 'product_grid', 'category_rail', 'collection', 'promo_banner', 'video_campaign', 'split_campaign', 'brand_rail');--> statement-breakpoint
CREATE TYPE "public"."storefront_source_kind" AS ENUM('manual', 'category', 'collection', 'trending', 'offers', 'new_arrivals', 'best_sellers', 'recommended');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"type" "campaign_type" NOT NULL,
	"status" "merchandising_status" DEFAULT 'draft' NOT NULL,
	"image" text,
	"video_public_id" text,
	"href" text,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_sort_order_nonnegative" CHECK ("campaigns"."sort_order" >= 0),
	CONSTRAINT "campaigns_schedule_valid" CHECK ("campaigns"."ends_at" is null or "campaigns"."starts_at" is null or "campaigns"."starts_at" < "campaigns"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "collection_products" (
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_products_sort_order_nonnegative" CHECK ("collection_products"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image" text,
	"type" "collection_type" DEFAULT 'manual' NOT NULL,
	"rules" jsonb,
	"status" "merchandising_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_sort_order_nonnegative" CHECK ("collections"."sort_order" >= 0),
	CONSTRAINT "collections_schedule_valid" CHECK ("collections"."ends_at" is null or "collections"."starts_at" is null or "collections"."starts_at" < "collections"."ends_at"),
	CONSTRAINT "collections_dynamic_rules_required" CHECK (("collections"."type" = 'dynamic' and "collections"."rules" is not null) or ("collections"."type" = 'manual'))
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"type" "offer_type" NOT NULL,
	"status" "merchandising_status" DEFAULT 'draft' NOT NULL,
	"value" integer,
	"collection_id" uuid,
	"product_id" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_value_nonnegative" CHECK ("offers"."value" is null or "offers"."value" >= 0),
	CONSTRAINT "offers_schedule_valid" CHECK ("offers"."ends_at" is null or "offers"."starts_at" is null or "offers"."starts_at" < "offers"."ends_at"),
	CONSTRAINT "offers_single_scope" CHECK (num_nonnulls("offers"."collection_id", "offers"."product_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "storefront_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"type" "storefront_section_type" NOT NULL,
	"source_kind" "storefront_source_kind" NOT NULL,
	"source_ref" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"view_more_href" text,
	"desktop_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mobile_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"campaign_id" uuid,
	"collection_id" uuid,
	"category_id" uuid,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_sections_sort_order_nonnegative" CHECK ("storefront_sections"."sort_order" >= 0),
	CONSTRAINT "storefront_sections_schedule_valid" CHECK ("storefront_sections"."ends_at" is null or "storefront_sections"."starts_at" is null or "storefront_sections"."starts_at" < "storefront_sections"."ends_at"),
	CONSTRAINT "storefront_sections_single_bound_source" CHECK (num_nonnulls("storefront_sections"."campaign_id", "storefront_sections"."collection_id", "storefront_sections"."category_id", "storefront_sections"."brand_id") <= 1)
);
--> statement-breakpoint
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_slug_unique" ON "campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "campaigns_status_schedule_idx" ON "campaigns" USING btree ("status","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_products_unique" ON "collection_products" USING btree ("collection_id","product_id");--> statement-breakpoint
CREATE INDEX "collection_products_collection_sort_idx" ON "collection_products" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX "collection_products_product_idx" ON "collection_products" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_slug_unique" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "collections_status_sort_idx" ON "collections" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "collections_schedule_idx" ON "collections" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_slug_unique" ON "offers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "offers_status_schedule_idx" ON "offers" USING btree ("status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "offers_collection_idx" ON "offers" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "offers_product_idx" ON "offers" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "storefront_sections_slug_unique" ON "storefront_sections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "storefront_sections_active_sort_idx" ON "storefront_sections" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "storefront_sections_schedule_idx" ON "storefront_sections" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "storefront_sections_source_idx" ON "storefront_sections" USING btree ("source_kind","source_ref");