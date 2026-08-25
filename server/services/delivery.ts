import "server-only";

import { isSupportedState, type NigerianState } from "@/constants/regions";

const LAGOS_FEE = 2_500_00;
const NEARBY_FEE = 4_000_00;
const NATIONWIDE_FEE = 5_500_00;

const nearbyStates = new Set<NigerianState>([
  "Federal Capital Territory",
  "Ogun",
  "Oyo",
  "Osun",
  "Ondo",
  "Ekiti",
]);

export type DeliveryQuote = {
  fee: number;
  state: NigerianState;
  zone: "lagos" | "nearby" | "nationwide";
};

export function quoteDelivery(state: string): DeliveryQuote | null {
  if (!isSupportedState(state)) {
    return null;
  }

  if (state === "Lagos") {
    return { fee: LAGOS_FEE, state, zone: "lagos" };
  }

  if (nearbyStates.has(state)) {
    return { fee: NEARBY_FEE, state, zone: "nearby" };
  }

  return { fee: NATIONWIDE_FEE, state, zone: "nationwide" };
}
