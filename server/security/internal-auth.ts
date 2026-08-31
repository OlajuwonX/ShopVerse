import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/config/env";

export type InternalAuthOutcome = "authorised" | "unauthorised" | "not_configured";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function readBearerToken(header: string | null) {
  if (!header) {
    return null;
  }

  const [scheme, ...rest] = header.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer") {
    return null;
  }

  const token = rest.join(" ");

  return token.length > 0 ? token : null;
}

export function readInternalSecret() {
  return serverEnv.CRON_SECRET;
}

/**
 * `configuredSecret` is required rather than defaulted to `serverEnv.CRON_SECRET`. A
 * default that reads global env makes the `not_configured` branch untestable: passing
 * `undefined` selects the default instead of expressing "nothing is configured", so the
 * branch only ever looked correct while the environment happened to have no secret.
 * Callers pass the env value; `readInternalSecret` is the one place that reads it.
 */
export function authoriseInternalRequest(
  authorisationHeader: string | null,
  configuredSecret: string | undefined,
): InternalAuthOutcome {
  if (!configuredSecret) {
    return "not_configured";
  }

  const presented = readBearerToken(authorisationHeader);

  if (!presented) {
    return "unauthorised";
  }

  return timingSafeEqual(digest(presented), digest(configuredSecret))
    ? "authorised"
    : "unauthorised";
}
