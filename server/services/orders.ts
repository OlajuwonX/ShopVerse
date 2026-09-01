import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { CART_MAX_LINE_QUANTITY, CART_MAX_LINES } from "@/constants/cart";
import { RESERVATION_MINUTES } from "@/constants/orders";
import type { CartLineInput } from "@/features/cart/schemas/cart";
import type { DeliveryDetails } from "@/features/checkout/schemas/checkout";
import { createOrderReference, createPaymentReference } from "@/lib/order-reference";
import { db } from "@/server/db";
import {
  inventory,
  inventoryReservations,
  orderAddresses,
  orderEvents,
  orderItems,
  orders,
  paymentAttempts,
  productVariants,
  products,
  stockMovements,
} from "@/server/db/schema";
import { getTransactionalDb, type Transaction } from "@/server/db/transactional";
import { quoteDelivery } from "@/server/services/delivery";
import { resolveProductPrice } from "@/server/services/products";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

export type OrderSummary = {
  currency: string;
  deliveryTotal: number;
  grandTotal: number;
  id: string;
  paymentReference: string;
  reference: string;
  status: string;
  subtotal: number;
};

export type CreateOrderIssue = {
  code: "PRODUCT_UNAVAILABLE" | "VARIANT_UNAVAILABLE" | "INSUFFICIENT_STOCK";
  available?: number;
  productId: string;
  productName?: string;
  requested: number;
  variantId: string;
};

export type CreateOrderResult =
  | { order: OrderSummary; status: "created" }
  | { order: OrderSummary; status: "replayed" }
  | { issues: CreateOrderIssue[]; status: "unavailable" }
  | { acknowledged: number; current: number; status: "price_changed" }
  | { reason: string; status: "rejected" };

export type CreateOrderInput = {
  acknowledgedTotal: number;
  checkoutAttemptId: string;
  delivery: DeliveryDetails;
  lines: readonly CartLineInput[];
};

class UnavailableError extends Error {
  readonly issues: CreateOrderIssue[];

  constructor(issues: CreateOrderIssue[]) {
    super("Cart is not purchasable");
    this.name = "UnavailableError";
    this.issues = issues;
  }
}

class RejectedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "RejectedError";
  }
}

class PriceChangedError extends Error {
  readonly acknowledged: number;
  readonly current: number;

  constructor(acknowledged: number, current: number) {
    super("The total changed since the customer last saw it");
    this.name = "PriceChangedError";
    this.acknowledged = acknowledged;
    this.current = current;
  }
}

function errorField(error: unknown, field: "code" | "constraint"): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const value = (current as Record<string, unknown>)[field];

      if (typeof value === "string") {
        return value;
      }

      current = (current as { cause?: unknown }).cause;

      continue;
    }

    return null;
  }

  return null;
}

const IDEMPOTENCY_CONSTRAINTS = new Set([
  "orders_checkout_attempt_unique",
  "payment_attempts_checkout_attempt_unique",
]);

async function findByAttempt(
  attemptId: string,
  guestEmail: string,
): Promise<OrderSummary | null> {
  const rows = await db
    .select({
      currency: orders.currency,
      deliveryTotal: orders.deliveryTotal,
      grandTotal: orders.grandTotal,
      id: orders.id,
      paymentReference: paymentAttempts.reference,
      reference: orders.reference,
      status: orders.status,
      subtotal: orders.subtotal,
    })
    .from(orders)
    .innerJoin(paymentAttempts, eq(paymentAttempts.orderId, orders.id))
    .where(
      and(eq(orders.checkoutAttemptId, attemptId), eq(orders.guestEmail, guestEmail)),
    )
    .limit(1);

  return rows[0] ?? null;
}

type PricedLine = {
  imageRef: string | null;
  optionValues: Record<string, string>;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  unitPrice: number;
  variantId: string;
};

async function priceLines(
  tx: Transaction,
  lines: readonly CartLineInput[],
): Promise<PricedLine[]> {
  const rows = await tx
    .select({
      basePrice: products.basePrice,
      comparePrice: products.comparePrice,
      optionValues: productVariants.optionValues,
      productId: products.id,
      productName: products.name,
      productStatus: products.status,
      sku: productVariants.sku,
      variantComparePrice: productVariants.comparePrice,
      variantId: productVariants.id,
      variantPrice: productVariants.price,
      variantStatus: productVariants.status,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, [...new Set(lines.map((l) => l.variantId))]))
    .limit(lines.length);

  const byVariant = new Map(rows.map((row) => [row.variantId, row]));
  const issues: CreateOrderIssue[] = [];
  const priced: PricedLine[] = [];

  for (const line of lines) {
    const row = byVariant.get(line.variantId);

    if (!row || row.productId !== line.productId || row.productStatus !== "active") {
      issues.push({
        code: "PRODUCT_UNAVAILABLE",
        productId: line.productId,
        requested: line.quantity,
        variantId: line.variantId,
      });

      continue;
    }

    if (row.variantStatus !== "active") {
      issues.push({
        code: "VARIANT_UNAVAILABLE",
        productId: row.productId,
        productName: row.productName,
        requested: line.quantity,
        variantId: row.variantId,
      });

      continue;
    }

    const price = resolveProductPrice({
      basePrice: row.basePrice,
      comparePrice: row.comparePrice,
      variantComparePrice: row.variantComparePrice,
      variantPrice: row.variantPrice,
    });

    priced.push({
      imageRef: null,
      optionValues: (row.optionValues ?? {}) as Record<string, string>,
      productId: row.productId,
      productName: row.productName,
      quantity: line.quantity,
      sku: row.sku,
      unitPrice: price.price,
      variantId: row.variantId,
    });
  }

  if (issues.length > 0) {
    throw new UnavailableError(issues);
  }

  return priced;
}

async function reserveLines(
  tx: Transaction,
  priced: readonly PricedLine[],
  orderId: string,
  expiresAt: Date,
) {
  const reservations: {
    expiresAt: Date;
    orderId: string;
    quantity: number;
    status: "active";
    variantId: string;
  }[] = [];

  const movements: {
    after: number;
    before: number;
    delta: number;
    orderId: string;
    reason: "reservation_created";
    variantId: string;
  }[] = [];

  for (const line of priced) {
    const reserved = await tx
      .update(inventory)
      .set({
        available: sql`${inventory.available} - ${line.quantity}`,
        reserved: sql`${inventory.reserved} + ${line.quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventory.variantId, line.variantId),
          sql`${inventory.available} >= ${line.quantity}`,
        ),
      )
      .returning({ available: inventory.available });

    const after = reserved[0]?.available;

    if (after === undefined) {
      const current = await tx
        .select({ available: inventory.available })
        .from(inventory)
        .where(eq(inventory.variantId, line.variantId))
        .limit(1);

      throw new UnavailableError([
        {
          available: current[0]?.available ?? 0,
          code: "INSUFFICIENT_STOCK",
          productId: line.productId,
          productName: line.productName,
          requested: line.quantity,
          variantId: line.variantId,
        },
      ]);
    }

    reservations.push({
      expiresAt,
      orderId,
      quantity: line.quantity,
      status: "active",
      variantId: line.variantId,
    });

    movements.push({
      after,
      before: after + line.quantity,
      delta: -line.quantity,
      orderId,
      reason: "reservation_created",
      variantId: line.variantId,
    });
  }

  await tx.insert(inventoryReservations).values(reservations);
  await tx.insert(stockMovements).values(movements);
}

export async function createPendingOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  if (input.lines.length === 0) {
    return { reason: "Your cart is empty.", status: "rejected" };
  }

  if (input.lines.length > CART_MAX_LINES) {
    return { reason: "That is too many different items.", status: "rejected" };
  }

  if (input.lines.some((line) => line.quantity > CART_MAX_LINE_QUANTITY)) {
    return { reason: "That is more of one item than we can sell.", status: "rejected" };
  }

  const existing = await findByAttempt(input.checkoutAttemptId, input.delivery.email);

  if (existing) {
    return { order: existing, status: "replayed" };
  }

  const delivery = quoteDelivery(input.delivery.state);

  if (!delivery) {
    return { reason: "We do not deliver to that state yet.", status: "rejected" };
  }

  const transactional = getTransactionalDb();
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

  try {
    return await transactional.transaction(async (tx) => {
      const orderId = crypto.randomUUID();
      const reference = createOrderReference();
      const paymentReference = createPaymentReference();

      const priced = await priceLines(tx, input.lines);

      const subtotal = priced.reduce(
        (total, line) => total + line.unitPrice * line.quantity,
        0,
      );

      const grandTotal = subtotal + delivery.fee;

      if (grandTotal !== input.acknowledgedTotal) {
        throw new PriceChangedError(input.acknowledgedTotal, grandTotal);
      }

      await tx.insert(orders).values({
        checkoutAttemptId: input.checkoutAttemptId,
        currency: "NGN",
        deliveryTotal: delivery.fee,
        discountTotal: 0,
        grandTotal,
        guestEmail: input.delivery.email,
        id: orderId,
        reference,
        status: "awaiting_payment",
        subtotal,
      });

      await tx.insert(orderItems).values(
        priced.map((line) => ({
          discount: 0,
          imageRef: line.imageRef,
          lineTotal: line.unitPrice * line.quantity,
          orderId,
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
          sku: line.sku,
          unitPrice: line.unitPrice,
          variantId: line.variantId,
          variantSelection: line.optionValues,
        })),
      );

      await tx.insert(orderAddresses).values({
        address: input.delivery.address,
        city: input.delivery.city,
        country: input.delivery.country,
        email: input.delivery.email,
        firstName: input.delivery.firstName,
        instructions: input.delivery.instructions || null,
        landmark: input.delivery.landmark || null,
        lastName: input.delivery.lastName,
        orderId,
        phone: input.delivery.phone,
        postalCode: input.delivery.postalCode || null,
        state: input.delivery.state,
        type: "delivery",
      });

      await tx.insert(paymentAttempts).values({
        checkoutAttemptId: input.checkoutAttemptId,
        currency: "NGN",
        expectedAmount: grandTotal,
        orderId,
        provider: "paystack",
        reference: paymentReference,
        status: "initialized",
      });

      await tx.insert(orderEvents).values({
        note: `${priced.length} line(s), ${delivery.zone} delivery, reservation expires ${expiresAt.toISOString()}`,
        orderId,
        toStatus: "awaiting_payment",
        type: "created",
      });

      await reserveLines(tx, priced, orderId, expiresAt);

      return {
        order: {
          currency: "NGN",
          deliveryTotal: delivery.fee,
          grandTotal,
          id: orderId,
          paymentReference,
          reference,
          status: "awaiting_payment",
          subtotal,
        },
        status: "created" as const,
      };
    });
  } catch (error) {
    if (error instanceof UnavailableError) {
      return { issues: error.issues, status: "unavailable" };
    }

    if (error instanceof PriceChangedError) {
      return {
        acknowledged: error.acknowledged,
        current: error.current,
        status: "price_changed",
      };
    }

    if (error instanceof RejectedError) {
      return { reason: error.message, status: "rejected" };
    }

    const code = errorField(error, "code");

    if (code === UNIQUE_VIOLATION) {
      const constraint = errorField(error, "constraint");

      if (constraint !== null && !IDEMPOTENCY_CONSTRAINTS.has(constraint)) {
        throw error;
      }

      const replayed = await findByAttempt(
        input.checkoutAttemptId,
        input.delivery.email,
      );

      if (replayed) {
        return { order: replayed, status: "replayed" };
      }

      return {
        reason: "Restart checkout and try again.",
        status: "rejected",
      };
    }

    if (code === CHECK_VIOLATION) {
      return {
        issues: input.lines.map((line) => ({
          code: "INSUFFICIENT_STOCK" as const,
          productId: line.productId,
          requested: line.quantity,
          variantId: line.variantId,
        })),
        status: "unavailable",
      };
    }

    throw error;
  }
}

export async function getOrderByReference(reference: string) {
  const rows = await db
    .select({
      currency: orders.currency,
      deliveryTotal: orders.deliveryTotal,
      grandTotal: orders.grandTotal,
      id: orders.id,
      paymentReference: paymentAttempts.reference,
      reference: orders.reference,
      status: orders.status,
      subtotal: orders.subtotal,
    })
    .from(orders)
    .innerJoin(paymentAttempts, eq(paymentAttempts.orderId, orders.id))
    .where(eq(orders.reference, reference))
    .limit(1);

  return rows[0] ?? null;
}
