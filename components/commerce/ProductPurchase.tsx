"use client";

import { useMemo, useState } from "react";

import { Money } from "@/components/commerce/Money";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type PurchaseVariant = {
  available: number;
  comparePrice: number | null;
  id: string;
  optionValues: Record<string, string>;
  price: number;
  sku: string;
};

type ProductPurchaseProps = {
  basePrice: number;
  comparePrice: number | null;
  productName: string;
  variants: readonly PurchaseVariant[];
};

function optionLabel(variant: PurchaseVariant) {
  const values = Object.values(variant.optionValues);

  return values.length > 0 ? values.join(" · ") : variant.sku;
}

function optionGroupName(variants: readonly PurchaseVariant[]) {
  const keys = variants.flatMap((variant) => Object.keys(variant.optionValues));

  return keys[0] ?? null;
}

function discountPercentOf(price: number, comparePrice: number | null) {
  if (comparePrice === null || comparePrice <= price) {
    return null;
  }

  return Math.floor(((comparePrice - price) / comparePrice) * 100);
}

export function ProductPurchase({
  basePrice,
  comparePrice,
  productName,
  variants,
}: ProductPurchaseProps) {
  const selectable = variants.length > 1;

  const [selectedId, setSelectedId] = useState<string | null>(
    selectable ? null : (variants[0]?.id ?? null),
  );

  const selected = useMemo(
    () => variants.find((variant) => variant.id === selectedId) ?? null,
    [selectedId, variants],
  );

  const price = selected?.price ?? basePrice;
  const compareAt = selected ? selected.comparePrice : comparePrice;
  const discount = discountPercentOf(price, compareAt);

  const totalAvailable = variants.reduce(
    (total, variant) => total + variant.available,
    0,
  );

  const inStock = selected ? selected.available > 0 : totalAvailable > 0;
  const needsSelection = selectable && selected === null;
  const groupName = optionGroupName(variants);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <Money className="text-price-lg font-bold" minorUnits={price} />
          {compareAt !== null && compareAt > price ? (
            <span className="text-body-sm text-text-subtle line-through">
              <Money minorUnits={compareAt} />
            </span>
          ) : null}
          {discount !== null ? <Badge tone="sale">−{discount}%</Badge> : null}
        </div>

        <p aria-live="polite" className="text-body-sm" role="status">
          {inStock ? (
            <span className="text-success">In stock</span>
          ) : (
            <span className="text-warning">Out of stock</span>
          )}
          {selected ? (
            <span className="text-text-subtle"> · {selected.sku}</span>
          ) : null}
        </p>
      </div>

      {selectable ? (
        <fieldset className="grid gap-2">
          <legend className="text-label font-semibold text-text">
            {groupName ? `Choose ${groupName}` : "Choose an option"}
          </legend>

          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const isSoldOut = variant.available === 0;
              const isSelected = variant.id === selectedId;

              return (
                <button
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-md border px-4 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    isSelected
                      ? "border-brand bg-brand-soft text-brand-strong"
                      : "border-border bg-surface-raised text-text hover:border-border-strong",
                    isSoldOut
                      ? "cursor-not-allowed text-text-subtle line-through"
                      : null,
                  )}
                  disabled={isSoldOut}
                  key={variant.id}
                  onClick={() => {
                    setSelectedId(variant.id);
                  }}
                  type="button"
                >
                  {optionLabel(variant)}
                  {isSoldOut ? <span className="sr-only">, sold out</span> : null}
                </button>
              );
            })}
          </div>

          {needsSelection ? (
            <p className="text-caption text-text-muted">
              Select an option to see its price and availability.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="hidden lg:block">
        <PurchaseCta
          inStock={inStock}
          needsSelection={needsSelection}
          productName={productName}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-surface-raised p-3 shadow-overlay lg:hidden">
        <div className="mx-auto flex w-full max-w-(--content-max) items-center gap-3 px-(--page-gutter)">
          <div className="min-w-0">
            <Money className="text-price font-bold" minorUnits={price} />
            <p className="truncate text-caption text-text-subtle">
              {selected ? optionLabel(selected) : productName}
            </p>
          </div>

          <div className="ml-auto">
            <PurchaseCta
              inStock={inStock}
              needsSelection={needsSelection}
              productName={productName}
            />
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="h-20 lg:hidden" />
    </div>
  );
}

function PurchaseCta({
  inStock,
  needsSelection,
  productName,
}: {
  inStock: boolean;
  needsSelection: boolean;
  productName: string;
}) {
  if (!inStock) {
    return (
      <Button disabled size="lg" variant="secondary">
        Out of stock
      </Button>
    );
  }

  return (
    <Button
      aria-label={
        needsSelection
          ? `Choose options for ${productName}`
          : `Add ${productName} to cart, available soon`
      }
      disabled
      size="lg"
    >
      {needsSelection ? "Choose options" : "Add to cart"}
    </Button>
  );
}
