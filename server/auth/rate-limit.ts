import "server-only";

import { and, eq } from "drizzle-orm";

import { AUTH_RATE_LIMITS } from "@/constants/auth";
import { db } from "@/server/db";
import { rateLimits } from "@/server/db/schema";
import { hashToken } from "@/server/auth/tokens";

type RateLimitConfig = (typeof AUTH_RATE_LIMITS)[keyof typeof AUTH_RATE_LIMITS];

type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: Date };

function addMs(date: Date, ms: number) {
  return new Date(date.getTime() + ms);
}

export async function checkRateLimit(config: RateLimitConfig, identifier: string) {
  const now = new Date();
  const identifierHash = hashToken(identifier.toLowerCase());

  const existing = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.action, config.action),
        eq(rateLimits.identifierHash, identifierHash),
      ),
    )
    .limit(1);

  const row = existing[0];

  if (row?.blockedUntil && row.blockedUntil > now) {
    return { allowed: false, retryAfter: row.blockedUntil } satisfies RateLimitResult;
  }

  if (!row || row.windowStartedAt <= addMs(now, -config.windowMs)) {
    await db
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
          attempts: 1,
          blockedUntil: null,
          updatedAt: now,
          windowStartedAt: now,
        },
        target: [rateLimits.action, rateLimits.identifierHash],
      });

    return { allowed: true } satisfies RateLimitResult;
  }

  const attempts = row.attempts + 1;
  const blockedUntil =
    attempts > config.maxAttempts ? addMs(now, config.blockMs) : null;

  await db
    .update(rateLimits)
    .set({ attempts, blockedUntil, updatedAt: now })
    .where(eq(rateLimits.id, row.id));

  if (blockedUntil) {
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
