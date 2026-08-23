import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { CART_MAX_LINE_QUANTITY, CART_MAX_LINES } from "@/constants/cart";
import { db } from "@/server/db";
import { inventory, productVariants, products } from "@/server/db/schema";
import { validateCart } from "@/server/services/cart";
import { hasRealDatabase } from "@/tests/setup/env";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

type Fixture = {
  available: number;
  productId: string;
  unitPrice: number;
  variantId: string;
};

let stocked: Fixture;
let second: Fixture;

const restores: (() => Promise<unknown>)[] = [];

async function loadFixtures(limit: number): Promise<Fixture[]> {
  const rows = await db
    .select({
      available: sql<number>`coalesce(${inventory.available}, 0)::int`,
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
    .limit(limit);

  const byProduct = new Map<string, Fixture>();

  for (const row of rows) {
    if (!byProduct.has(row.productId)) {
      byProduct.set(row.productId, {
        available: row.available,
        productId: row.productId,
        unitPrice: row.variantPrice ?? row.basePrice,
        variantId: row.variantId,
      });
    }
  }

  return [...byProduct.values()];
}

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

async function setVariantStatus(variantId: string, status: "active" | "archived") {
  const previous = await db
    .select({ status: productVariants.status })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  const original = previous[0]?.status ?? "active";

  await db
    .update(productVariants)
    .set({ status })
    .where(eq(productVariants.id, variantId));

  restores.push(() =>
    db
      .update(productVariants)
      .set({ status: original })
      .where(eq(productVariants.id, variantId)),
  );
}

async function setProductStatus(productId: string, status: "active" | "archived") {
  const previous = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  const original = previous[0]?.status ?? "active";

  await db.update(products).set({ status }).where(eq(products.id, productId));

  restores.push(() =>
    db.update(products).set({ status: original }).where(eq(products.id, productId)),
  );
}

beforeAll(async () => {
  if (!hasRealDatabase) {
    return;
  }

  const fixtures = await loadFixtures(40);

  if (fixtures.length < 2) {
    throw new Error("Cart tests need two stocked products; run pnpm db:seed");
  }

  stocked = fixtures[0]!;
  second = fixtures[1]!;
});

afterEach(async () => {
  while (restores.length > 0) {
    const restore = restores.pop();

    if (restore) {
      await restore();
    }
  }
});

describe.skipIf(!hasRealDatabase)("cart validation", () => {
  it("returns an empty result for an empty cart", async () => {
    const result = await validateCart([]);

    expect(result.lines).toStrictEqual([]);
    expect(result.totals).toStrictEqual({
      delivery: null,
      discount: 0,
      savings: 0,
      subtotal: 0,
      total: 0,
    });
  });

  it("prices a line from the database, not from the request (CART-07)", async () => {
    const result = await validateCart([
      { productId: stocked.productId, quantity: 2, variantId: stocked.variantId },
    ]);

    const line = result.lines[0];

    expect(line?.unitPrice).toBe(stocked.unitPrice);
    expect(line?.lineTotal).toBe(stocked.unitPrice * 2);
    expect(result.totals.subtotal).toBe(stocked.unitPrice * 2);
    expect(result.totals.total).toBe(result.totals.subtotal);
    expect(line?.issues).toStrictEqual([]);
    expect(line?.purchasable).toBe(true);
  });

  it("carries a snapshot the client can render without trusting its own copy", async () => {
    const result = await validateCart([
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ]);

    const snapshot = result.lines[0]?.snapshot;

    expect(snapshot?.productName).toBeTruthy();
    expect(snapshot?.productSlug).toBeTruthy();
    expect(snapshot?.brandName).toBeTruthy();
    expect(snapshot?.sku).toBeTruthy();
  });

  it("sums a multi-line cart", async () => {
    const result = await validateCart([
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      { productId: second.productId, quantity: 1, variantId: second.variantId },
    ]);

    expect(result.lines).toHaveLength(2);
    expect(result.totals.subtotal).toBe(stocked.unitPrice + second.unitPrice);
    expect(result.itemCount).toBe(2);
  });

  it("clamps a quantity to available stock (CART-04)", async () => {
    await setAvailable(stocked.variantId, 2);

    const result = await validateCart([
      { productId: stocked.productId, quantity: 5, variantId: stocked.variantId },
    ]);

    const line = result.lines[0];

    expect(line?.quantity).toBe(2);
    expect(line?.requestedQuantity).toBe(5);
    expect(line?.lineTotal).toBe(stocked.unitPrice * 2);
    expect(line?.issues).toStrictEqual([
      { code: "QUANTITY_REDUCED", requestedQuantity: 5, resolvedQuantity: 2 },
    ]);
    expect(line?.purchasable).toBe(true);
  });

  it("marks a line out of stock and unpurchasable at zero available", async () => {
    await setAvailable(stocked.variantId, 0);

    const result = await validateCart([
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ]);

    const line = result.lines[0];

    expect(line?.issues.map((issue) => issue.code)).toStrictEqual(["OUT_OF_STOCK"]);
    expect(line?.purchasable).toBe(false);
    expect(line?.lineTotal).toBe(0);
    expect(result.totals.subtotal).toBe(0);
  });

  it("keeps the rest of the cart usable when one line fails (CART-02)", async () => {
    await setProductStatus(stocked.productId, "archived");

    const result = await validateCart([
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
      { productId: second.productId, quantity: 1, variantId: second.variantId },
    ]);

    const archived = result.lines.find((line) => line.variantId === stocked.variantId);
    const usable = result.lines.find((line) => line.variantId === second.variantId);

    expect(archived?.issues.map((issue) => issue.code)).toStrictEqual([
      "PRODUCT_UNAVAILABLE",
    ]);
    expect(archived?.snapshot).toBeNull();
    expect(result.removedLines.map((line) => line.variantId)).toStrictEqual([
      stocked.variantId,
    ]);

    expect(usable?.purchasable).toBe(true);
    expect(result.totals.subtotal).toBe(second.unitPrice);
  });

  it("reports an unknown product as unavailable rather than throwing (CART-02)", async () => {
    const result = await validateCart([
      { productId: MISSING_ID, quantity: 1, variantId: MISSING_ID },
    ]);

    expect(result.lines[0]?.issues.map((issue) => issue.code)).toStrictEqual([
      "PRODUCT_UNAVAILABLE",
    ]);
    expect(result.totals.subtotal).toBe(0);
  });

  it("rejects a variant that does not belong to the requested product", async () => {
    const result = await validateCart([
      { productId: second.productId, quantity: 1, variantId: stocked.variantId },
    ]);

    expect(result.lines[0]?.issues.map((issue) => issue.code)).toStrictEqual([
      "PRODUCT_UNAVAILABLE",
    ]);
  });

  it("never substitutes an unavailable variant (CART-03)", async () => {
    await setVariantStatus(stocked.variantId, "archived");

    const result = await validateCart([
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ]);

    const line = result.lines[0];

    expect(line?.variantId).toBe(stocked.variantId);
    expect(line?.issues.map((issue) => issue.code)).toContain("VARIANT_UNAVAILABLE");
    expect(line?.purchasable).toBe(false);
    expect(line?.snapshot?.productName).toBeTruthy();
  });

  it("bounds the number of lines it will price (CART-08)", async () => {
    const many = Array.from({ length: CART_MAX_LINES + 10 }, () => ({
      productId: stocked.productId,
      quantity: 1,
      variantId: stocked.variantId,
    }));

    const result = await validateCart(many);

    expect(result.lines).toHaveLength(CART_MAX_LINES);
  });

  it("bounds the per-line quantity it will price (CART-08)", async () => {
    const result = await validateCart([
      {
        productId: stocked.productId,
        quantity: CART_MAX_LINE_QUANTITY + 50,
        variantId: stocked.variantId,
      },
    ]);

    expect(result.lines[0]?.requestedQuantity).toBeLessThanOrEqual(
      CART_MAX_LINE_QUANTITY,
    );
  });

  it("reports savings separately and never subtracts them from the total", async () => {
    const result = await validateCart([
      { productId: stocked.productId, quantity: 1, variantId: stocked.variantId },
    ]);

    expect(result.totals.total).toBe(result.totals.subtotal);
    expect(result.totals.savings).toBeGreaterThanOrEqual(0);
    expect(result.totals.discount).toBe(0);
    expect(result.totals.delivery).toBeNull();
  });
});
