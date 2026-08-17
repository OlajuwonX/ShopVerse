import { describe, expect, it } from "vitest";

import { discountPercent, toMajorUnits, toMinorUnits } from "@/lib/money";

describe("toMinorUnits", () => {
  it("converts naira to integer kobo", () => {
    expect(toMinorUnits(1)).toBe(100);
    expect(toMinorUnits(1_250_000)).toBe(125_000_000);
  });

  it("rounds fractional input rather than truncating it", () => {
    expect(toMinorUnits(10.005)).toBe(1001);
    expect(toMinorUnits(10.004)).toBe(1000);
  });

  it("never produces a floating point remainder", () => {
    for (const major of [0.1, 0.2, 0.3, 19.99, 1999.99, 123_456.78]) {
      expect(Number.isInteger(toMinorUnits(major))).toBe(true);
    }
  });

  it("round-trips through toMajorUnits", () => {
    for (const major of [0, 1, 19.99, 250_000, 2_340_000]) {
      expect(toMajorUnits(toMinorUnits(major))).toBe(major);
    }
  });
});

describe("discountPercent", () => {
  it("returns null when there is no genuine saving", () => {
    expect(discountPercent(10_000, null)).toBeNull();
    expect(discountPercent(10_000, undefined)).toBeNull();
    expect(discountPercent(10_000, 0)).toBeNull();
    expect(discountPercent(10_000, 10_000)).toBeNull();
    expect(discountPercent(10_000, 9_000)).toBeNull();
  });

  it("floors the percentage so a discount is never overstated", () => {
    expect(discountPercent(6_667, 10_000)).toBe(33);
    expect(discountPercent(9_999, 10_000)).toBe(0);
  });

  it("computes the saving against the compare price", () => {
    expect(discountPercent(5_000, 10_000)).toBe(50);
    expect(discountPercent(75_000, 100_000)).toBe(25);
  });
});
