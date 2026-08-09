import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type MoneyProps = HTMLAttributes<HTMLSpanElement> & {
  currency?: "NGN";
  minorUnits: number;
};

const moneyFormatter = new Intl.NumberFormat("en-NG", {
  currency: "NGN",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: "currency",
});

export function Money({
  className,
  currency = "NGN",
  minorUnits,
  ...props
}: MoneyProps) {
  const majorUnits = minorUnits / 100;
  const formatted =
    currency === "NGN" ? moneyFormatter.format(majorUnits) : String(majorUnits);

  return (
    <span className={cn("font-bold text-(--color-price)", className)} {...props}>
      {formatted}
    </span>
  );
}
