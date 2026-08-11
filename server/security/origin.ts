import "server-only";

import { headers } from "next/headers";

import { serverEnv } from "@/config/env";

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

  const referer = normalizeOrigin(headerList.get("referer"));

  if (referer) {
    return referer === expected;
  }

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
