import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { requireServerEnv } from "@/config/env";

export type OpaqueToken = {
  hash: string;
  token: string;
};

export function createOpaqueToken(byteLength = 32): OpaqueToken {
  const token = randomBytes(byteLength).toString("base64url");

  return {
    hash: hashToken(token),
    token,
  };
}

export function hashToken(token: string) {
  const secret = requireServerEnv("AUTH_SECRET");

  return createHmac("sha256", secret).update(token).digest("base64url");
}

export function safeCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}
