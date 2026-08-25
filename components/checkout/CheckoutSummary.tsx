"use client";

import { Money } from "@/components/commerce/Money";
import { Button } from "@/components/ui/Button";
import type { CartTotals } from "@/server/services/cart";
import { cn } from "@/lib/cn";

type CheckoutSummaryProps = {
  isPending: boolean;
  isRevalidating: boolean;
  itemCount: number;
  totals: CartTotals;
};

function SummaryRow({
  className,
  emphasis = false,
  label,
  value,
}: {
  className?: string;
  emphasis?: boolean;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <dt
        className={
          emphasis
            ? "text-body-sm font-semibold text-text"
            : "text-body-sm text-text-muted"
        }
      >
        {label}
      </dt>
      <dd
        className={
          emphasis ? "text-price font-bold text-text" : "text-body-sm text-text"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function CheckoutSummary({
  isPending,
  isRevalidating,
  itemCount,
  totals,
}: CheckoutSummaryProps) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-surface-raised p-4">
      <h2 className="text-heading-3 font-bold text-text">Order summary</h2>

      <dl aria-busy={isRevalidating} className="grid gap-2">
        <SummaryRow
          label={`Subtotal (${itemCount} item${itemCount === 1 ? "" : "s"})`}
          value={<Money minorUnits={totals.subtotal} />}
        />

        {totals.savings > 0 ? (
          <SummaryRow
            label="You save"
            value={
              <span className="text-success">
                −<Money minorUnits={totals.savings} />
              </span>
            }
          />
        ) : null}

        <SummaryRow
          label="Delivery"
          value={
            totals.delivery === null ? (
              <span className="text-text-muted">Choose a state</span>
            ) : (
              <Money minorUnits={totals.delivery} />
            )
          }
        />

        <SummaryRow
          className="border-t border-border pt-2"
          emphasis
          label="Total"
          value={<Money minorUnits={totals.total} />}
        />
      </dl>

      <p className="text-caption text-text-subtle">
        Every figure is calculated on the server from the live catalogue. Delivery is
        priced from the state you choose.
      </p>

      <Button isLoading={isPending} size="lg" type="submit">
        {totals.delivery === null ? (
          "Continue to payment"
        ) : (
          <>
            Pay <Money className="text-white" minorUnits={totals.total} />
          </>
        )}
      </Button>

      <p className="text-caption text-text-subtle">
        You will not be charged until the payment step. No account required.
      </p>
    </div>
  );
}
