/**
 * Money is integer minor units (kobo) end to end (DATA-01, MASTER §30).
 *
 * Nothing in ShopVerse stores or arithmetics money as a float. These helpers
 * exist so the conversion boundary is one place instead of scattered `/ 100`.
 */
export const MONEY_SUBUNIT_FACTOR = 100;

export function toMinorUnits(majorUnits: number) {
  return Math.round(majorUnits * MONEY_SUBUNIT_FACTOR);
}

export function toMajorUnits(minorUnits: number) {
  return minorUnits / MONEY_SUBUNIT_FACTOR;
}

/**
 * Discount percentage, floored so a 9.7% saving never advertises as 10%.
 * Returns null when there is no genuine saving — fake discounts are forbidden
 * (primitives/11-products.md).
 */
export function discountPercent(
  price: number,
  comparePrice: number | null | undefined,
) {
  if (!comparePrice || comparePrice <= price) {
    return null;
  }

  return Math.floor(((comparePrice - price) / comparePrice) * 100);
}
