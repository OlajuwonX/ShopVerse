import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

export type RequestContext = {
  ip: string | null;
  requestId: string;
  userAgent: string | null;
};

function readClientIp(headerList: Headers) {
  const forwardedFor = headerList.get("x-forwarded-for");

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  return headerList.get("x-real-ip");
}

export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();

  return {
    ip: readClientIp(headerList),
    requestId: headerList.get("x-vercel-id") ?? randomUUID(),
    userAgent: headerList.get("user-agent"),
  };
}
