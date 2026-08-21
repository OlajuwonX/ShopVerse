import { beforeEach, describe, expect, it } from "vitest";

import {
  checkMemoryRateLimit,
  resetMemoryRateLimit,
} from "@/server/security/memory-rate-limit";

import { SEARCH_BURST_LIMIT, SEARCH_SUSTAINED_LIMIT } from "@/constants/search";

const config = { action: "test", maxRequests: 3, windowMs: 1_000 };

beforeEach(() => {
  resetMemoryRateLimit();
});

describe("checkMemoryRateLimit", () => {
  it("allows requests up to the limit", () => {
    for (let attempt = 0; attempt < config.maxRequests; attempt += 1) {
      expect(checkMemoryRateLimit(config, "1.2.3.4").allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    for (let attempt = 0; attempt < config.maxRequests; attempt += 1) {
      checkMemoryRateLimit(config, "1.2.3.4");
    }

    const blocked = checkMemoryRateLimit(config, "1.2.3.4");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks identifiers independently", () => {
    for (let attempt = 0; attempt < config.maxRequests + 1; attempt += 1) {
      checkMemoryRateLimit(config, "1.1.1.1");
    }

    expect(checkMemoryRateLimit(config, "2.2.2.2").allowed).toBe(true);
  });

  it("tracks actions independently", () => {
    for (let attempt = 0; attempt < config.maxRequests + 1; attempt += 1) {
      checkMemoryRateLimit(config, "1.1.1.1");
    }

    expect(
      checkMemoryRateLimit({ ...config, action: "other" }, "1.1.1.1").allowed,
    ).toBe(true);
  });

  it("never reports a retry-after of zero when blocking", () => {
    for (let attempt = 0; attempt < config.maxRequests + 3; attempt += 1) {
      checkMemoryRateLimit(config, "1.2.3.4");
    }

    expect(
      checkMemoryRateLimit(config, "1.2.3.4").retryAfterSeconds,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("search limiter tiers", () => {
  it("uses a tighter burst window than the sustained window", () => {
    expect(SEARCH_BURST_LIMIT.windowMs).toBeLessThan(SEARCH_SUSTAINED_LIMIT.windowMs);
  });

  it("allows a higher sustained total than a single burst", () => {
    expect(SEARCH_SUSTAINED_LIMIT.maxAttempts).toBeGreaterThan(
      SEARCH_BURST_LIMIT.maxRequests,
    );
  });

  it("keeps the burst tier permissive enough for a debounced typist", () => {
    expect(SEARCH_BURST_LIMIT.maxRequests).toBeGreaterThanOrEqual(10);
  });
});
