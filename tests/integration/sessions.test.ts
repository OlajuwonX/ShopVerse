import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hasRealDatabase } from "@/tests/setup/env";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      delete: (name: string) => cookieStore.delete(name),
      get: (name: string) =>
        cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
      set: (name: string, value: string) => cookieStore.set(name, value),
    }),
}));

const { SESSION_COOKIE_NAME } = await import("@/constants/auth");
const { db } = await import("@/server/db");
const { sessions, staffAccounts } = await import("@/server/db/schema");
const {
  createSession,
  getCurrentSession,
  requireCustomerSession,
  requireStaffSession,
  revokeSession,
} = await import("@/server/auth/sessions");

const createdSessionIds: string[] = [];

async function activeStaffAccount() {
  const rows = await db
    .select({ id: staffAccounts.id, userId: staffAccounts.userId })
    .from(staffAccounts)
    .where(eq(staffAccounts.status, "active"))
    .limit(1);

  return rows[0] ?? null;
}

async function startStaffSession() {
  const account = await activeStaffAccount();

  if (!account) {
    throw new Error("No active staff account; run pnpm db:seed");
  }

  const session = await createSession({
    audience: "staff",
    staffAccountId: account.id,
    userId: account.userId,
  });

  createdSessionIds.push(session.sessionId);

  return session;
}

afterEach(async () => {
  cookieStore.clear();

  while (createdSessionIds.length > 0) {
    const id = createdSessionIds.pop();

    if (id) {
      await db.delete(sessions).where(eq(sessions.id, id));
    }
  }
});

describe.skipIf(!hasRealDatabase)("session lifecycle", () => {
  it("issues an opaque cookie and resolves it back to the session", async () => {
    const created = await startStaffSession();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);

    expect(cookie).toBeDefined();

    const resolved = await getCurrentSession();

    expect(resolved?.sessionId).toBe(created.sessionId);
    expect(resolved?.audience).toBe("staff");
  });

  it("never stores the raw token in the database", async () => {
    await startStaffSession();

    const cookie = cookieStore.get(SESSION_COOKIE_NAME) ?? "";
    const stored = await db
      .select({ hash: sessions.sessionTokenHash })
      .from(sessions)
      .where(eq(sessions.sessionTokenHash, cookie));

    expect(cookie.length).toBeGreaterThan(0);
    expect(stored).toStrictEqual([]);
  });

  it("returns null when no cookie is present", async () => {
    expect(await getCurrentSession()).toBeNull();
  });

  it("returns null for a token that does not match any session", async () => {
    cookieStore.set(SESSION_COOKIE_NAME, "not-a-real-token");

    expect(await getCurrentSession()).toBeNull();
  });

  it("rejects a revoked session (ACC: expired/disabled session)", async () => {
    const created = await startStaffSession();

    expect(await getCurrentSession()).not.toBeNull();

    await revokeSession(created.sessionId);

    expect(await getCurrentSession()).toBeNull();
  });

  it("rejects a session past its absolute expiry", async () => {
    const created = await startStaffSession();

    await db
      .update(sessions)
      .set({
        createdAt: new Date(Date.now() - 7_200_000),
        expiresAt: new Date(Date.now() - 3_600_000),
        idleExpiresAt: new Date(Date.now() - 3_600_000),
      })
      .where(eq(sessions.id, created.sessionId));

    expect(await getCurrentSession()).toBeNull();
  });

  it("rejects a staff session past its idle timeout", async () => {
    const created = await startStaffSession();

    await db
      .update(sessions)
      .set({ idleExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(sessions.id, created.sessionId));

    expect(await getCurrentSession()).toBeNull();
  });

  it("rejects a staff session whose account is no longer active", async () => {
    const created = await startStaffSession();
    const account = await activeStaffAccount();

    await db
      .update(staffAccounts)
      .set({ status: "disabled" })
      .where(eq(staffAccounts.id, account?.id ?? ""));

    try {
      expect(await getCurrentSession()).toBeNull();
    } finally {
      await db
        .update(staffAccounts)
        .set({ status: "active" })
        .where(eq(staffAccounts.id, account?.id ?? ""));
    }

    expect(created.sessionId).toBeDefined();
  });
});

describe.skipIf(!hasRealDatabase)("audience separation (SEC-02)", () => {
  it("does not return a staff session to a customer-scoped read", async () => {
    await startStaffSession();

    expect(await requireStaffSession()).not.toBeNull();
    expect(await requireCustomerSession()).toBeNull();
  });

  it("returns null for both when there is no session", async () => {
    expect(await requireStaffSession()).toBeNull();
    expect(await requireCustomerSession()).toBeNull();
  });
});
