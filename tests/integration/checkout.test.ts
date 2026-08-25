import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { inventory, productVariants, products } from "@/server/db/schema";
import { validateCart } from "@/server/services/cart";
import { quoteDelivery } from "@/server/services/delivery";
import { hasRealDatabase } from "@/tests/setup/env";

type Fixture = { productId: string; unitPrice: number; variantId: string };

let stocked: Fixture;

const restores: (() => Promise<unknown>)[] = [];

async function setAvailable(variantId: string, available: number) {
  const previous = await db
    .select({ available: inventory.available })
    .from(inventory)
    .where(eq(inventory.variantId, variantId))
    .limit(1);

  const original = previous[0]?.available ?? 0;

  await db
    .update(inventory)
    .set({ available })
    .where(eq(inventory.variantId, variantId));

  restores.push(() =>
    db
      .update(inventory)
      .set({ available: original })
      .where(eq(inventory.variantId, variantId)),
  );
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
        sql`${inventory.available} > 1`,
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new Error("Checkout tests need a stocked variant; run pnpm db:seed");
  }

  stocked = {
    productId: row.productId,
    unitPrice: row.variantPrice ?? row.basePrice,
    variantId: row.variantId,
  };
});

afterEach(async () => {
  while (restores.length > 0) {
    const restore = restores.pop();

    if (restore) {
      await restore();
    }
  }
});

describe.skipIf(!hasRealDatabase)("delivery pricing in cart validation", () => {
  it("leaves delivery unknown when no state is supplied", async () => {
    const result = await validateCart([
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ]);

    expect(result.totals.delivery).toBeNull();
    expect(result.totals.total).toBe(result.totals.subtotal);
  });

  it("prices delivery from the state and adds it to the total", async () => {
    const result = await validateCart(
      [{ productId: stocked.productId, quantity: 1, variantId: stocked.variantId }],
      { deliveryState: "Lagos" },
    );

    const quote = quoteDelivery("Lagos");

    expect(result.totals.delivery).toBe(quote!.fee);
    expect(result.totals.total).toBe(result.totals.subtotal + quote!.fee);
  });

  it("charges more for a distant state than for Lagos", async () => {
    const lines = [
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ];

    const lagos = await validateCart(lines, { deliveryState: "Lagos" });
    const borno = await validateCart(lines, { deliveryState: "Borno" });

    expect(lagos.totals.subtotal).toBe(borno.totals.subtotal);
    expect(borno.totals.delivery!).toBeGreaterThan(lagos.totals.delivery!);
    expect(borno.totals.total).toBeGreaterThan(lagos.totals.total);
  });

  it("ignores an unsupported state rather than guessing a fee", async () => {
    const result = await validateCart(
      [{ productId: stocked.productId, quantity: 1, variantId: stocked.variantId }],
      { deliveryState: "Atlantis" },
    );

    expect(result.totals.delivery).toBeNull();
    expect(result.totals.total).toBe(result.totals.subtotal);
  });

  it("does not charge delivery when nothing in the cart is purchasable", async () => {
    await setAvailable(stocked.variantId, 0);

    const result = await validateCart(
      [{ productId: stocked.productId, quantity: 1, variantId: stocked.variantId }],
      { deliveryState: "Lagos" },
    );

    expect(result.totals.subtotal).toBe(0);
    expect(result.totals.delivery).toBeNull();
    expect(result.totals.total).toBe(0);
  });

  it("never derives delivery from anything the client sent", async () => {
    const result = await validateCart(
      [{ productId: stocked.productId, quantity: 1, variantId: stocked.variantId }],
      { deliveryState: "Lagos" },
    );

    expect(result.totals.delivery).toBe(quoteDelivery("Lagos")!.fee);
    expect(result.totals.subtotal).toBe(stocked.unitPrice);
  });
});
