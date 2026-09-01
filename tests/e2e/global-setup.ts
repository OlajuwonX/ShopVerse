import { neon } from "@neondatabase/serverless";

import { databaseUrl } from "./env";

const TEST_RATE_LIMIT_ACTIONS = [
  "checkout_submit",
  "checkout_submit_burst",
  "search_suggestions",
  "search_suggestions_burst",
  "catalogue_page",
  "wishlist_hydration_burst",
  "cart_validation_burst",
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
