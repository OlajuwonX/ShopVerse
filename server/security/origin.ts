import "server-only";

import { headers } from "next/headers";

import { serverEnv } from "@/config/env";

/**
 * CSRF model (MASTER §73, primitives/07-security.md):
 *
 * 1. Session cookies are HttpOnly + SameSite=Lax + Secure in production.
 * 2. State-changing requests validate Origin/Referer against APP_ORIGIN.
 * 3. Server Actions additionally carry Next.js' built-in action protections.
 * 4. No state-changing GET requests.
 *
 * This helper implements layer 2 explicitly so route handlers and sensitive
 * server actions do not depend on framework behaviour alone.
 */
function normalizeOrigin(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export async function isSameOriginRequest() {
  const headerList = await headers();
  const expected = new URL(serverEnv.APP_ORIGIN).origin;
  const origin = normalizeOrigin(headerList.get("origin"));

  if (origin) {
    return origin === expected;
  }

  // Some browsers omit Origin on same-origin form posts; fall back to Referer.
  const referer = normalizeOrigin(headerList.get("referer"));

  if (referer) {
    return referer === expected;
  }

  // Neither header present: reject rather than assume.
  return false;
}

export class CrossOriginRequestError extends Error {
  constructor() {
    super("Cross-origin request rejected");
    this.name = "CrossOriginRequestError";
  }
}

export async function assertSameOrigin() {
  if (!(await isSameOriginRequest())) {
    throw new CrossOriginRequestError();
  }
}
