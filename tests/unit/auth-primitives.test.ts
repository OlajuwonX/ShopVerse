import { describe, expect, it } from "vitest";

import {
  FORM_RENDERED_AT_FIELD_NAME,
  HONEYPOT_FIELD_NAME,
  MIN_FORM_FILL_MS,
  staffLoginSchema,
} from "@/features/authentication/schemas/staff-login";
import {
  adminPath,
  getAdminRouteSegment,
  isAdminRouteSegment,
} from "@/server/auth/admin-route";
import { normalizeEmail } from "@/server/auth/passwords";
import { createOpaqueToken, hashToken, safeCompare } from "@/server/auth/tokens";

describe("session tokens", () => {
  it("never stores the raw token — the hash differs from it", () => {
    const token = createOpaqueToken();

    expect(token.hash).not.toBe(token.token);
    expect(token.token.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes deterministically so a presented token can be looked up", () => {
    const token = createOpaqueToken();

    expect(hashToken(token.token)).toBe(token.hash);
    expect(hashToken(token.token)).toBe(hashToken(token.token));
  });

  it("produces a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 25 }, () => createOpaqueToken().token));

    expect(tokens.size).toBe(25);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("safeCompare", () => {
  it("matches identical values and rejects different ones", () => {
    expect(safeCompare("abc123", "abc123")).toBe(true);
    expect(safeCompare("abc123", "abc124")).toBe(false);
  });

  it("rejects values of different length without throwing", () => {
    expect(safeCompare("short", "considerably-longer")).toBe(false);
    expect(safeCompare("", "x")).toBe(false);
  });
});

describe("admin route concealment (SEC-03)", () => {
  it("accepts only the configured segment", () => {
    const configured = getAdminRouteSegment();

    expect(isAdminRouteSegment(configured)).toBe(true);
    expect(isAdminRouteSegment(`${configured}x`)).toBe(false);
    expect(isAdminRouteSegment("admin")).toBe(false);
    expect(isAdminRouteSegment("")).toBe(false);
  });

  it("compares hashes, so a wrong candidate of any length is handled", () => {
    expect(isAdminRouteSegment("a")).toBe(false);
    expect(isAdminRouteSegment("z".repeat(500))).toBe(false);
  });

  it("builds admin paths from the configured segment only", () => {
    const configured = getAdminRouteSegment();

    expect(adminPath()).toBe(`/${configured}`);
    expect(adminPath("login")).toBe(`/${configured}/login`);
    expect(adminPath("products", "new")).toBe(`/${configured}/products/new`);
  });

  it("never hardcodes a guessable segment", () => {
    expect(["admin", "backoffice", "dashboard"]).not.toContain(getAdminRouteSegment());
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims so lookups cannot be bypassed by casing", () => {
    expect(normalizeEmail("  Staff@ShopVerse.COM ")).toBe("staff@shopverse.com");
  });
});

describe("staff login schema (SEC-18)", () => {
  const validBase = {
    email: "staff@shopverse.com",
    password: "correct-horse-battery",
    [FORM_RENDERED_AT_FIELD_NAME]: Date.now() - MIN_FORM_FILL_MS - 1_000,
    [HONEYPOT_FIELD_NAME]: "",
  };

  it("accepts a well-formed submission", () => {
    expect(staffLoginSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects a filled honeypot", () => {
    const result = staffLoginSchema.safeParse({
      ...validBase,
      [HONEYPOT_FIELD_NAME]: "https://spam.example",
    });

    expect(result.success).toBe(false);
  });

  it("requires a render timestamp so submission timing can be checked", () => {
    const result = staffLoginSchema.safeParse({
      ...validBase,
      [FORM_RENDERED_AT_FIELD_NAME]: undefined,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-positive render timestamp", () => {
    expect(
      staffLoginSchema.safeParse({ ...validBase, [FORM_RENDERED_AT_FIELD_NAME]: 0 })
        .success,
    ).toBe(false);
    expect(
      staffLoginSchema.safeParse({ ...validBase, [FORM_RENDERED_AT_FIELD_NAME]: -5 })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      staffLoginSchema.safeParse({ ...validBase, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("keeps the minimum fill time long enough to catch instant bot submissions", () => {
    expect(MIN_FORM_FILL_MS).toBeGreaterThanOrEqual(1_000);
  });
});
