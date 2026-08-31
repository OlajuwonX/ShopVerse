const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

/**
 * How many reverse proxies sit in front of the app. On Vercel this is 1.
 * The client IP is the Nth entry from the *right* of `x-forwarded-for`; everything
 * to the left of that was supplied by the caller and can be forged freely.
 */
export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function isIpAddress(value: string) {
  if (IPV4.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }

  return value.includes(":") && IPV6.test(value);
}

function normalise(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let candidate = value.trim();

  if (candidate.startsWith("[")) {
    candidate = candidate.slice(
      1,
      candidate.indexOf("]") === -1 ? undefined : candidate.indexOf("]"),
    );
  } else if (candidate.split(":").length === 2) {
    candidate = candidate.split(":")[0] ?? candidate;
  }

  return isIpAddress(candidate) ? candidate : null;
}

export type ClientIpHeaders = {
  forwardedFor?: string | null;
  realIp?: string | null;
  vercelForwardedFor?: string | null;
};

/**
 * Resolves the caller's IP from headers a client cannot forge.
 *
 * Order matters:
 *   1. `x-vercel-forwarded-for` — written by Vercel's edge, overwriting anything sent.
 *   2. `x-real-ip` — written by the immediate reverse proxy.
 *   3. `x-forwarded-for`, counted from the right by the number of trusted hops.
 *
 * Returns `null` rather than a guess when nothing trustworthy is present. Callers fall
 * back to a shared bucket, which throttles unattributable traffic together instead of
 * handing every request its own fresh quota.
 */
export function resolveClientIp(
  headers: ClientIpHeaders,
  trustedProxyHops = DEFAULT_TRUSTED_PROXY_HOPS,
): string | null {
  const vercel = normalise(headers.vercelForwardedFor);

  if (vercel) {
    return vercel;
  }

  const realIp = normalise(headers.realIp);

  if (realIp) {
    return realIp;
  }

  const chain = (headers.forwardedFor ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (chain.length === 0) {
    return null;
  }

  const hops = Math.max(1, trustedProxyHops);
  const index = chain.length - hops;

  return normalise(chain[index] ?? chain[0]);
}
