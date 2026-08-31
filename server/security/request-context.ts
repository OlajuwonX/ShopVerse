import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { resolveClientIp } from "@/server/security/client-ip";

export type RequestContext = {
  ip: string | null;
  requestId: string;
  userAgent: string | null;
};

function readClientIp(headerList: Headers) {
  return resolveClientIp({
    forwardedFor: headerList.get("x-forwarded-for"),
    realIp: headerList.get("x-real-ip"),
    vercelForwardedFor: headerList.get("x-vercel-forwarded-for"),
  });
}

export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();

  return {
    ip: readClientIp(headerList),
    requestId: headerList.get("x-vercel-id") ?? randomUUID(),
    userAgent: headerList.get("user-agent"),
  };
}
