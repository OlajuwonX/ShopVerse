import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RESERVATION_MINUTES } from "@/constants/orders";
import type { DeliveryDetails } from "@/features/checkout/schemas/checkout";
import { isOrderReference } from "@/lib/order-reference";
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
import { closeTransactionalPool } from "@/server/db/transactional";
import { quoteDelivery } from "@/server/services/delivery";
import {
  expireStaleReservations,
  releaseOrderReservations,
} from "@/server/services/inventory";
import { createPendingOrder } from "@/server/services/orders";
import { hasRealDatabase } from "@/tests/setup/env";

type Fixture = { productId: string; unitPrice: number; variantId: string };

let stocked: Fixture;
let second: Fixture;

const createdOrderIds: string[] = [];
const restores: (() => Promise<unknown>)[] = [];

const delivery: DeliveryDetails = {
  address: "12 Adeola Odeku Street",
  city: "Victoria Island",
  country: "NG",
  email: "orders@shopverse.test",
  firstName: "Ada",
  instructions: "",
  landmark: "",
  lastName: "Obi",
  phone: "08031234567",
  postalCode: "",
  state: "Lagos",
};

function attempt() {
  return crypto.randomUUID();
}

/** The total a customer would have been shown, i.e. a matching consent assertion. */
function totalFor(
  entries: readonly { quantity: number; unitPrice: number }[],
  state = "Lagos",
) {
  const subtotal = entries.reduce(
    (sum, entry) => sum + entry.unitPrice * entry.quantity,
    0,
  );

  return subtotal + (quoteDelivery(state)?.fee ?? 0);
}

async function setAvailable(variantId: string, available: number) {
  const previous = await db
    .select({ available: inventory.available, reserved: inventory.reserved })
    .from(inventory)
    .where(eq(inventory.variantId, variantId))
    .limit(1);

  const original = previous[0] ?? { available: 0, reserved: 0 };

  await db
    .update(inventory)
    .set({ available, reserved: 0 })
    .where(eq(inventory.variantId, variantId));

  restores.push(() =>
    db
      .update(inventory)
      .set({ available: original.available, reserved: original.reserved })
      .where(eq(inventory.variantId, variantId)),
  );
}

async function readInventory(variantId: string) {
  const rows = await db
    .select({ available: inventory.available, reserved: inventory.reserved })
    .from(inventory)
    .where(eq(inventory.variantId, variantId))
    .limit(1);

  return rows[0]!;
}

async function trackOrder(id: string) {
  createdOrderIds.push(id);
}

beforeAll(async () => {
  if (!hasRealDatabase) {
    return;
  }

  const rows = await db
    .select({
      basePrice: products.basePrice,
      productId: products.id,
      variantId: productVariants.id,
      variantPrice: productVariants.price,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(
      and(
        eq(products.status, "active"),
        eq(productVariants.status, "active"),
        sql`${inventory.available} > 3`,
      ),
    )
    .limit(40);

  const byProduct = new Map<string, Fixture>();

  for (const row of rows) {
    if (!byProduct.has(row.productId)) {
      byProduct.set(row.productId, {
        productId: row.productId,
        unitPrice: row.variantPrice ?? row.basePrice,
        variantId: row.variantId,
      });
    }
  }

  const fixtures = [...byProduct.values()];

  if (fixtures.length < 2) {
    throw new Error("Order tests need two stocked products; run pnpm db:seed");
  }

  stocked = fixtures[0]!;
  second = fixtures[1]!;
});

afterEach(async () => {
  if (createdOrderIds.length > 0) {
    await db
      .delete(stockMovements)
      .where(inArray(stockMovements.orderId, createdOrderIds));
    await db
      .delete(inventoryReservations)
      .where(inArray(inventoryReservations.orderId, createdOrderIds));
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, createdOrderIds));
    await db
      .delete(paymentAttempts)
      .where(inArray(paymentAttempts.orderId, createdOrderIds));
    await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds));
    await db
      .delete(orderAddresses)
      .where(inArray(orderAddresses.orderId, createdOrderIds));
    await db.delete(orders).where(inArray(orders.id, createdOrderIds));

    createdOrderIds.length = 0;
  }

  while (restores.length > 0) {
    const restore = restores.pop();

    if (restore) {
      await restore();
    }
  }
});

afterAll(async () => {
  if (!hasRealDatabase) {
    return;
  }

  const leftovers = await db
    .select({ id: orders.id })
    .from(orders)
    .where(inArray(orders.guestEmail, [delivery.email, "attacker@shopverse.test"]));

  const ids = leftovers.map((row) => row.id);

  if (ids.length > 0) {
    const held = await db
      .select({
        quantity: inventoryReservations.quantity,
        variantId: inventoryReservations.variantId,
      })
      .from(inventoryReservations)
      .where(
        and(
          inArray(inventoryReservations.orderId, ids),
          eq(inventoryReservations.status, "active"),
        ),
      );

    for (const reservation of held) {
      await db
        .update(inventory)
        .set({
          available: sql`${inventory.available} + ${reservation.quantity}`,
          reserved: sql`greatest(${inventory.reserved} - ${reservation.quantity}, 0)`,
        })
        .where(eq(inventory.variantId, reservation.variantId));
    }

    await db.delete(stockMovements).where(inArray(stockMovements.orderId, ids));
    await db
      .delete(inventoryReservations)
      .where(inArray(inventoryReservations.orderId, ids));
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, ids));
    await db.delete(paymentAttempts).where(inArray(paymentAttempts.orderId, ids));
    await db.delete(orderItems).where(inArray(orderItems.orderId, ids));
    await db.delete(orderAddresses).where(inArray(orderAddresses.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
  }

  await closeTransactionalPool();
});

describe.skipIf(!hasRealDatabase)("createPendingOrder", () => {
  it("creates an order, reserves stock and records the movement", async () => {
    await setAvailable(stocked.variantId, 5);

    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 2, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 2, variantId: stocked.variantId },
      ],
    });

    expect(result.status).toBe("created");

    if (result.status !== "created") {
      return;
    }

    await trackOrder(result.order.id);

    expect(isOrderReference(result.order.reference)).toBe(true);
    expect(result.order.subtotal).toBe(stocked.unitPrice * 2);
    expect(result.order.deliveryTotal).toBe(quoteDelivery("Lagos")!.fee);
    expect(result.order.grandTotal).toBe(
      result.order.subtotal + result.order.deliveryTotal,
    );
    expect(result.order.status).toBe("awaiting_payment");

    const stock = await readInventory(stocked.variantId);
    expect(stock.available).toBe(3);
    expect(stock.reserved).toBe(2);

    const reservations = await db
      .select({
        expiresAt: inventoryReservations.expiresAt,
        quantity: inventoryReservations.quantity,
        status: inventoryReservations.status,
      })
      .from(inventoryReservations)
      .where(eq(inventoryReservations.orderId, result.order.id));

    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.status).toBe("active");
    expect(reservations[0]?.quantity).toBe(2);
    expect(reservations[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(reservations[0]!.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + RESERVATION_MINUTES * 60 * 1000 + 5000,
    );

    const movements = await db
      .select({
        after: stockMovements.after,
        before: stockMovements.before,
        delta: stockMovements.delta,
        reason: stockMovements.reason,
      })
      .from(stockMovements)
      .where(eq(stockMovements.orderId, result.order.id));

    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      after: 3,
      before: 5,
      delta: -2,
      reason: "reservation_created",
    });

    const payment = await db
      .select({
        expectedAmount: paymentAttempts.expectedAmount,
        status: paymentAttempts.status,
      })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.orderId, result.order.id));

    expect(payment[0]?.status).toBe("initialized");
    expect(payment[0]?.expectedAmount).toBe(result.order.grandTotal);

    const address = await db
      .select({ email: orderAddresses.email, state: orderAddresses.state })
      .from(orderAddresses)
      .where(eq(orderAddresses.orderId, result.order.id));

    expect(address[0]).toMatchObject({ email: delivery.email, state: "Lagos" });
  });

  it("prices from the database, never from the caller", async () => {
    await setAvailable(stocked.variantId, 4);

    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    if (result.status !== "created") {
      throw new Error(`expected created, got ${result.status}`);
    }

    await trackOrder(result.order.id);

    const items = await db
      .select({ lineTotal: orderItems.lineTotal, unitPrice: orderItems.unitPrice })
      .from(orderItems)
      .where(eq(orderItems.orderId, result.order.id));

    expect(items[0]?.unitPrice).toBe(stocked.unitPrice);
    expect(items[0]?.lineTotal).toBe(stocked.unitPrice);
  });

  it("replays the same order for a repeated checkout attempt (PAY-01, PAY-02)", async () => {
    await setAvailable(stocked.variantId, 5);

    const attemptId = attempt();
    const lines = [
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ];

    const first = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attemptId,
      delivery,
      lines,
    });
    const secondCall = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attemptId,
      delivery,
      lines,
    });

    if (first.status !== "created" || secondCall.status !== "replayed") {
      throw new Error(
        `expected created then replayed, got ${first.status}/${secondCall.status}`,
      );
    }

    await trackOrder(first.order.id);

    expect(secondCall.order.id).toBe(first.order.id);
    expect(secondCall.order.reference).toBe(first.order.reference);

    const stock = await readInventory(stocked.variantId);
    expect(stock.available, "replay must not reserve twice").toBe(4);
    expect(stock.reserved).toBe(1);
  });

  it("creates exactly one order when the same attempt is submitted concurrently (PAY-01)", async () => {
    await setAvailable(stocked.variantId, 5);

    const attemptId = attempt();
    const lines = [
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ];
    const oneUnit = totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]);

    const results = await Promise.all([
      createPendingOrder({
        acknowledgedTotal: oneUnit,
        checkoutAttemptId: attemptId,
        delivery,
        lines,
      }),
      createPendingOrder({
        acknowledgedTotal: oneUnit,
        checkoutAttemptId: attemptId,
        delivery,
        lines,
      }),
      createPendingOrder({
        acknowledgedTotal: oneUnit,
        checkoutAttemptId: attemptId,
        delivery,
        lines,
      }),
    ]);

    const ids = new Set(
      results.flatMap((result) =>
        result.status === "created" || result.status === "replayed"
          ? [result.order.id]
          : [],
      ),
    );

    expect(ids.size, "one order for one attempt id").toBe(1);

    const orderId = [...ids][0]!;
    await trackOrder(orderId);

    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.checkoutAttemptId, attemptId));

    expect(rows).toHaveLength(1);

    const stock = await readInventory(stocked.variantId);
    expect(stock.available, "only one reservation survives").toBe(4);
    expect(stock.reserved).toBe(1);
  });

  it("lets exactly one of two concurrent buyers take the last unit (INV-01)", async () => {
    await setAvailable(stocked.variantId, 1);

    const lines = [
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ];
    const oneUnit = totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]);

    const results = await Promise.all([
      createPendingOrder({
        acknowledgedTotal: oneUnit,
        checkoutAttemptId: attempt(),
        delivery,
        lines,
      }),
      createPendingOrder({
        acknowledgedTotal: oneUnit,
        checkoutAttemptId: attempt(),
        delivery,
        lines,
      }),
    ]);

    const created = results.filter((result) => result.status === "created");
    const unavailable = results.filter((result) => result.status === "unavailable");

    expect(created).toHaveLength(1);
    expect(unavailable).toHaveLength(1);

    for (const result of created) {
      if (result.status === "created") {
        await trackOrder(result.order.id);
      }
    }

    const stock = await readInventory(stocked.variantId);
    expect(stock.available).toBe(0);
    expect(stock.reserved).toBe(1);
  });

  it("refuses to oversell and leaves stock untouched (INV-03)", async () => {
    await setAvailable(stocked.variantId, 2);

    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 5, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 5, variantId: stocked.variantId },
      ],
    });

    expect(result.status).toBe("unavailable");

    if (result.status === "unavailable") {
      expect(result.issues[0]?.code).toBe("INSUFFICIENT_STOCK");
      expect(result.issues[0]?.available).toBe(2);
    }

    const stock = await readInventory(stocked.variantId);
    expect(stock.available).toBe(2);
    expect(stock.reserved).toBe(0);
  });

  it("rolls back every line when a later line cannot be reserved", async () => {
    await setAvailable(stocked.variantId, 5);
    await setAvailable(second.variantId, 0);

    const attemptId = attempt();

    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([
        { quantity: 1, unitPrice: stocked.unitPrice },
        { quantity: 1, unitPrice: second.unitPrice },
      ]),
      checkoutAttemptId: attemptId,
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
        { productId: second.productId, quantity: 1, variantId: second.variantId },
      ],
    });

    expect(result.status).toBe("unavailable");

    const first = await readInventory(stocked.variantId);

    expect(first.available, "the first line must be rolled back").toBe(5);
    expect(first.reserved).toBe(0);

    const orphans = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.checkoutAttemptId, attemptId));

    expect(orphans, "no partial order may survive").toHaveLength(0);
  });

  it("rejects an unknown product without touching stock (INV-04)", async () => {
    const result = await createPendingOrder({
      acknowledgedTotal: 0,
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        {
          productId: "00000000-0000-4000-8000-000000000000",
          quantity: 1,
          variantId: "00000000-0000-4000-8000-000000000001",
        },
      ],
    });

    expect(result.status).toBe("unavailable");

    if (result.status === "unavailable") {
      expect(result.issues[0]?.code).toBe("PRODUCT_UNAVAILABLE");
    }
  });

  it("rejects an unsupported delivery state before reserving anything", async () => {
    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attempt(),
      delivery: { ...delivery, state: "Atlantis" as DeliveryDetails["state"] },
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    expect(result.status).toBe("rejected");
  });

  it("gives every order a distinct, non-sequential reference (SEC-13)", async () => {
    await setAvailable(stocked.variantId, 6);

    const references: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      const result = await createPendingOrder({
        acknowledgedTotal: totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]),
        checkoutAttemptId: attempt(),
        delivery,
        lines: [
          { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
        ],
      });

      if (result.status !== "created") {
        throw new Error(`expected created, got ${result.status}`);
      }

      await trackOrder(result.order.id);
      references.push(result.order.reference);
    }

    expect(new Set(references).size).toBe(3);

    for (const reference of references) {
      expect(isOrderReference(reference)).toBe(true);
    }
  });
});

describe.skipIf(!hasRealDatabase)("attempt replay binding (M-2)", () => {
  it("does not hand someone else's order to a caller who only knows the attempt id", async () => {
    await setAvailable(stocked.variantId, 5);

    const attemptId = attempt();
    const lines = [
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ];
    const oneUnit = totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]);

    const mine = await createPendingOrder({
      acknowledgedTotal: oneUnit,
      checkoutAttemptId: attemptId,
      delivery,
      lines,
    });

    if (mine.status !== "created") {
      throw new Error(`expected created, got ${mine.status}`);
    }

    await trackOrder(mine.order.id);

    // Same attempt id, different customer.
    const theirs = await createPendingOrder({
      acknowledgedTotal: oneUnit,
      checkoutAttemptId: attemptId,
      delivery: { ...delivery, email: "attacker@shopverse.test" },
      lines,
    });

    expect(theirs.status, "must not replay another customer's order").toBe("rejected");

    if (theirs.status === "rejected") {
      expect(theirs.reason, "and must not describe what exists").not.toMatch(
        /SV-|order|payment|total/i,
      );
    }

    const stock = await readInventory(stocked.variantId);

    expect(stock.available, "and must not reserve a second time").toBe(4);
  });

  it("still replays for the customer who owns the attempt", async () => {
    await setAvailable(stocked.variantId, 5);

    const attemptId = attempt();
    const lines = [
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ];
    const oneUnit = totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]);

    const first = await createPendingOrder({
      acknowledgedTotal: oneUnit,
      checkoutAttemptId: attemptId,
      delivery,
      lines,
    });

    const again = await createPendingOrder({
      acknowledgedTotal: oneUnit,
      checkoutAttemptId: attemptId,
      delivery,
      lines,
    });

    if (first.status !== "created") {
      throw new Error(`expected created, got ${first.status}`);
    }

    await trackOrder(first.order.id);

    expect(again.status).toBe("replayed");

    if (again.status === "replayed") {
      expect(again.order.id).toBe(first.order.id);
    }
  });
});

describe.skipIf(!hasRealDatabase)("price-change consent (CART-01)", () => {
  it("refuses an order whose total the customer never saw", async () => {
    await setAvailable(stocked.variantId, 5);

    const honest = totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]);

    const result = await createPendingOrder({
      acknowledgedTotal: honest - 1,
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    expect(result.status).toBe("price_changed");

    if (result.status === "price_changed") {
      expect(result.acknowledged).toBe(honest - 1);
      expect(result.current).toBe(honest);
    }
  });

  it("writes nothing at all when the total is refused", async () => {
    await setAvailable(stocked.variantId, 5);

    const attemptId = attempt();

    await createPendingOrder({
      acknowledgedTotal: 1,
      checkoutAttemptId: attemptId,
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.checkoutAttemptId, attemptId));

    expect(rows, "no order may be written").toHaveLength(0);

    const stock = await readInventory(stocked.variantId);

    expect(stock.available, "no stock may be reserved").toBe(5);
    expect(stock.reserved).toBe(0);
  });

  it("cannot be talked into charging less than the catalogue says", async () => {
    await setAvailable(stocked.variantId, 5);

    const result = await createPendingOrder({
      acknowledgedTotal: 100,
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    expect(result.status, "a bargain total is refused, never honoured").toBe(
      "price_changed",
    );
  });

  it("accepts the order once the customer acknowledges the real total", async () => {
    await setAvailable(stocked.variantId, 5);

    const honest = totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]);

    const result = await createPendingOrder({
      acknowledgedTotal: honest,
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    expect(result.status).toBe("created");

    if (result.status === "created") {
      await trackOrder(result.order.id);
      expect(result.order.grandTotal).toBe(honest);
    }
  });

  it("catches a price edit made between the customer seeing the total and submitting", async () => {
    await setAvailable(stocked.variantId, 5);

    const seen = totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]);

    const previous = await db
      .select({ basePrice: products.basePrice })
      .from(products)
      .where(eq(products.id, stocked.productId))
      .limit(1);

    const original = previous[0]!.basePrice;

    await db
      .update(products)
      .set({ basePrice: original + 50_000 })
      .where(eq(products.id, stocked.productId));

    restores.push(() =>
      db
        .update(products)
        .set({ basePrice: original })
        .where(eq(products.id, stocked.productId)),
    );

    const result = await createPendingOrder({
      acknowledgedTotal: seen,
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    expect(result.status).toBe("price_changed");

    if (result.status === "price_changed") {
      expect(result.acknowledged).toBe(seen);
      expect(result.current).toBe(seen + 50_000);
    }

    const stock = await readInventory(stocked.variantId);

    expect(stock.available, "the raised price must not cost the customer stock").toBe(
      5,
    );
  });
});

describe.skipIf(!hasRealDatabase)("reservation lifecycle", () => {
  it("releases a reservation and restores stock exactly once (INV-06)", async () => {
    await setAvailable(stocked.variantId, 4);

    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 2, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 2, variantId: stocked.variantId },
      ],
    });

    if (result.status !== "created") {
      throw new Error(`expected created, got ${result.status}`);
    }

    await trackOrder(result.order.id);

    expect(await releaseOrderReservations(result.order.id)).toBe(1);

    const stock = await readInventory(stocked.variantId);
    expect(stock.available).toBe(4);
    expect(stock.reserved).toBe(0);

    expect(
      await releaseOrderReservations(result.order.id),
      "a second release is a no-op",
    ).toBe(0);

    const afterReplay = await readInventory(stocked.variantId);
    expect(afterReplay.available).toBe(4);

    const movements = await db
      .select({ reason: stockMovements.reason })
      .from(stockMovements)
      .where(eq(stockMovements.orderId, result.order.id));

    expect(movements.map((movement) => movement.reason).sort()).toStrictEqual([
      "reservation_created",
      "reservation_released",
    ]);
  });

  it("expires a stale reservation and is safe to run twice (INV-09)", async () => {
    await setAvailable(stocked.variantId, 3);

    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    if (result.status !== "created") {
      throw new Error(`expected created, got ${result.status}`);
    }

    await trackOrder(result.order.id);

    await db
      .update(inventoryReservations)
      .set({
        createdAt: new Date(Date.now() - 7_200_000),
        expiresAt: new Date(Date.now() - 60_000),
      })
      .where(eq(inventoryReservations.orderId, result.order.id));

    const firstSweep = await expireStaleReservations();
    expect(firstSweep.released).toBeGreaterThanOrEqual(1);

    const stock = await readInventory(stocked.variantId);
    expect(stock.available).toBe(3);
    expect(stock.reserved).toBe(0);

    const secondSweep = await expireStaleReservations();
    const afterSweep = await readInventory(stocked.variantId);

    expect(afterSweep.available, "the sweep must not restore twice").toBe(3);
    expect(secondSweep.released).toBe(0);
  });

  it("does not expire a reservation whose payment is in flight (INV-02)", async () => {
    await setAvailable(stocked.variantId, 3);

    const result = await createPendingOrder({
      acknowledgedTotal: totalFor([{ quantity: 1, unitPrice: stocked.unitPrice }]),
      checkoutAttemptId: attempt(),
      delivery,
      lines: [
        { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      ],
    });

    if (result.status !== "created") {
      throw new Error(`expected created, got ${result.status}`);
    }

    await trackOrder(result.order.id);

    await db
      .update(inventoryReservations)
      .set({
        createdAt: new Date(Date.now() - 7_200_000),
        expiresAt: new Date(Date.now() - 60_000),
      })
      .where(eq(inventoryReservations.orderId, result.order.id));

    await db
      .update(paymentAttempts)
      .set({ status: "pending" })
      .where(eq(paymentAttempts.orderId, result.order.id));

    const sweep = await expireStaleReservations();

    expect(sweep.skippedInFlight).toBeGreaterThanOrEqual(1);

    const held = await db
      .select({ status: inventoryReservations.status })
      .from(inventoryReservations)
      .where(eq(inventoryReservations.orderId, result.order.id));

    expect(held[0]?.status, "an in-flight payment keeps its hold").toBe("active");

    const stock = await readInventory(stocked.variantId);
    expect(stock.available).toBe(2);
  });
});
