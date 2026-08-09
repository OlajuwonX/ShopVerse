import "server-only";

import { and, eq } from "drizzle-orm";

import { AUTH_RATE_LIMITS } from "@/constants/auth";
import {
  loginCredentialsSchema,
  type LoginCredentials,
} from "@/features/authentication/schemas/credentials";
import { db } from "@/server/db";
import { customerProfiles, staffAccounts, users } from "@/server/db/schema";
import { normalizeEmail, verifyPassword } from "@/server/auth/passwords";
import { checkRateLimit, clearRateLimit } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/sessions";
import type { AuthResult } from "@/server/auth/types";

const invalidCredentials = {
  ok: false,
  reason: "invalid_credentials",
} as const satisfies AuthResult;

const rateLimited = {
  ok: false,
  reason: "rate_limited",
} as const satisfies AuthResult;

function parseCredentials(input: unknown) {
  const parsed = loginCredentialsSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  return {
    email: normalizeEmail(parsed.data.email),
    password: parsed.data.password,
  } satisfies LoginCredentials;
}

export async function authenticateCustomer(input: unknown): Promise<AuthResult> {
  const credentials = parseCredentials(input);

  if (!credentials) {
    return invalidCredentials;
  }

  const rateLimit = await checkRateLimit(
    AUTH_RATE_LIMITS.customerLogin,
    credentials.email,
  );

  if (!rateLimit.allowed) {
    return rateLimited;
  }

  const rows = await db
    .select({
      customerProfileId: customerProfiles.id,
      passwordHash: users.passwordHash,
      userId: users.id,
      userStatus: users.status,
    })
    .from(users)
    .innerJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(eq(users.email, credentials.email))
    .limit(1);

  const user = rows[0];

  if (!user?.passwordHash || user.userStatus !== "active") {
    return invalidCredentials;
  }

  const passwordMatches = await verifyPassword(credentials.password, user.passwordHash);

  if (!passwordMatches) {
    return invalidCredentials;
  }

  await clearRateLimit(AUTH_RATE_LIMITS.customerLogin, credentials.email);

  return {
    ok: true,
    session: await createSession({ audience: "customer", userId: user.userId }),
  };
}

export async function authenticateStaff(input: unknown): Promise<AuthResult> {
  const credentials = parseCredentials(input);

  if (!credentials) {
    return invalidCredentials;
  }

  const rateLimit = await checkRateLimit(
    AUTH_RATE_LIMITS.staffLogin,
    credentials.email,
  );

  if (!rateLimit.allowed) {
    return rateLimited;
  }

  const rows = await db
    .select({
      passwordHash: users.passwordHash,
      staffAccountId: staffAccounts.id,
      staffStatus: staffAccounts.status,
      userId: users.id,
      userStatus: users.status,
    })
    .from(users)
    .innerJoin(staffAccounts, eq(staffAccounts.userId, users.id))
    .where(and(eq(users.email, credentials.email), eq(staffAccounts.status, "active")))
    .limit(1);

  const staff = rows[0];

  if (
    !staff?.passwordHash ||
    staff.userStatus !== "active" ||
    staff.staffStatus !== "active"
  ) {
    return invalidCredentials;
  }

  const passwordMatches = await verifyPassword(
    credentials.password,
    staff.passwordHash,
  );

  if (!passwordMatches) {
    return invalidCredentials;
  }

  await clearRateLimit(AUTH_RATE_LIMITS.staffLogin, credentials.email);

  return {
    ok: true,
    session: await createSession({
      audience: "staff",
      staffAccountId: staff.staffAccountId,
      userId: staff.userId,
    }),
  };
}
