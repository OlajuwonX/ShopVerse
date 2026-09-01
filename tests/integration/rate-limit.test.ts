import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { hashToken } from "@/server/auth/tokens";
import { checkRateLimit, clearRateLimit } from "@/server/auth/rate-limit";
import { db } from "@/server/db";
import { rateLimits } from "@/server/db/schema";
import { hasRealDatabase } from "@/tests/setup/env";

const actions: string[] = [];

function config(overrides: Partial<Parameters<typeof checkRateLimit>[0]> = {}) {
  const action = `test_rl_${crypto.randomUUID()}`;

  actions.push(action);

  return {
    action,
    blockMs: 60_000,
    maxAttempts: 5,
    windowMs: 60_000,
    ...overrides,
  };
}

async function readRow(action: string, identifier: string) {
  const rows = await db
    .select({
      attempts: rateLimits.attempts,
      blockedUntil: rateLimits.blockedUntil,
    })
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.action, action),
        eq(rateLimits.identifierHash, hashToken(identifier.toLowerCase())),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

afterEach(async () => {
  if (actions.length > 0) {
    await db.delete(rateLimits).where(inArray(rateLimits.action, actions));
    actions.length = 0;
  }
});

describe.skipIf(!hasRealDatabase)("checkRateLimit", () => {
  it("counts sequential attempts and blocks past the maximum", async () => {
    const limit = config({ maxAttempts: 3 });

    expect((await checkRateLimit(limit, "seq")).allowed).toBe(true);
    expect((await checkRateLimit(limit, "seq")).allowed).toBe(true);
    expect((await checkRateLimit(limit, "seq")).allowed).toBe(true);

    const fourth = await checkRateLimit(limit, "seq");

    expect(fourth.allowed).toBe(false);

    if (!fourth.allowed) {
      expect(fourth.retryAfter.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("counts every concurrent attempt, not just one (H-1)", async () => {
    const limit = config({ maxAttempts: 1000 });

    await Promise.all(Array.from({ length: 12 }, () => checkRateLimit(limit, "burst")));

    const row = await readRow(limit.action, "burst");

    expect(row?.attempts, "12 parallel calls must register 12 attempts").toBe(12);
  });

  it("blocks a concurrent burst that exceeds the maximum", async () => {
    const limit = config({ maxAttempts: 5 });

    await Promise.all(
      Array.from({ length: 12 }, () => checkRateLimit(limit, "burst-block")),
    );

    const row = await readRow(limit.action, "burst-block");

    expect(row?.blockedUntil, "the identifier must end up blocked").not.toBeNull();
    expect((await checkRateLimit(limit, "burst-block")).allowed).toBe(false);
  });

  it("a parallel burst cannot slip under the limit the way a lost update would", async () => {
    const limit = config({ maxAttempts: 5 });

    const results = await Promise.all(
      Array.from({ length: 12 }, () => checkRateLimit(limit, "flood")),
    );

    const allowed = results.filter((result) => result.allowed).length;

    expect(allowed, "at most maxAttempts may be allowed through").toBeLessThanOrEqual(
      5,
    );
    expect(allowed).toBeGreaterThan(0);
  });

  it("keeps separate identifiers in separate buckets", async () => {
    const limit = config({ maxAttempts: 2 });

    await checkRateLimit(limit, "alice");
    await checkRateLimit(limit, "alice");
    await checkRateLimit(limit, "alice");

    expect((await checkRateLimit(limit, "alice")).allowed).toBe(false);
    expect((await checkRateLimit(limit, "bob")).allowed).toBe(true);
  });

  it("treats identifiers case-insensitively", async () => {
    const limit = config({ maxAttempts: 2 });

    await checkRateLimit(limit, "Case@Example.com");
    await checkRateLimit(limit, "case@example.com");
    await checkRateLimit(limit, "CASE@EXAMPLE.COM");

    expect((await checkRateLimit(limit, "case@example.com")).allowed).toBe(false);
  });

  it("starts a fresh window once the old one has expired", async () => {
    const limit = config({ maxAttempts: 2, windowMs: 1 });

    await checkRateLimit(limit, "rolling");
    await checkRateLimit(limit, "rolling");
    await checkRateLimit(limit, "rolling");

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect((await checkRateLimit(limit, "rolling")).allowed).toBe(true);
    expect((await readRow(limit.action, "rolling"))?.attempts).toBe(1);
  });

  it("does not extend an existing block while it is still active", async () => {
    const limit = config({ maxAttempts: 1, blockMs: 60_000 });

    await checkRateLimit(limit, "held");
    await checkRateLimit(limit, "held");

    const first = await readRow(limit.action, "held");

    await checkRateLimit(limit, "held");
    await checkRateLimit(limit, "held");

    const later = await readRow(limit.action, "held");

    expect(later?.blockedUntil?.getTime()).toBe(first?.blockedUntil?.getTime());
    expect(later?.attempts, "a blocked caller stops incrementing").toBe(
      first?.attempts,
    );
  });

  it("clearRateLimit releases the identifier", async () => {
    const limit = config({ maxAttempts: 1 });

    await checkRateLimit(limit, "cleared");
    await checkRateLimit(limit, "cleared");

    expect((await checkRateLimit(limit, "cleared")).allowed).toBe(false);

    await clearRateLimit(limit, "cleared");

    expect((await checkRateLimit(limit, "cleared")).allowed).toBe(true);
  });

  it("stores only a hash of the identifier, never the identifier itself", async () => {
    const limit = config();

    await checkRateLimit(limit, "person@example.com");

    const rows = await db
      .select({ identifierHash: rateLimits.identifierHash })
      .from(rateLimits)
      .where(eq(rateLimits.action, limit.action));

    expect(rows[0]?.identifierHash).not.toContain("person@example.com");
    expect(rows[0]?.identifierHash).toBe(hashToken("person@example.com"));
  });
});
