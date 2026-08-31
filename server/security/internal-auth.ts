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

export function authoriseInternalRequest(
  authorisationHeader: string | null,
  configuredSecret: string | undefined = serverEnv.CRON_SECRET,
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
