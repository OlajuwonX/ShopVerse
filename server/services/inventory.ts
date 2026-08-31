import "server-only";

import { and, eq, lte, sql } from "drizzle-orm";

import { RESERVATION_SWEEP_BATCH } from "@/constants/orders";
import { db } from "@/server/db";
import {
  inventory,
  inventoryReservations,
  orders,
  paymentAttempts,
  stockMovements,
} from "@/server/db/schema";
import { getTransactionalDb, type Transaction } from "@/server/db/transactional";

export type ReleaseReason = "reservation_released" | "reservation_expired";

export type SweepResult = {
  released: number;
  skippedInFlight: number;
};

const IN_FLIGHT_PAYMENT_STATUSES = ["pending", "processing", "succeeded"] as const;

async function releaseReservation(
  tx: Transaction,
  reservation: { id: string; orderId: string; quantity: number; variantId: string },
  reason: ReleaseReason,
) {
  const claimed = await tx
    .update(inventoryReservations)
    .set({
      status: reason === "reservation_expired" ? "expired" : "released",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inventoryReservations.id, reservation.id),
        eq(inventoryReservations.status, "active"),
      ),
    )
    .returning({ id: inventoryReservations.id });

  if (claimed.length === 0) {
    return false;
  }

  const restored = await tx
    .update(inventory)
    .set({
      available: sql`${inventory.available} + ${reservation.quantity}`,
      reserved: sql`greatest(${inventory.reserved} - ${reservation.quantity}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(inventory.variantId, reservation.variantId))
    .returning({ available: inventory.available });

  const after = restored[0]?.available;

  if (after === undefined) {
    return false;
  }

  await tx.insert(stockMovements).values({
    after,
    before: after - reservation.quantity,
    delta: reservation.quantity,
    orderId: reservation.orderId,
    reason,
    variantId: reservation.variantId,
  });

  return true;
}

export async function releaseOrderReservations(
  orderId: string,
  reason: ReleaseReason = "reservation_released",
): Promise<number> {
  const transactional = getTransactionalDb();

  return transactional.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: inventoryReservations.id,
        orderId: inventoryReservations.orderId,
        quantity: inventoryReservations.quantity,
        variantId: inventoryReservations.variantId,
      })
      .from(inventoryReservations)
      .where(
        and(
          eq(inventoryReservations.orderId, orderId),
          eq(inventoryReservations.status, "active"),
        ),
      );

    let released = 0;

    for (const reservation of rows) {
      if (await releaseReservation(tx, reservation, reason)) {
        released += 1;
      }
    }

    return released;
  });
}

export async function expireStaleReservations(now = new Date()): Promise<SweepResult> {
  const candidates = await db
    .select({
      id: inventoryReservations.id,
      orderId: inventoryReservations.orderId,
      paymentStatus: paymentAttempts.status,
      quantity: inventoryReservations.quantity,
      variantId: inventoryReservations.variantId,
    })
    .from(inventoryReservations)
    .innerJoin(orders, eq(orders.id, inventoryReservations.orderId))
    .leftJoin(paymentAttempts, eq(paymentAttempts.orderId, orders.id))
    .where(
      and(
        eq(inventoryReservations.status, "active"),
        lte(inventoryReservations.expiresAt, now),
      ),
    )
    .limit(RESERVATION_SWEEP_BATCH);

  const inFlight = candidates.filter(
    (row) =>
      row.paymentStatus !== null &&
      (IN_FLIGHT_PAYMENT_STATUSES as readonly string[]).includes(row.paymentStatus),
  );

  const expirable = candidates.filter((row) => !inFlight.includes(row));

  if (expirable.length === 0) {
    return { released: 0, skippedInFlight: inFlight.length };
  }

  const transactional = getTransactionalDb();

  const released = await transactional.transaction(async (tx) => {
    let count = 0;

    for (const reservation of expirable) {
      if (await releaseReservation(tx, reservation, "reservation_expired")) {
        count += 1;
      }
    }

    return count;
  });

  return { released, skippedInFlight: inFlight.length };
}
