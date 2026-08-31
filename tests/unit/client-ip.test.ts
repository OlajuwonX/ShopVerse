import { describe, expect, it } from "vitest";

import { resolveClientIp } from "@/server/security/client-ip";

describe("resolveClientIp", () => {
  it("prefers the platform header, which a client cannot forge", () => {
    expect(
      resolveClientIp({
        forwardedFor: "1.1.1.1, 9.9.9.9",
        realIp: "8.8.8.8",
        vercelForwardedFor: "203.0.113.7",
      }),
    ).toBe("203.0.113.7");
  });

  it("falls back to the proxy-written real-ip header", () => {
    expect(
      resolveClientIp({ forwardedFor: "1.1.1.1, 9.9.9.9", realIp: "8.8.8.8" }),
    ).toBe("8.8.8.8");
  });

  it("takes the rightmost forwarded-for entry, not the caller-supplied leftmost (H-2)", () => {
    expect(resolveClientIp({ forwardedFor: "1.1.1.1, 203.0.113.7" })).toBe(
      "203.0.113.7",
    );
  });

  it("ignores a spoofed prefix however long the caller makes it", () => {
    const spoofed = Array.from({ length: 50 }, (_, index) => `10.0.0.${index}`).join(
      ", ",
    );

    expect(resolveClientIp({ forwardedFor: `${spoofed}, 203.0.113.7` })).toBe(
      "203.0.113.7",
    );
  });

  it("gives every spoofing attempt the same identity, so quotas cannot be reset", () => {
    const attempts = ["1.2.3.4", "5.6.7.8", "9.10.11.12", "not-an-ip", ""].map(
      (forged) => resolveClientIp({ forwardedFor: `${forged}, 203.0.113.7` }),
    );

    expect(new Set(attempts).size, "all resolve to the same real client").toBe(1);
    expect(attempts[0]).toBe("203.0.113.7");
  });

  it("honours a deeper trusted-proxy chain", () => {
    expect(resolveClientIp({ forwardedFor: "1.1.1.1, 203.0.113.7, 10.0.0.1" }, 2)).toBe(
      "203.0.113.7",
    );
  });

  it("returns null when nothing trustworthy is present", () => {
    expect(resolveClientIp({})).toBeNull();
    expect(resolveClientIp({ forwardedFor: "" })).toBeNull();
    expect(resolveClientIp({ forwardedFor: "not-an-ip" })).toBeNull();
    expect(resolveClientIp({ realIp: "garbage" })).toBeNull();
  });

  it("accepts IPv6 and strips a trailing port from IPv4", () => {
    expect(resolveClientIp({ realIp: "2001:db8::1" })).toBe("2001:db8::1");
    expect(resolveClientIp({ realIp: "203.0.113.7:54321" })).toBe("203.0.113.7");
    expect(resolveClientIp({ realIp: "[2001:db8::1]:443" })).toBe("2001:db8::1");
  });

  it("rejects an out-of-range IPv4 that would otherwise pass a naive check", () => {
    expect(resolveClientIp({ realIp: "999.1.1.1" })).toBeNull();
  });
});
