import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { AUTH_RATE_LIMITS } from "@/constants/auth";
import { db } from "@/server/db";
import { rateLimits } from "@/server/db/schema";
import { hashToken } from "@/server/auth/tokens";

export type RateLimitConfig = {
  action: string;
  blockMs: number;
  maxAttempts: number;
  windowMs: number;
};

export type AuthRateLimitConfig =
  (typeof AUTH_RATE_LIMITS)[keyof typeof AUTH_RATE_LIMITS];

type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: Date };

function addMs(date: Date, ms: number) {
  return new Date(date.getTime() + ms);
}

/**
 * The counter is advanced by a single statement so Postgres arbitrates concurrency.
 * A read-then-write here lets N simultaneous requests all observe the same `attempts`
 * and write the same value, advancing the counter by one instead of N — which is how a
 * brute-force or checkout flood slips through a limit that looks correct in isolation.
 */
export async function checkRateLimit(config: RateLimitConfig, identifier: string) {
  const now = new Date();
  const windowFloor = addMs(now, -config.windowMs);
  const blockUntil = addMs(now, config.blockMs);
  const identifierHash = hashToken(identifier.toLowerCase());

  const stillBlocked = sql`${rateLimits.blockedUntil} is not null and ${rateLimits.blockedUntil} > ${now}`;
  const windowExpired = sql`${rateLimits.windowStartedAt} <= ${windowFloor}`;

  const rows = await db
    .insert(rateLimits)
    .values({
      action: config.action,
      attempts: 1,
      blockedUntil: null,
      identifierHash,
      windowStartedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        attempts: sql`case
          when ${stillBlocked} then ${rateLimits.attempts}
          when ${windowExpired} then 1
          else ${rateLimits.attempts} + 1
        end`,
        blockedUntil: sql`case
          when ${stillBlocked} then ${rateLimits.blockedUntil}
          when ${windowExpired} then null
          when ${rateLimits.attempts} + 1 > ${config.maxAttempts} then ${blockUntil}
          else null
        end`,
        updatedAt: now,
        windowStartedAt: sql`case
          when ${stillBlocked} then ${rateLimits.windowStartedAt}
          when ${windowExpired} then ${now}
          else ${rateLimits.windowStartedAt}
        end`,
      },
      target: [rateLimits.action, rateLimits.identifierHash],
    })
    .returning({ blockedUntil: rateLimits.blockedUntil });

  const blockedUntil = rows[0]?.blockedUntil ?? null;

  if (blockedUntil && blockedUntil > now) {
    return { allowed: false, retryAfter: blockedUntil } satisfies RateLimitResult;
  }

  return { allowed: true } satisfies RateLimitResult;
}

export async function clearRateLimit(config: RateLimitConfig, identifier: string) {
  await db
    .update(rateLimits)
    .set({ attempts: 0, blockedUntil: null, updatedAt: new Date() })
    .where(
      and(
        eq(rateLimits.action, config.action),
        eq(rateLimits.identifierHash, hashToken(identifier.toLowerCase())),
      ),
    );
}

export async function isRateLimited(config: RateLimitConfig, identifier: string) {
  const result = await checkRateLimit(config, identifier);

  return !result.allowed;
}
