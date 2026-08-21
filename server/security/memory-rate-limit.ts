import "server-only";

type Bucket = {
  count: number;
  windowStartedAt: number;
};

type MemoryRateLimitConfig = {
  action: string;
  maxRequests: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_IDENTIFIERS = 5_000;

function prune(now: number, windowMs: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt > windowMs) {
      buckets.delete(key);
    }
  }
}

export function checkMemoryRateLimit(
  config: MemoryRateLimitConfig,
  identifier: string,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = `${config.action}:${identifier}`;

  if (buckets.size > MAX_TRACKED_IDENTIFIERS) {
    prune(now, config.windowMs);
  }

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt >= config.windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > config.maxRequests) {
    const elapsed = now - bucket.windowStartedAt;

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((config.windowMs - elapsed) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetMemoryRateLimit() {
  buckets.clear();
}
