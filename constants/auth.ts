export const SESSION_COOKIE_NAME = "shopverse_session";

export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const STAFF_SESSION_IDLE_SECONDS = 60 * 30;

export const BCRYPT_COST = 12;

export const AUTH_RATE_LIMITS = {
  customerLogin: {
    action: "customer_login",
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  },
  staffLogin: {
    action: "staff_login",
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  },
  // Per-IP ceiling so credential stuffing cannot rotate through email
  // addresses to stay under the per-identifier limit (primitives/07-security.md).
  staffLoginIp: {
    action: "staff_login_ip",
    maxAttempts: 20,
    windowMs: 15 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  },
  passwordReset: {
    action: "password_reset",
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  },
} as const;
