import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { neon } from "@neondatabase/serverless";

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
];

function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL;

  if (fromEnv && !fromEnv.includes("placeholder")) {
    return fromEnv;
  }

  const file = resolve(process.cwd(), ".env");

  if (!existsSync(file)) {
    return null;
  }

  const match = /^DATABASE_URL=(.*)$/m.exec(readFileSync(file, "utf8"));
  const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");

  return value && !value.includes("placeholder") ? value : null;
}

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
