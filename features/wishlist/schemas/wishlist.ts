import { z } from "zod";

import { WISHLIST_MAX_ITEMS } from "@/constants/wishlist";

export const wishlistProductIdSchema = z.uuid();

export const storedWishlistSchema = z.object({
  items: z.array(wishlistProductIdSchema).max(WISHLIST_MAX_ITEMS),
  version: z.literal(1),
});

export type StoredWishlist = z.infer<typeof storedWishlistSchema>;

export function normaliseWishlistIds(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();

  for (const entry of ids) {
    const parsed = wishlistProductIdSchema.safeParse(entry);

    if (parsed.success && !seen.has(parsed.data)) {
      seen.add(parsed.data);
    }

    if (seen.size === WISHLIST_MAX_ITEMS) {
      break;
    }
  }

  return [...seen];
}
