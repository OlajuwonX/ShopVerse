import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WISHLIST_MAX_ITEMS } from "@/constants/wishlist";
import { db } from "@/server/db";
import { products, users, wishlistItems } from "@/server/db/schema";
import { listProductsByIds } from "@/server/services/products";
import {
  listWishlistProductIds,
  mergeGuestWishlist,
  setWishlistItem,
  WishlistFullError,
} from "@/server/services/wishlist";
import { hasRealDatabase } from "@/tests/setup/env";

const MISSING_PRODUCT_ID = "00000000-0000-4000-8000-000000000000";

const createdUserIds: string[] = [];

let catalogue: string[] = [];
let activeProductCount = 0;

async function createTestUser(label: string) {
  const rows = await db
    .insert(users)
    .values({
      email: `wishlist-${label}-${Date.now()}-${createdUserIds.length}@shopverse.test`,
      name: "Wishlist test",
    })
    .returning({ id: users.id });

  const userId = rows[0]?.id;

  if (!userId) {
    throw new Error("Could not create a test user");
  }

  createdUserIds.push(userId);

  return userId;
}

async function activeProductIds(limit: number) {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.status, "active"))
    .limit(limit);

  return rows.map((row) => row.id);
}

beforeAll(async () => {
  if (!hasRealDatabase) {
    return;
  }

  catalogue = await activeProductIds(6);

  const counted = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.status, "active"));

  activeProductCount = counted[0]?.total ?? 0;

  if (catalogue.length < 3) {
    throw new Error("Wishlist tests need three active products; run pnpm db:seed");
  }
});

afterAll(async () => {
  if (createdUserIds.length === 0) {
    return;
  }

  await db.delete(wishlistItems).where(inArray(wishlistItems.userId, createdUserIds));
  await db.delete(users).where(inArray(users.id, createdUserIds));
});

describe.skipIf(!hasRealDatabase)("account wishlist", () => {
  it("saves and removes a product for its owner", async () => {
    const userId = await createTestUser("owner");
    const first = catalogue[0]!;

    expect(await setWishlistItem(userId, first, true)).toStrictEqual([first]);
    expect(await setWishlistItem(userId, first, false)).toStrictEqual([]);
  });

  it("saving twice inserts one row (WISH-06)", async () => {
    const userId = await createTestUser("idempotent");
    const first = catalogue[0]!;

    await setWishlistItem(userId, first, true);
    await setWishlistItem(userId, first, true);

    const rows = await db
      .select({ id: wishlistItems.id })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    expect(rows).toHaveLength(1);
  });

  it("concurrent saves of the same product settle on one row (WISH-06)", async () => {
    const userId = await createTestUser("concurrent");
    const first = catalogue[0]!;

    await Promise.all([
      setWishlistItem(userId, first, true),
      setWishlistItem(userId, first, true),
      setWishlistItem(userId, first, true),
    ]);

    const rows = await db
      .select({ id: wishlistItems.id })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    expect(rows).toHaveLength(1);
  });

  it("removing a product that was never saved changes nothing", async () => {
    const userId = await createTestUser("noop-remove");

    expect(await setWishlistItem(userId, catalogue[0]!, false)).toStrictEqual([]);
  });

  it("refuses to save an identifier with no active product", async () => {
    const userId = await createTestUser("missing");

    expect(await setWishlistItem(userId, MISSING_PRODUCT_ID, true)).toStrictEqual([]);
  });

  it("never returns a wishlist belonging to another customer (IDOR)", async () => {
    const owner = await createTestUser("idor-owner");
    const other = await createTestUser("idor-other");

    await setWishlistItem(owner, catalogue[0]!, true);
    await setWishlistItem(owner, catalogue[1]!, true);

    expect(await listWishlistProductIds(other)).toStrictEqual([]);

    await setWishlistItem(other, catalogue[2]!, true);

    expect(await listWishlistProductIds(other)).toStrictEqual([catalogue[2]]);
    expect(await listWishlistProductIds(owner)).toHaveLength(2);
  });

  it("a customer cannot remove a product saved by someone else", async () => {
    const owner = await createTestUser("cross-owner");
    const attacker = await createTestUser("cross-attacker");

    await setWishlistItem(owner, catalogue[0]!, true);
    await setWishlistItem(attacker, catalogue[0]!, false);

    expect(await listWishlistProductIds(owner)).toStrictEqual([catalogue[0]]);
  });
});

describe.skipIf(!hasRealDatabase)("guest wishlist merge", () => {
  it("merges guest identifiers into an empty account wishlist (WISH-02)", async () => {
    const userId = await createTestUser("merge-empty");
    const guest = [catalogue[0]!, catalogue[1]!];

    const result = await mergeGuestWishlist(userId, guest);

    expect(result.merged).toBe(2);
    expect(result.dropped).toBe(0);
    expect([...result.ids].sort()).toStrictEqual([...guest].sort());
  });

  it("deduplicates against products already saved in the account (WISH-02)", async () => {
    const userId = await createTestUser("merge-overlap");

    await setWishlistItem(userId, catalogue[0]!, true);

    const result = await mergeGuestWishlist(userId, [
      catalogue[0]!,
      catalogue[0]!,
      catalogue[1]!,
    ]);

    expect(result.merged).toBe(2);
    expect(result.ids).toHaveLength(2);

    const rows = await db
      .select({ id: wishlistItems.id })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    expect(rows).toHaveLength(2);
  });

  it("drops identifiers with no matching active product (WISH-04)", async () => {
    const userId = await createTestUser("merge-missing");

    const result = await mergeGuestWishlist(userId, [
      catalogue[0]!,
      MISSING_PRODUCT_ID,
    ]);

    expect(result.merged).toBe(1);
    expect(result.dropped).toBe(1);
    expect(result.ids).toStrictEqual([catalogue[0]]);
  });

  it("re-running a merge is safe, so a failed merge can be retried (WISH-03)", async () => {
    const userId = await createTestUser("merge-retry");
    const guest = [catalogue[0]!, catalogue[1]!];

    const first = await mergeGuestWishlist(userId, guest);
    const second = await mergeGuestWishlist(userId, guest);

    expect(second.merged).toBe(first.merged);
    expect([...second.ids].sort()).toStrictEqual([...first.ids].sort());

    const rows = await db
      .select({ id: wishlistItems.id })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    expect(rows).toHaveLength(2);
  });

  it("an empty guest wishlist leaves the account untouched", async () => {
    const userId = await createTestUser("merge-empty-guest");

    await setWishlistItem(userId, catalogue[0]!, true);

    const result = await mergeGuestWishlist(userId, []);

    expect(result.merged).toBe(0);
    expect(result.ids).toStrictEqual([catalogue[0]]);
  });

  it("ignores anything beyond the wishlist bound", async () => {
    const userId = await createTestUser("merge-bounded");
    const padding = Array.from(
      { length: WISHLIST_MAX_ITEMS * 2 },
      (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );

    const result = await mergeGuestWishlist(userId, [...padding, catalogue[0]!]);

    expect(result.ids.length).toBeLessThanOrEqual(WISHLIST_MAX_ITEMS);
    expect(result.merged).toBe(0);
  });
});

describe.skipIf(!hasRealDatabase)("wishlist bounds", () => {
  it("names the bound it enforces", () => {
    expect(new WishlistFullError().message).toContain(String(WISHLIST_MAX_ITEMS));
  });

  it("refuses a save that would exceed the bound", async () => {
    if (activeProductCount <= WISHLIST_MAX_ITEMS) {
      expect(activeProductCount).toBeGreaterThan(0);

      return;
    }

    const userId = await createTestUser("cap");
    const available = await activeProductIds(WISHLIST_MAX_ITEMS + 1);

    await db
      .insert(wishlistItems)
      .values(
        available
          .slice(0, WISHLIST_MAX_ITEMS)
          .map((productId) => ({ productId, userId })),
      );

    await expect(
      setWishlistItem(userId, available[WISHLIST_MAX_ITEMS]!, true),
    ).rejects.toBeInstanceOf(WishlistFullError);
  });
});

describe.skipIf(!hasRealDatabase)("wishlist hydration", () => {
  it("returns products in the requested order", async () => {
    const wanted = [catalogue[2]!, catalogue[0]!, catalogue[1]!];
    const items = await listProductsByIds(wanted);

    expect(items.map((item) => item.id)).toStrictEqual(wanted);
  });

  it("prunes identifiers with no active product (WISH-04)", async () => {
    const items = await listProductsByIds([catalogue[0]!, MISSING_PRODUCT_ID]);

    expect(items.map((item) => item.id)).toStrictEqual([catalogue[0]]);
  });

  it("returns nothing for an empty request", async () => {
    expect(await listProductsByIds([])).toStrictEqual([]);
  });

  it("never returns a duplicate for a repeated identifier", async () => {
    const items = await listProductsByIds([catalogue[0]!, catalogue[0]!]);

    expect(items).toHaveLength(1);
  });
});
