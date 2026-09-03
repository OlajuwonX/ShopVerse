import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { serverEnv } from "@/config/env";
import { createPaymentReference } from "@/lib/order-reference";
import { db } from "@/server/db";
import { orderEvents, orders, paymentAttempts } from "@/server/db/schema";
import {
  initializeTransaction,
  type PaystackTransport,
} from "@/server/payments/paystack";

export const LIVE_PAYMENT_STATUSES = ["initialized", "pending", "processing"] as const;

export const PAYMENT_CALLBACK_PATH = "/checkout/callback";

const UNIQUE_VIOLATION = "23505";

export type InitializePaymentResult =
  | { authorizationUrl: string; reference: string; status: "initialized" }
  | { authorizationUrl: string; reference: string; status: "replayed" }
  | { status: "not_configured" }
  | { reason: string; status: "unavailable" }
  | { reason: string; status: "rejected" };

type InitializePaymentInput = {
  orderId: string;
  transport?: PaystackTransport;
};

function callbackUrl() {
  return new URL(PAYMENT_CALLBACK_PATH, serverEnv.APP_ORIGIN).toString();
}

function errorCode(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const code = (current as { code?: unknown }).code;

      if (typeof code === "string") {
        return code;
      }

      current = (current as { cause?: unknown }).cause;
      continue;
    }

    return null;
  }

  return null;
}

async function findLiveAttempt(orderId: string) {
  const rows = await db
    .select({
      authorizationUrl: paymentAttempts.authorizationUrl,
      id: paymentAttempts.id,
      reference: paymentAttempts.reference,
      status: paymentAttempts.status,
    })
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.orderId, orderId),
        inArray(paymentAttempts.status, [...LIVE_PAYMENT_STATUSES]),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function abandon(attemptId: string) {
  await db
    .update(paymentAttempts)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(
      and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.status, "initialized")),
    );
}

export async function initializePayment(
  input: InitializePaymentInput,
): Promise<InitializePaymentResult> {
  const orderRows = await db
    .select({
      checkoutAttemptId: orders.checkoutAttemptId,
      currency: orders.currency,
      grandTotal: orders.grandTotal,
      guestEmail: orders.guestEmail,
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  const order = orderRows[0];

  if (!order) {
    return { reason: "Order not found.", status: "rejected" };
  }

  if (order.status !== "awaiting_payment") {
    return { reason: "This order is no longer awaiting payment.", status: "rejected" };
  }

  if (!order.guestEmail) {
    return { reason: "This order has no contact email.", status: "rejected" };
  }

  const existing = await findLiveAttempt(order.id);

  if (existing?.authorizationUrl) {
    return {
      authorizationUrl: existing.authorizationUrl,
      reference: existing.reference,
      status: "replayed",
    };
  }

  if (existing) {
    await abandon(existing.id);
  }

  const reference = createPaymentReference();

  try {
    await db.insert(paymentAttempts).values({
      checkoutAttemptId: order.checkoutAttemptId,
      currency: order.currency,
      expectedAmount: order.grandTotal,
      orderId: order.id,
      provider: "paystack",
      reference,
      status: "initialized",
    });
  } catch (error) {
    if (errorCode(error) !== UNIQUE_VIOLATION) {
      throw error;
    }

    const winner = await findLiveAttempt(order.id);

    if (winner?.authorizationUrl) {
      return {
        authorizationUrl: winner.authorizationUrl,
        reference: winner.reference,
        status: "replayed",
      };
    }

    return {
      reason: "This payment is already being started. Try again in a moment.",
      status: "unavailable",
    };
  }

  const provider = await initializeTransaction(
    {
      amountMinor: order.grandTotal,
      callbackUrl: callbackUrl(),
      currency: order.currency,
      email: order.guestEmail,
      metadata: { order_reference: order.reference },
      reference,
    },
    input.transport ? { transport: input.transport } : {},
  );

  if (provider.status !== "ok") {
    await db
      .update(paymentAttempts)
      .set({
        ...(provider.status === "rejected"
          ? { failureReason: provider.message.slice(0, 500), status: "failed" as const }
          : { status: "abandoned" as const }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentAttempts.reference, reference),
          eq(paymentAttempts.status, "initialized"),
        ),
      );

    if (provider.status === "not_configured") {
      return { status: "not_configured" };
    }

    if (provider.status === "unavailable") {
      return {
        reason: "We could not reach the payment provider. Try again in a moment.",
        status: "unavailable",
      };
    }

    return {
      reason: "The payment provider refused this transaction. Try again.",
      status: "rejected",
    };
  }

  const claimed = await db
    .update(paymentAttempts)
    .set({
      authorizationUrl: provider.authorizationUrl,
      status: "pending",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentAttempts.reference, reference),
        eq(paymentAttempts.status, "initialized"),
      ),
    )
    .returning({ id: paymentAttempts.id });

  if (claimed.length === 0) {
    return {
      reason: "This payment is already being processed.",
      status: "rejected",
    };
  }

  await db.insert(orderEvents).values({
    note: `Payment initialized with ${reference}`,
    orderId: order.id,
    type: "payment_updated",
  });

  return {
    authorizationUrl: provider.authorizationUrl,
    reference,
    status: "initialized",
  };
}
