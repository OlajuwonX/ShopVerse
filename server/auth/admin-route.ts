import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/config/env";

const DEVELOPMENT_FALLBACK_SEGMENT = "internal-ops-dev";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function getAdminRouteSegment() {
  const configured = serverEnv.ADMIN_ROUTE_SEGMENT;

  if (configured) {
    return configured;
  }

  if (serverEnv.NODE_ENV === "production") {
    throw new Error(
      "Missing required server environment variable: ADMIN_ROUTE_SEGMENT",
    );
  }

  return DEVELOPMENT_FALLBACK_SEGMENT;
}

export function isAdminRouteSegment(candidate: string) {
  return timingSafeEqual(digest(candidate), digest(getAdminRouteSegment()));
}

export function adminPath(...segments: readonly string[]) {
  return `/${[getAdminRouteSegment(), ...segments].join("/")}`;
}
