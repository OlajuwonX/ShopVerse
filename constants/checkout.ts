export const CHECKOUT_ATTEMPT_KEY = "shopverse:checkout-attempt";

export const CHECKOUT_HONEYPOT_FIELD = "delivery_reference";
export const CHECKOUT_RENDERED_AT_FIELD = "rendered_at";
export const CHECKOUT_MIN_FILL_MS = 2_000;

export const CHECKOUT_BURST_LIMIT = {
  action: "checkout_submit_burst",
  maxRequests: 8,
  windowMs: 10 * 1000,
} as const;

export const CHECKOUT_SUSTAINED_LIMIT = {
  action: "checkout_submit",
  blockMs: 10 * 60 * 1000,
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
} as const;

export const CHECKOUT_FIELD_LIMITS = {
  address: 200,
  city: 80,
  email: 254,
  instructions: 400,
  landmark: 120,
  name: 60,
  phone: 20,
  postalCode: 10,
} as const;
