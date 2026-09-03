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

import { customerProfiles, staffAccounts, users } from "@/server/db/schema/auth";
import { productVariants, products } from "@/server/db/schema/catalogue";
import { id, timestamps } from "@/server/db/schema/shared";

export const orderStatus = pgEnum("order_status", [
  "awaiting_payment",
  "confirmed",
  "processing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
  "cancelled",
]);

export const orderAddressType = pgEnum("order_address_type", ["delivery"]);

export const orderEventType = pgEnum("order_event_type", [
  "created",
  "status_changed",
  "payment_updated",
  "inventory_updated",
  "note_added",
  "cancelled",
]);

export const paymentProvider = pgEnum("payment_provider", ["paystack"]);

export const paymentStatus = pgEnum("payment_status", [
  "initialized",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "abandoned",
  "reversed",
  "refunded",
  "needs_review",
]);

export const paymentVerificationSource = pgEnum("payment_verification_source", [
  "webhook",
  "callback",
  "reconciliation",
  "manual",
]);

export const inventoryReservationStatus = pgEnum("inventory_reservation_status", [
  "active",
  "consumed",
  "released",
  "expired",
]);

export const stockMovementReason = pgEnum("stock_movement_reason", [
  "reservation_created",
  "reservation_consumed",
  "reservation_released",
  "reservation_expired",
  "admin_adjustment",
  "cancellation",
  "reconciliation",
]);

export const activityActorType = pgEnum("activity_actor_type", [
  "staff",
  "customer",
  "system",
]);

export const orders = pgTable(
  "orders",
  {
    id,
    reference: text("reference").notNull(),
    customerProfileId: uuid("customer_profile_id").references(
      () => customerProfiles.id,
      {
        onDelete: "restrict",
        onUpdate: "cascade",
      },
    ),
    guestEmail: text("guest_email"),
    status: orderStatus("status").notNull().default("awaiting_payment"),
    currency: text("currency").notNull().default("NGN"),
    subtotal: integer("subtotal").notNull(),
    discountTotal: integer("discount_total").notNull().default(0),
    deliveryTotal: integer("delivery_total").notNull().default(0),
    grandTotal: integer("grand_total").notNull(),
    checkoutAttemptId: text("checkout_attempt_id").notNull(),
    placedAt: timestamp("placed_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_reference_unique").on(table.reference),
    uniqueIndex("orders_checkout_attempt_unique").on(table.checkoutAttemptId),
    index("orders_customer_status_idx").on(table.customerProfileId, table.status),
    index("orders_status_created_idx").on(table.status, table.createdAt, table.id),
    check("orders_subtotal_nonnegative", sql`${table.subtotal} >= 0`),
    check("orders_discount_total_nonnegative", sql`${table.discountTotal} >= 0`),
    check("orders_delivery_total_nonnegative", sql`${table.deliveryTotal} >= 0`),
    check("orders_grand_total_nonnegative", sql`${table.grandTotal} >= 0`),
    check(
      "orders_customer_or_guest_email",
      sql`${table.customerProfileId} is not null or ${table.guestEmail} is not null`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id,
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    variantSelection: jsonb("variant_selection")
      .notNull()
      .default(sql`'{}'::jsonb`),
    unitPrice: integer("unit_price").notNull(),
    discount: integer("discount").notNull().default(0),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
    imageRef: text("image_ref"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_product_idx").on(table.productId),
    index("order_items_variant_idx").on(table.variantId),
    check("order_items_unit_price_nonnegative", sql`${table.unitPrice} >= 0`),
    check("order_items_discount_nonnegative", sql`${table.discount} >= 0`),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_items_line_total_nonnegative", sql`${table.lineTotal} >= 0`),
  ],
);

export const orderAddresses = pgTable(
  "order_addresses",
  {
    id,
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    type: orderAddressType("type").notNull().default("delivery"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    country: text("country").notNull().default("NG"),
    postalCode: text("postal_code"),
    landmark: text("landmark"),
    instructions: text("instructions"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("order_addresses_order_type_unique").on(table.orderId, table.type),
    index("order_addresses_email_idx").on(table.email),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id,
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    type: orderEventType("type").notNull(),
    actorStaffId: uuid("actor_staff_id").references(() => staffAccounts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status"),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("order_events_order_created_idx").on(table.orderId, table.createdAt),
    index("order_events_actor_idx").on(table.actorStaffId),
  ],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id,
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    checkoutAttemptId: text("checkout_attempt_id").notNull(),
    reference: text("reference").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    authorizationUrl: text("authorization_url"),
    provider: paymentProvider("provider").notNull().default("paystack"),
    expectedAmount: integer("expected_amount").notNull(),
    receivedAmount: integer("received_amount"),
    currency: text("currency").notNull().default("NGN"),
    status: paymentStatus("status").notNull().default("initialized"),
    verificationSource: paymentVerificationSource("verification_source"),
    lastVerifiedAt: timestamp("last_verified_at", {
      mode: "date",
      withTimezone: true,
    }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_attempts_order_live_unique")
      .on(table.orderId)
      .where(sql`${table.status} in ('initialized', 'pending', 'processing')`),
    index("payment_attempts_checkout_attempt_idx").on(table.checkoutAttemptId),
    uniqueIndex("payment_attempts_reference_unique").on(table.reference),
    uniqueIndex("payment_attempts_provider_transaction_unique")
      .on(table.providerTransactionId)
      .where(sql`${table.providerTransactionId} is not null`),
    index("payment_attempts_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index("payment_attempts_order_status_idx").on(table.orderId, table.status),
    check(
      "payment_attempts_expected_amount_nonnegative",
      sql`${table.expectedAmount} >= 0`,
    ),
    check(
      "payment_attempts_received_amount_nonnegative",
      sql`${table.receivedAmount} is null or ${table.receivedAmount} >= 0`,
    ),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id,
    paymentAttemptId: uuid("payment_attempt_id").references(() => paymentAttempts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    signatureValid: boolean("signature_valid").notNull().default(false),
    rawPayload: jsonb("raw_payload").notNull(),
    receivedAt: timestamp("received_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payment_events_provider_event_unique").on(table.providerEventId),
    index("payment_events_attempt_received_idx").on(
      table.paymentAttemptId,
      table.receivedAt,
    ),
    index("payment_events_processed_idx").on(table.processedAt),
  ],
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id,
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantity: integer("quantity").notNull(),
    status: inventoryReservationStatus("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("inventory_reservations_order_variant_unique").on(
      table.orderId,
      table.variantId,
    ),
    index("inventory_reservations_variant_status_idx").on(
      table.variantId,
      table.status,
    ),
    index("inventory_reservations_status_expires_idx").on(
      table.status,
      table.expiresAt,
    ),
    check("inventory_reservations_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "inventory_reservations_expiry_valid",
      sql`${table.createdAt} < ${table.expiresAt}`,
    ),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id,
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    delta: integer("delta").notNull(),
    before: integer("before").notNull(),
    after: integer("after").notNull(),
    reason: stockMovementReason("reason").notNull(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    actorStaffId: uuid("actor_staff_id").references(() => staffAccounts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_movements_variant_created_idx").on(table.variantId, table.createdAt),
    index("stock_movements_order_idx").on(table.orderId),
    index("stock_movements_actor_idx").on(table.actorStaffId),
    check("stock_movements_delta_nonzero", sql`${table.delta} <> 0`),
    check("stock_movements_before_nonnegative", sql`${table.before} >= 0`),
    check("stock_movements_after_nonnegative", sql`${table.after} >= 0`),
    check(
      "stock_movements_delta_matches",
      sql`${table.after} = ${table.before} + ${table.delta}`,
    ),
  ],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id,
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    actorType: activityActorType("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activity_logs_actor_created_idx").on(table.actorId, table.createdAt),
    index("activity_logs_target_created_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index("activity_logs_action_created_idx").on(table.action, table.createdAt),
    index("activity_logs_request_idx").on(table.requestId),
    check(
      "activity_logs_non_system_actor_required",
      sql`(${table.actorType} = 'system' and ${table.actorId} is null) or (${table.actorType} <> 'system' and ${table.actorId} is not null)`,
    ),
  ],
);
