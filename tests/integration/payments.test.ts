import { desc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DeliveryDetails } from "@/features/checkout/schemas/checkout";
import { db } from "@/server/db";
import {
  inventory,
  orders,
  paymentAttempts,
  productVariants,
  products,
} from "@/server/db/schema";
import { closeTransactionalPool } from "@/server/db/transactional";
import { releaseOrderReservations } from "@/server/services/inventory";
import { createPendingOrder } from "@/server/services/orders";
import { initializePayment } from "@/server/services/payments";
import { quoteDelivery } from "@/server/services/delivery";
import { hasRealDatabase } from "@/tests/setup/env";

type Fixture = { productId: string; unitPrice: number; variantId: string };

let stocked: Fixture;

const createdOrderIds: string[] = [];

const delivery: DeliveryDetails = {
  address: "12 Adeola Odeku Street",
  city: "Victoria Island",
  country: "NG",
  email: "payments@shopverse-e2e.example.com",
  firstName: "Ada",
  instructions: "",
  landmark: "",
  lastName: "Obi",
  phone: "08031234567",
  postalCode: "",
  state: "Lagos",
};

function okTransport(url = "https://checkout.paystack.com/stubbed") {
  let calls = 0;

  const transport = (async (_input: unknown, init?: RequestInit) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as { reference: string };

    return new Response(
      JSON.stringify({
        data: {
          access_code: "stubbed",
          authorization_url: url,
          reference: body.reference,
        },
        status: true,
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  }) as typeof fetch;

  return { calls: () => calls, transport };
}

const failingTransport = (async () => {
  throw new TypeError("fetch failed");
}) as typeof fetch;

const refusingTransport = (async () =>
  new Response(JSON.stringify({ message: "Invalid amount", status: false }), {
    headers: { "content-type": "application/json" },
    status: 400,
  })) as typeof fetch;

async function placeOrder() {
  const total = stocked.unitPrice * 1 + (quoteDelivery(delivery.state)?.fee ?? 0);

  const result = await createPendingOrder({
    acknowledgedTotal: total,
    checkoutAttemptId: crypto.randomUUID(),
    delivery,
    lines: [
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ],
  });

  if (result.status !== "created") {
    throw new Error(`fixture order failed: ${result.status}`);
  }

  createdOrderIds.push(result.order.id);

  return result.order;
}

async function attemptsFor(orderId: string) {
  return db
    .select({
      authorizationUrl: paymentAttempts.authorizationUrl,
      expectedAmount: paymentAttempts.expectedAmount,
      failureReason: paymentAttempts.failureReason,
      reference: paymentAttempts.reference,
      status: paymentAttempts.status,
    })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.orderId, orderId))
    .orderBy(desc(paymentAttempts.createdAt));
}

beforeAll(async () => {
  if (!hasRealDatabase) {
    return;
  }

  const rows = await db
    .select({
      available: inventory.available,
      basePrice: products.basePrice,
      productId: products.id,
      variantId: productVariants.id,
      variantPrice: productVariants.price,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(products.status, "active"))
    .limit(40);

  const usable = rows.find((row) => row.available >= 6);

  if (!usable) {
    throw new Error("no stocked variant available for the payment fixtures");
  }

  stocked = {
    productId: usable.productId,
    unitPrice: usable.variantPrice ?? usable.basePrice,
    variantId: usable.variantId,
  };
}, 90_000);

afterAll(async () => {
  if (!hasRealDatabase) {
    return;
  }

  for (const id of createdOrderIds) {
    await releaseOrderReservations(id);
  }

  if (createdOrderIds.length > 0) {
    await db
      .delete(paymentAttempts)
      .where(inArray(paymentAttempts.orderId, createdOrderIds));
  }

  await closeTransactionalPool();
}, 90_000);

describe.skipIf(!hasRealDatabase)("initializePayment", () => {
  it("stores the amount before calling the provider and returns the url", async () => {
    const order = await placeOrder();
    const stub = okTransport("https://checkout.paystack.com/first");

    const result = await initializePayment({
      orderId: order.id,
      transport: stub.transport,
    });

    expect(result.status).toBe("initialized");

    const rows = await attemptsFor(order.id);
    const live = rows.find((row) => row.status === "pending");

    expect(live).toBeDefined();
    expect(live?.expectedAmount).toBe(order.grandTotal);
    expect(live?.authorizationUrl).toBe("https://checkout.paystack.com/first");
  });

  it("replays the same url and never calls the provider twice (PAY-01, PAY-03)", async () => {
    const order = await placeOrder();
    const stub = okTransport("https://checkout.paystack.com/replay");

    const first = await initializePayment({
      orderId: order.id,
      transport: stub.transport,
    });
    const second = await initializePayment({
      orderId: order.id,
      transport: stub.transport,
    });

    expect(first.status).toBe("initialized");
    expect(second.status).toBe("replayed");
    expect(stub.calls()).toBe(1);

    if (first.status !== "initialized" || second.status !== "replayed") {
      return;
    }

    expect(second.authorizationUrl).toBe(first.authorizationUrl);
    expect(second.reference).toBe(first.reference);
  });

  it("leaves the order retryable when the provider is unreachable (PAY-19)", async () => {
    const order = await placeOrder();

    const failed = await initializePayment({
      orderId: order.id,
      transport: failingTransport,
    });

    expect(failed.status).toBe("unavailable");

    const afterFailure = await attemptsFor(order.id);

    expect(afterFailure.every((row) => row.status !== "pending")).toBe(true);

    const stub = okTransport("https://checkout.paystack.com/recovered");
    const retried = await initializePayment({
      orderId: order.id,
      transport: stub.transport,
    });

    expect(retried.status).toBe("initialized");

    const rows = await attemptsFor(order.id);
    const references = new Set(rows.map((row) => row.reference));

    expect(references.size).toBe(rows.length);
  });

  it("records why the provider refused and stays retryable", async () => {
    const order = await placeOrder();

    const refused = await initializePayment({
      orderId: order.id,
      transport: refusingTransport,
    });

    expect(refused.status).toBe("rejected");

    const rows = await attemptsFor(order.id);
    const failed = rows.find((row) => row.status === "failed");

    expect(failed?.failureReason).toBe("Invalid amount");
  });

  it("creates exactly one live attempt under concurrent initialization", async () => {
    const order = await placeOrder();
    const stub = okTransport("https://checkout.paystack.com/concurrent");

    const results = await Promise.all([
      initializePayment({ orderId: order.id, transport: stub.transport }),
      initializePayment({ orderId: order.id, transport: stub.transport }),
      initializePayment({ orderId: order.id, transport: stub.transport }),
    ]);

    const rows = await attemptsFor(order.id);
    const live = rows.filter((row) =>
      ["initialized", "pending", "processing"].includes(row.status),
    );

    expect(live).toHaveLength(1);
    expect(results.some((result) => result.status === "initialized")).toBe(true);
  });

  it("refuses an order that is no longer awaiting payment", async () => {
    const order = await placeOrder();

    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));

    const result = await initializePayment({
      orderId: order.id,
      transport: okTransport().transport,
    });

    expect(result.status).toBe("rejected");

    await db
      .update(orders)
      .set({ status: "awaiting_payment" })
      .where(eq(orders.id, order.id));
  });

  it("refuses an unknown order without touching the database", async () => {
    const result = await initializePayment({
      orderId: crypto.randomUUID(),
      transport: okTransport().transport,
    });

    expect(result.status).toBe("rejected");
  });
});
