import type { ComponentPropsWithoutRef } from "react";

import { Money } from "@/components/commerce/Money";

export type PriceProps = ComponentPropsWithoutRef<typeof Money>;

export function Price(props: PriceProps) {
  return <Money {...props} />;
}
