CREATE TYPE "public"."activity_actor_type" AS ENUM('staff', 'customer', 'system');--> statement-breakpoint
CREATE TYPE "public"."inventory_reservation_status" AS ENUM('active', 'consumed', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."order_address_type" AS ENUM('delivery');--> statement-breakpoint
CREATE TYPE "public"."order_event_type" AS ENUM('created', 'status_changed', 'payment_updated', 'inventory_updated', 'note_added', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('awaiting_payment', 'confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('paystack');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initialized', 'pending', 'processing', 'succeeded', 'failed', 'abandoned', 'reversed', 'refunded', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."payment_verification_source" AS ENUM('webhook', 'callback', 'reconciliation', 'manual');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_reason" AS ENUM('reservation_created', 'reservation_consumed', 'reservation_released', 'reservation_expired', 'admin_adjustment', 'cancellation', 'reconciliation');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_type" "activity_actor_type" NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_logs_non_system_actor_required" CHECK (("activity_logs"."actor_type" = 'system' and "activity_logs"."actor_id" is null) or ("activity_logs"."actor_type" <> 'system' and "activity_logs"."actor_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" "inventory_reservation_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_reservations_quantity_positive" CHECK ("inventory_reservations"."quantity" > 0),
	CONSTRAINT "inventory_reservations_expiry_valid" CHECK ("inventory_reservations"."created_at" < "inventory_reservations"."expires_at")
);
--> statement-breakpoint
CREATE TABLE "order_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "order_address_type" DEFAULT 'delivery' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text DEFAULT 'NG' NOT NULL,
	"postal_code" text,
	"landmark" text,
	"instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "order_event_type" NOT NULL,
	"actor_staff_id" uuid,
	"from_status" "order_status",
	"to_status" "order_status",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"variant_selection" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unit_price" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" integer NOT NULL,
	"image_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_unit_price_nonnegative" CHECK ("order_items"."unit_price" >= 0),
	CONSTRAINT "order_items_discount_nonnegative" CHECK ("order_items"."discount" >= 0),
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_line_total_nonnegative" CHECK ("order_items"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_profile_id" uuid,
	"guest_email" text,
	"status" "order_status" DEFAULT 'awaiting_payment' NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"subtotal" integer NOT NULL,
	"discount_total" integer DEFAULT 0 NOT NULL,
	"delivery_total" integer DEFAULT 0 NOT NULL,
	"grand_total" integer NOT NULL,
	"checkout_attempt_id" text NOT NULL,
	"placed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_subtotal_nonnegative" CHECK ("orders"."subtotal" >= 0),
	CONSTRAINT "orders_discount_total_nonnegative" CHECK ("orders"."discount_total" >= 0),
	CONSTRAINT "orders_delivery_total_nonnegative" CHECK ("orders"."delivery_total" >= 0),
	CONSTRAINT "orders_grand_total_nonnegative" CHECK ("orders"."grand_total" >= 0),
	CONSTRAINT "orders_customer_or_guest_email" CHECK ("orders"."customer_profile_id" is not null or "orders"."guest_email" is not null)
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"checkout_attempt_id" text NOT NULL,
	"reference" text NOT NULL,
	"provider_transaction_id" text,
	"provider" "payment_provider" DEFAULT 'paystack' NOT NULL,
	"expected_amount" integer NOT NULL,
	"received_amount" integer,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" "payment_status" DEFAULT 'initialized' NOT NULL,
	"verification_source" "payment_verification_source",
	"last_verified_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_expected_amount_nonnegative" CHECK ("payment_attempts"."expected_amount" >= 0),
	CONSTRAINT "payment_attempts_received_amount_nonnegative" CHECK ("payment_attempts"."received_amount" is null or "payment_attempts"."received_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_attempt_id" uuid,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"before" integer NOT NULL,
	"after" integer NOT NULL,
	"reason" "stock_movement_reason" NOT NULL,
	"order_id" uuid,
	"actor_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_delta_nonzero" CHECK ("stock_movements"."delta" <> 0),
	CONSTRAINT "stock_movements_before_nonnegative" CHECK ("stock_movements"."before" >= 0),
	CONSTRAINT "stock_movements_after_nonnegative" CHECK ("stock_movements"."after" >= 0),
	CONSTRAINT "stock_movements_delta_matches" CHECK ("stock_movements"."after" = "stock_movements"."before" + "stock_movements"."delta")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_addresses" ADD CONSTRAINT "order_addresses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_staff_id_staff_accounts_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_staff_id_staff_accounts_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "activity_logs_actor_created_idx" ON "activity_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_target_created_idx" ON "activity_logs" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_action_created_idx" ON "activity_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_request_idx" ON "activity_logs" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservations_order_variant_unique" ON "inventory_reservations" USING btree ("order_id","variant_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_variant_status_idx" ON "inventory_reservations" USING btree ("variant_id","status");--> statement-breakpoint
CREATE INDEX "inventory_reservations_status_expires_idx" ON "inventory_reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_addresses_order_type_unique" ON "order_addresses" USING btree ("order_id","type");--> statement-breakpoint
CREATE INDEX "order_addresses_email_idx" ON "order_addresses" USING btree ("email");--> statement-breakpoint
CREATE INDEX "order_events_order_created_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_events_actor_idx" ON "order_events" USING btree ("actor_staff_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_unique" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_checkout_attempt_unique" ON "orders" USING btree ("checkout_attempt_id");--> statement-breakpoint
CREATE INDEX "orders_customer_status_idx" ON "orders" USING btree ("customer_profile_id","status");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_order_unique" ON "payment_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_checkout_attempt_unique" ON "payment_attempts" USING btree ("checkout_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_reference_unique" ON "payment_attempts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_transaction_unique" ON "payment_attempts" USING btree ("provider_transaction_id") WHERE "payment_attempts"."provider_transaction_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_attempts_status_created_idx" ON "payment_attempts" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "payment_attempts_order_status_idx" ON "payment_attempts" USING btree ("order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_unique" ON "payment_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_events_attempt_received_idx" ON "payment_events" USING btree ("payment_attempt_id","received_at");--> statement-breakpoint
CREATE INDEX "payment_events_processed_idx" ON "payment_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "stock_movements_variant_created_idx" ON "stock_movements" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_order_idx" ON "stock_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "stock_movements_actor_idx" ON "stock_movements" USING btree ("actor_staff_id");