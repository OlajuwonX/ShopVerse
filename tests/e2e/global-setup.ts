import { neon } from "@neondatabase/serverless";

import { databaseUrl } from "./env";

/**
 * Actions the suite exercises repeatedly. Clearing them before a run stops counters
 * accumulating across back-to-back runs and tripping a limit that is correct in production.
 *
 * This resets test traffic only — it deliberately leaves auth lockouts alone.
 */
const TEST_RATE_LIMIT_ACTIONS = [
  "checkout_submit",
  "checkout_submit_burst",
  "search_suggestions",
  "search_suggestions_burst",
  "catalogue_page",
  "wishlist_hydration_burst",
  "cart_validation_burst",
  // Database-backed, so unlike the in-memory `*_burst` counters this one survives both a
  // server restart and the gap between runs. Omitting it is what made the two mobile cart
  // specs fail late in a full run and pass in isolation: once the 400-request window is
  // spent, /api/cart/validate answers 429 with an empty validation, so the cart page shows
  // no price-change banner and no hydrated line.
  "cart_validation",
];

export default async function globalSetup() {
  const url = databaseUrl();

  if (!url) {
    return;
  }

  const sql = neon(url);

  const deleted = await sql`
    delete from rate_limits
     where action = any(${TEST_RATE_LIMIT_ACTIONS})
     returning id
  `;

  if (deleted.length > 0) {
    console.log(`e2e setup: cleared ${deleted.length} rate-limit counter(s)`);
  }
}
