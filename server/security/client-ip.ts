const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

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
