import { describe, expect, it } from "vitest";

import {
  MAX_PRICE_MINOR_UNITS,
  normalisePriceRange,
  resolveProductPrice,
} from "@/server/services/products";

describe("resolveProductPrice", () => {
  it("uses the base price when there is no variant price", () => {
    const resolved = resolveProductPrice({ basePrice: 250_000, comparePrice: null });

    expect(resolved.price).toBe(250_000);
    expect(resolved.comparePrice).toBeNull();
    expect(resolved.discountPercent).toBeNull();
  });

  it("lets a variant price override the base price", () => {
    const resolved = resolveProductPrice({
      basePrice: 250_000,
      comparePrice: 300_000,
      variantPrice: 199_000,
    });

    expect(resolved.price).toBe(199_000);
  });

  it("uses the variant compare price, not the product one, when a variant price applies", () => {
    const resolved = resolveProductPrice({
      basePrice: 250_000,
      comparePrice: 300_000,
      variantComparePrice: 220_000,
      variantPrice: 199_000,
    });

    expect(resolved.comparePrice).toBe(220_000);
    expect(resolved.discountPercent).toBe(9);
  });

  it("does not inherit a product compare price onto a variant that has none", () => {
    const resolved = resolveProductPrice({
      basePrice: 250_000,
      comparePrice: 300_000,
      variantPrice: 199_000,
    });

    expect(resolved.comparePrice).toBeNull();
    expect(resolved.discountPercent).toBeNull();
  });

  it("never reports a discount when the compare price is not higher", () => {
    const resolved = resolveProductPrice({ basePrice: 250_000, comparePrice: 250_000 });

    expect(resolved.discountPercent).toBeNull();
  });
});

describe("normalisePriceRange", () => {
  it("returns null bounds when nothing was supplied, so no predicate is emitted", () => {
    expect(normalisePriceRange({})).toStrictEqual({ maxPrice: null, minPrice: null });
  });

  it("does not default the upper bound to the ceiling (Stage 14 regression)", () => {
    const range = normalisePriceRange({ minPrice: 5_000 });

    expect(range.minPrice).toBe(5_000);
    expect(range.maxPrice).toBeNull();
  });

  it("swaps an inverted range instead of rejecting it (SRCH-06)", () => {
    const range = normalisePriceRange({ maxPrice: 10_000, minPrice: 90_000 });

    expect(range.minPrice).toBe(10_000);
    expect(range.maxPrice).toBe(90_000);
  });

  it("clamps absurd values to the configured ceiling (SRCH-07)", () => {
    const range = normalisePriceRange({ maxPrice: 10 ** 12, minPrice: -5 });

    expect(range.maxPrice).toBe(MAX_PRICE_MINOR_UNITS);
    expect(range.minPrice).toBe(0);
  });

  it("leaves a valid range untouched", () => {
    expect(
      normalisePriceRange({ maxPrice: 20_000_000, minPrice: 5_000_000 }),
    ).toStrictEqual({ maxPrice: 20_000_000, minPrice: 5_000_000 });
  });

  it("keeps the ceiling above the price slider range described in MASTER §8", () => {
    expect(MAX_PRICE_MINOR_UNITS).toBeGreaterThan(2_000_000 * 100);
  });
});
