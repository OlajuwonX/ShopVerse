"use server";

import { redirect } from "next/navigation";

import { AUTH_RATE_LIMITS } from "@/constants/auth";
import {
  FORM_RENDERED_AT_FIELD_NAME,
  HONEYPOT_FIELD_NAME,
  MIN_FORM_FILL_MS,
  staffLoginSchema,
  type StaffLoginState,
} from "@/features/authentication/schemas/staff-login";
import { adminPath } from "@/server/auth/admin-route";
import { authenticateStaff } from "@/server/auth/authenticate";
import { clearSessionCookie } from "@/server/auth/cookies";
import { normalizeEmail } from "@/server/auth/passwords";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getCurrentSession, revokeSession } from "@/server/auth/sessions";
import { writeAuditLog } from "@/server/security/audit";
import { assertSameOrigin } from "@/server/security/origin";
import { getRequestContext } from "@/server/security/request-context";

/**
 * Every failure path returns this same message. Distinguishing "no such staff
 * account" from "wrong password" from "rate limited" would let an attacker
 * enumerate staff (primitives/07-security.md, SEC-03).
 */
const GENERIC_FAILURE = "Those details did not match an active account.";

async function recordFailure(reason: string, email: string | null) {
  await writeAuditLog({
    action: "staff.sign_in.failed",
    actorType: "system",
    // The email is a login attempt identifier, not resolved account PII, and is
    // required to investigate credential stuffing.
    after: { email, reason },
    targetType: "staff_session",
  });
}

export async function signInStaff(
  _previousState: StaffLoginState,
  formData: FormData,
): Promise<StaffLoginState> {
  await assertSameOrigin();

  const parsed = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    [HONEYPOT_FIELD_NAME]: formData.get(HONEYPOT_FIELD_NAME) ?? "",
    [FORM_RENDERED_AT_FIELD_NAME]: formData.get(FORM_RENDERED_AT_FIELD_NAME),
  });

  if (!parsed.success) {
    await recordFailure("invalid_input", null);

    return { error: GENERIC_FAILURE };
  }

  const email = normalizeEmail(parsed.data.email);

  if (parsed.data[HONEYPOT_FIELD_NAME] !== "") {
    await recordFailure("honeypot", email);

    return { error: GENERIC_FAILURE };
  }

  if (Date.now() - parsed.data[FORM_RENDERED_AT_FIELD_NAME] < MIN_FORM_FILL_MS) {
    await recordFailure("submitted_too_fast", email);

    return { error: GENERIC_FAILURE };
  }

  const { ip } = await getRequestContext();

  if (ip) {
    const ipLimit = await checkRateLimit(AUTH_RATE_LIMITS.staffLoginIp, ip);

    if (!ipLimit.allowed) {
      await recordFailure("ip_rate_limited", email);

      return { error: GENERIC_FAILURE };
    }
  }

  const result = await authenticateStaff({ email, password: parsed.data.password });

  if (!result.ok) {
    await recordFailure(result.reason, email);

    return { error: GENERIC_FAILURE };
  }

  await writeAuditLog({
    action: "staff.sign_in.succeeded",
    actorId: result.session.userId,
    actorType: "staff",
    targetId: result.session.staffAccountId,
    targetType: "staff_session",
  });

  // Outside any try/catch: redirect() signals control flow by throwing.
  redirect(adminPath());
}

export async function signOutStaff() {
  await assertSameOrigin();

  const session = await getCurrentSession();

  if (session) {
    await revokeSession(session.sessionId);
    await writeAuditLog({
      action: "staff.sign_out",
      actorId: session.userId,
      actorType: session.audience,
      targetId: session.staffAccountId,
      targetType: "staff_session",
    });
  }

  await clearSessionCookie();

  redirect(adminPath("login"));
}
