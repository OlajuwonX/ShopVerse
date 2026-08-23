export const GUEST_WISHLIST_KEY = "shopverse:guest-wishlist";

export const WISHLIST_MAX_ITEMS = 100;

export const WISHLIST_IDS_PARAM = "ids";

export const WISHLIST_BURST_LIMIT = {
  action: "wishlist_hydration_burst",
  maxRequests: 20,
  windowMs: 10 * 1000,
} as const;
