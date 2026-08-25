"use client";

import Link from "next/link";
import { useCallback } from "react";

import { CartLine } from "@/components/commerce/CartLine";
import { formatMoney, Money } from "@/components/commerce/Money";
import { announce } from "@/components/feedback/announcer";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { checkoutHref } from "@/lib/routes";
import { useCartValidation } from "@/features/cart/useCartValidation";
import { useGuestCart } from "@/features/cart/useGuestCart";
import type { CartTotals } from "@/server/services/cart";

function CartLineSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border py-4">
      <Skeleton className="size-20 shrink-0 sm:size-24" />
      <div className="grid flex-1 content-start gap-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

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

function OrderSummary({
  canCheckout,
  isRevalidating,
  onAcknowledge,
  priceChangeCount,
  totals,
  unpurchasableCount,
}: {
  canCheckout: boolean;
  isRevalidating: boolean;
  onAcknowledge: () => void;
  priceChangeCount: number;
  totals: CartTotals;
  unpurchasableCount: number;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-surface-raised p-4">
      <h2 className="text-heading-3 font-bold text-text">Order summary</h2>

      <dl aria-busy={isRevalidating} className="grid gap-2">
        <SummaryRow label="Subtotal" value={<Money minorUnits={totals.subtotal} />} />

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
            <span className="text-text-muted">
              {totals.delivery === null ? (
                "Calculated at checkout"
              ) : (
                <Money minorUnits={totals.delivery} />
              )}
            </span>
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
        Every price here is calculated on the server from the live catalogue. Delivery
        is added once you enter an address.
      </p>

      {priceChangeCount > 0 ? (
        <div className="grid gap-2 rounded-md bg-warning-soft p-3">
          <p className="text-caption font-medium text-warning">
            {priceChangeCount === 1
              ? "One price changed since you added it."
              : `${priceChangeCount} prices changed since you added them.`}{" "}
            Accept the new prices to continue.
          </p>
          <Button onClick={onAcknowledge} size="sm" variant="secondary">
            Accept new prices
          </Button>
        </div>
      ) : null}

      {unpurchasableCount > 0 ? (
        <p className="rounded-md bg-danger-soft p-3 text-caption font-medium text-danger">
          {unpurchasableCount === 1
            ? "One item cannot be ordered."
            : `${unpurchasableCount} items cannot be ordered.`}{" "}
          Remove it to continue.
        </p>
      ) : null}

      {canCheckout ? (
        <Link className={buttonStyles({ size: "lg" })} href={checkoutHref()}>
          Proceed to checkout
        </Link>
      ) : (
        <Button aria-label="Resolve the issues above to check out" disabled size="lg">
          Proceed to checkout
        </Button>
      )}
    </div>
  );
}

export function CartContents() {
  const { acknowledgePrices, lines: stored, remove, setQuantity } = useGuestCart();
  const { canCheckout, isError, isLoading, isRevalidating, lines, refetch, totals } =
    useCartValidation(stored);

  const handleQuantityChange = useCallback(
    (key: string, quantity: number) => {
      setQuantity(key, quantity);
    },
    [setQuantity],
  );

  const handleRemove = useCallback(
    (key: string) => {
      const line = lines.find((entry) => entry.key === key);

      remove(key);
      announce(`${line?.snapshot?.productName ?? "Item"} removed from cart`);
    },
    [lines, remove],
  );

  const acknowledge = useCallback(() => {
    const prices = new Map<string, number>(
      lines
        .filter((line) => line.priceChanged)
        .map((line) => [line.key, line.unitPrice]),
    );

    acknowledgePrices(prices);
    announce("New prices accepted");
  }, [acknowledgePrices, lines]);

  if (stored.length === 0) {
    return (
      <EmptyState
        action={
          <Link className={buttonStyles()} href="/">
            Shop now
          </Link>
        }
        description="Add something you like and it will wait here on this device."
        title="Your cart is empty"
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        action={
          <Button
            onClick={() => {
              void refetch();
            }}
            variant="secondary"
          >
            Try again
          </Button>
        }
        description="Your items are still saved on this device. We could not reach the server to confirm prices and stock, so nothing is shown yet."
        title="Could not check your cart"
      />
    );
  }

  if (isLoading || totals === null) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div>
          <p aria-live="polite" className="sr-only" role="status">
            Checking prices and stock
          </p>
          {stored.map((line) => (
            <CartLineSkeleton key={`${line.productId}:${line.variantId}`} />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const storedQuantities = new Map(
    stored.map((line) => [`${line.productId}:${line.variantId}`, line.quantity]),
  );

  const priceChanges = lines.filter((line) => line.priceChanged);
  const unpurchasable = lines.filter((line) => !line.purchasable);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section aria-label="Items in your cart">
        <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {lines.length} item{lines.length === 1 ? "" : "s"} in your cart, subtotal{" "}
          {formatMoney(totals.subtotal)}
        </p>

        <ul className="grid">
          {lines.map((line) => (
            <CartLine
              key={line.key}
              line={line}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemove}
              storedQuantity={storedQuantities.get(line.key) ?? line.quantity}
            />
          ))}
        </ul>
      </section>

      <div className="lg:sticky lg:top-4">
        <OrderSummary
          canCheckout={canCheckout}
          isRevalidating={isRevalidating}
          onAcknowledge={acknowledge}
          priceChangeCount={priceChanges.length}
          totals={totals}
          unpurchasableCount={unpurchasable.length}
        />
      </div>
    </div>
  );
}
