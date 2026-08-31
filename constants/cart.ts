export const GUEST_CART_KEY = "shopverse:guest-cart";

export const CART_MAX_LINES = 50;
export const CART_MAX_LINE_QUANTITY = 20;

/**
 * In-memory, therefore per-instance: a best-effort pre-filter, not the control of record.
 * On serverless the effective allowance is this figure times the instance count.
 */
export const CART_BURST_LIMIT = {
  action: "cart_validation_burst",
  maxRequests: 30,
  windowMs: 10 * 1000,
} as const;

/** Database-backed and atomic, so this is the limit that actually holds (audit M-4). */
export const CART_SUSTAINED_LIMIT = {
  action: "cart_validation",
  blockMs: 5 * 60 * 1000,
  maxAttempts: 400,
  windowMs: 15 * 60 * 1000,
} as const;

export const cartIssueCodes = [
  "PRICE_CHANGED",
  "PRODUCT_UNAVAILABLE",
  "VARIANT_UNAVAILABLE",
  "QUANTITY_REDUCED",
  "OUT_OF_STOCK",
] as const;

export type CartIssueCode = (typeof cartIssueCodes)[number];
