import "server-only";

import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import { WISHLIST_MAX_ITEMS } from "@/constants/wishlist";
import { db } from "@/server/db";
import { products, wishlistItems } from "@/server/db/schema";

export type WishlistMergeResult = {
  dropped: number;
  ids: string[];
  merged: number;
};

export class WishlistFullError extends Error {
  constructor() {
    super(`A wishlist holds at most ${WISHLIST_MAX_ITEMS} products`);
    this.name = "WishlistFullError";
  }
}

export async function listWishlistProductIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .where(and(eq(wishlistItems.userId, userId), eq(products.status, "active")))
    .orderBy(desc(wishlistItems.createdAt))
    .limit(WISHLIST_MAX_ITEMS);

  return rows.map((row) => row.productId);
}

async function countWishlistItems(userId: string) {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId));

  return rows[0]?.total ?? 0;
}

async function isSaved(userId: string, productId: string) {
  const rows = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(
      and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)),
    )
    .limit(1);

  return rows.length > 0;
}

export async function setWishlistItem(
  userId: string,
  productId: string,
  saved: boolean,
): Promise<string[]> {
  if (!saved) {
    await db
      .delete(wishlistItems)
      .where(
        and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)),
      );

    return listWishlistProductIds(userId);
  }

  const purchasable = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.status, "active")))
    .limit(1);

  if (!purchasable[0]) {
    return listWishlistProductIds(userId);
  }

  if (
    (await countWishlistItems(userId)) >= WISHLIST_MAX_ITEMS &&
    !(await isSaved(userId, productId))
  ) {
    throw new WishlistFullError();
  }

  await db
    .insert(wishlistItems)
    .values({ productId, userId })
    .onConflictDoNothing({
      target: [wishlistItems.userId, wishlistItems.productId],
    });

  return listWishlistProductIds(userId);
}

export async function mergeGuestWishlist(
  userId: string,
  guestProductIds: readonly string[],
): Promise<WishlistMergeResult> {
  const requested = [...new Set(guestProductIds)].slice(0, WISHLIST_MAX_ITEMS);

  if (requested.length === 0) {
    return { dropped: 0, ids: await listWishlistProductIds(userId), merged: 0 };
  }

  const existing = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.userId, userId),
        inArray(wishlistItems.productId, requested),
      ),
    )
    .limit(requested.length);

  const alreadySaved = existing.map((row) => row.productId);

  const candidates = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.status, "active"),
        inArray(products.id, requested),
        ...(alreadySaved.length > 0 ? [notInArray(products.id, alreadySaved)] : []),
      ),
    )
    .limit(requested.length);

  const headroom = Math.max(0, WISHLIST_MAX_ITEMS - (await countWishlistItems(userId)));
  const insertable = candidates.slice(0, headroom);

  if (insertable.length > 0) {
    await db
      .insert(wishlistItems)
      .values(insertable.map((product) => ({ productId: product.id, userId })))
      .onConflictDoNothing({
        target: [wishlistItems.userId, wishlistItems.productId],
      });
  }

  const ids = await listWishlistProductIds(userId);
  const settled = new Set(ids);
  const merged = requested.filter((productId) => settled.has(productId)).length;

  return { dropped: requested.length - merged, ids, merged };
}
