import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import {
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  STAFF_SESSION_IDLE_SECONDS,
  STAFF_SESSION_MAX_AGE_SECONDS,
} from "@/constants/auth";
import { db } from "@/server/db";
import { sessions, staffAccounts, users } from "@/server/db/schema";
import { readSessionCookie, writeSessionCookie } from "@/server/auth/cookies";
import { createOpaqueToken, hashToken } from "@/server/auth/tokens";
import type { AuthenticatedSession, SessionAudience } from "@/server/auth/types";

type CreateSessionInput = {
  audience: SessionAudience;
  staffAccountId?: string;
  userId: string;
};

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function getSessionMaxAge(audience: SessionAudience) {
  return audience === "staff"
    ? STAFF_SESSION_MAX_AGE_SECONDS
    : CUSTOMER_SESSION_MAX_AGE_SECONDS;
}

export async function createSession(input: CreateSessionInput) {
  const now = new Date();
  const maxAge = getSessionMaxAge(input.audience);
  const expiresAt = addSeconds(now, maxAge);
  const idleExpiresAt =
    input.audience === "staff" ? addSeconds(now, STAFF_SESSION_IDLE_SECONDS) : null;
  const opaqueToken = createOpaqueToken();

  const inserted = await db
    .insert(sessions)
    .values({
      audience: input.audience,
      expiresAt,
      idleExpiresAt,
      sessionTokenHash: opaqueToken.hash,
      staffAccountId: input.staffAccountId,
      userId: input.userId,
    })
    .returning({ id: sessions.id });

  const sessionId = inserted[0]?.id;

  if (!sessionId) {
    throw new Error("Unable to create session");
  }

  await writeSessionCookie(opaqueToken.token, maxAge);

  return {
    audience: input.audience,
    expiresAt,
    idleExpiresAt,
    sessionId,
    staffAccountId: input.staffAccountId ?? null,
    userId: input.userId,
  } satisfies AuthenticatedSession;
}

export async function getCurrentSession() {
  const token = await readSessionCookie();

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const rows = await db
    .select({
      audience: sessions.audience,
      expiresAt: sessions.expiresAt,
      idleExpiresAt: sessions.idleExpiresAt,
      sessionId: sessions.id,
      staffAccountId: sessions.staffAccountId,
      staffStatus: staffAccounts.status,
      userId: sessions.userId,
      userStatus: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(staffAccounts, eq(sessions.staffAccountId, staffAccounts.id))
    .where(
      and(
        eq(sessions.sessionTokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row || row.userStatus !== "active") {
    return null;
  }

  if (row.idleExpiresAt && row.idleExpiresAt <= now) {
    return null;
  }

  if (row.audience === "staff" && row.staffStatus !== "active") {
    return null;
  }

  return {
    audience: row.audience,
    expiresAt: row.expiresAt,
    idleExpiresAt: row.idleExpiresAt,
    sessionId: row.sessionId,
    staffAccountId: row.staffAccountId,
    userId: row.userId,
  } satisfies AuthenticatedSession;
}

export async function requireCustomerSession() {
  const session = await getCurrentSession();

  return session?.audience === "customer" ? session : null;
}

export async function requireStaffSession() {
  const session = await getCurrentSession();

  return session?.audience === "staff" ? session : null;
}

export async function revokeSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}
