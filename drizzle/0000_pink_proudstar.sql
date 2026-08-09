CREATE TYPE "public"."attribute_type" AS ENUM('text', 'number', 'boolean', 'select', 'multiselect', 'range');--> statement-breakpoint
CREATE TYPE "public"."catalogue_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "attribute_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "attribute_type" NOT NULL,
	"unit" text,
	"is_filterable" boolean DEFAULT false NOT NULL,
	"is_variant_option" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attributes_sort_order_nonnegative" CHECK ("attributes"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"status" "catalogue_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"description" text,
	"image" text,
	"icon" text,
	"status" "catalogue_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_not_own_parent" CHECK ("categories"."parent_id" is null or "categories"."parent_id" <> "categories"."id")
);
--> statement-breakpoint
CREATE TABLE "category_attributes" (
	"category_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_available_nonnegative" CHECK ("inventory"."available" >= 0),
	CONSTRAINT "inventory_reserved_nonnegative" CHECK ("inventory"."reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"option_id" uuid,
	"value_text" text,
	"value_number" integer,
	"value_boolean" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_attribute_values_one_value" CHECK (num_nonnulls("product_attribute_values"."option_id", "product_attribute_values"."value_text", "product_attribute_values"."value_number", "product_attribute_values"."value_boolean") = 1)
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_width_positive" CHECK ("product_images"."width" > 0),
	CONSTRAINT "product_images_height_positive" CHECK ("product_images"."height" > 0),
	CONSTRAINT "product_images_sort_order_nonnegative" CHECK ("product_images"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"option_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price" integer,
	"compare_price" integer,
	"status" "catalogue_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_price_nonnegative" CHECK ("product_variants"."price" is null or "product_variants"."price" >= 0),
	CONSTRAINT "product_variants_compare_price_nonnegative" CHECK ("product_variants"."compare_price" is null or "product_variants"."compare_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"brand_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"status" "catalogue_status" DEFAULT 'draft' NOT NULL,
	"base_price" integer NOT NULL,
	"compare_price" integer,
	"rating" integer,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_base_price_nonnegative" CHECK ("products"."base_price" >= 0),
	CONSTRAINT "products_compare_price_nonnegative" CHECK ("products"."compare_price" is null or "products"."compare_price" >= 0),
	CONSTRAINT "products_rating_range" CHECK ("products"."rating" is null or ("products"."rating" >= 0 and "products"."rating" <= 500)),
	CONSTRAINT "products_rating_count_nonnegative" CHECK ("products"."rating_count" >= 0),
	CONSTRAINT "products_popularity_nonnegative" CHECK ("products"."popularity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_option_id_attribute_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_options"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_options_attribute_value_unique" ON "attribute_options" USING btree ("attribute_id","value");--> statement-breakpoint
CREATE INDEX "attribute_options_attribute_sort_idx" ON "attribute_options" USING btree ("attribute_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_slug_unique" ON "attributes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "attributes_filterable_idx" ON "attributes" USING btree ("is_filterable");--> statement-breakpoint
CREATE INDEX "attributes_variant_option_idx" ON "attributes" USING btree ("is_variant_option");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_unique" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "brands_status_idx" ON "brands" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_sort_idx" ON "categories" USING btree ("parent_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "categories_status_idx" ON "categories" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "category_attributes_unique" ON "category_attributes" USING btree ("category_id","attribute_id");--> statement-breakpoint
CREATE INDEX "category_attributes_category_sort_idx" ON "category_attributes" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "inventory_available_idx" ON "inventory" USING btree ("available");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_values_unique" ON "product_attribute_values" USING btree ("product_id","attribute_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_attribute_option_idx" ON "product_attribute_values" USING btree ("attribute_id","option_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_attribute_number_idx" ON "product_attribute_values" USING btree ("attribute_id","value_number");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_cloudinary_public_id_unique" ON "product_images" USING btree ("cloudinary_public_id");--> statement-breakpoint
CREATE INDEX "product_images_product_sort_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_one_primary_per_product" ON "product_images" USING btree ("product_id") WHERE "product_images"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_unique" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_status_idx" ON "product_variants" USING btree ("product_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_status_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "products_brand_status_idx" ON "products" USING btree ("brand_id","status");--> statement-breakpoint
CREATE INDEX "products_status_created_idx" ON "products" USING btree ("status","created_at","id");