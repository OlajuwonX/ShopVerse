export const MONEY_SUBUNIT_FACTOR = 100;

export function toMinorUnits(majorUnits: number) {
  return Math.round(majorUnits * MONEY_SUBUNIT_FACTOR);
}

export function toMajorUnits(minorUnits: number) {
  return minorUnits / MONEY_SUBUNIT_FACTOR;
}

export function discountPercent(
  price: number,
  comparePrice: number | null | undefined,
) {
  if (!comparePrice || comparePrice <= price) {
    return null;
  }

  return Math.floor(((comparePrice - price) / comparePrice) * 100);
}
