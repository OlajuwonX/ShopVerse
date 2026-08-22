export const SEARCH_QUERY_PARAM = "q";
export const SEARCH_MAX_LENGTH = 120;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 300;

export const SUGGESTION_PRODUCT_LIMIT = 6;
export const SUGGESTION_CATEGORY_LIMIT = 4;
export const SUGGESTION_BRAND_LIMIT = 4;

export const RECENT_SEARCHES_KEY = "shopverse:recent-searches";
export const MAX_RECENT_SEARCHES = 6;

export const SEARCH_BURST_LIMIT = {
  action: "search_suggestions_burst",
  maxRequests: 15,
  windowMs: 10 * 1000,
} as const;

export const SEARCH_SUSTAINED_LIMIT = {
  action: "search_suggestions",
  blockMs: 5 * 60 * 1000,
  maxAttempts: 90,
  windowMs: 5 * 60 * 1000,
} as const;

export const CATALOGUE_BURST_LIMIT = {
  action: "catalogue_page",
  maxRequests: 40,
  windowMs: 10 * 1000,
} as const;
