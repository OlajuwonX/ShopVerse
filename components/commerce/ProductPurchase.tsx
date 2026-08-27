"use client";

import { Minus, Plus, RotateCcw, ShoppingCart, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { Money } from "@/components/commerce/Money";
import { notify } from "@/components/feedback/toast";
import { CART_MAX_LINE_QUANTITY } from "@/constants/cart";
import { useGuestCart } from "@/features/cart/useGuestCart";
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
  productId: string;
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
  productId,
  productName,
  variants,
}: ProductPurchaseProps) {
  const selectable = variants.length > 1;
  const { add } = useGuestCart();

  const [selectedId, setSelectedId] = useState<string | null>(
    selectable ? null : (variants[0]?.id ?? null),
  );
  const [quantity, setQuantity] = useState(1);

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

  const maxQuantity = Math.min(
    selected?.available ?? CART_MAX_LINE_QUANTITY,
    CART_MAX_LINE_QUANTITY,
  );

  function addToCart() {
    if (!selected) {
      return;
    }

    const reason = add({
      lastSeenUnitPrice: price,
      productId,
      quantity,
      variantId: selected.id,
    });

    if (reason === "cart_full") {
      notify({
        description: "Remove something before adding more.",
        title: "Your cart is full",
        tone: "error",
      });

      return;
    }

    if (reason === "line_full") {
      notify({
        description: `You already have the maximum of ${CART_MAX_LINE_QUANTITY} in your cart.`,
        title: "That is as many as we can hold",
        tone: "error",
      });

      return;
    }

    notify({
      description: "Open your cart when you are ready to check out.",
      title: `${productName} added to cart`,
      tone: "success",
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <Money className="text-price-lg font-bold text-text" minorUnits={price} />
          {compareAt !== null && compareAt > price ? (
            <span className="text-body-sm text-text-subtle line-through">
              <Money className="text-text-subtle" minorUnits={compareAt} />
            </span>
          ) : null}
          {discount !== null ? (
            <span className="rounded-md bg-sale px-2 py-0.5 text-caption font-bold text-white">
              −{discount}%
            </span>
          ) : null}
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
                    "inline-flex min-h-11 items-center rounded-lg border px-4 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
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
                    setQuantity(1);
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

      <div className="flex flex-wrap gap-3">
        <QuantityStepper
          disabled={!inStock || needsSelection}
          max={maxQuantity}
          onChange={setQuantity}
          productName={productName}
          quantity={quantity}
        />
        <PurchaseCta
          className="hidden flex-1 lg:inline-flex"
          inStock={inStock}
          needsSelection={needsSelection}
          onAdd={addToCart}
          productName={productName}
        />
      </div>

      <ul className="grid divide-y divide-border rounded-xl border border-border">
        <li className="flex items-center gap-3 px-4 py-3 text-body-sm text-text">
          <Truck aria-hidden="true" className="size-4 text-brand" />
          Delivered nationwide, priced by state at checkout
        </li>
        <li className="flex items-center gap-3 px-4 py-3 text-body-sm text-text">
          <RotateCcw aria-hidden="true" className="size-4 text-brand" />
          Report a problem within 7 days of delivery
        </li>
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-surface-raised p-3 shadow-overlay lg:hidden">
        <div className="mx-auto flex w-full max-w-(--content-max) items-center gap-3 px-(--page-gutter)">
          <div className="min-w-0">
            <Money className="text-price font-bold text-text" minorUnits={price} />
            <p className="truncate text-caption text-text-subtle">
              {selected ? optionLabel(selected) : productName}
            </p>
          </div>

          <div className="ml-auto">
            <PurchaseCta
              inStock={inStock}
              needsSelection={needsSelection}
              onAdd={addToCart}
              productName={productName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuantityStepper({
  disabled,
  max,
  onChange,
  productName,
  quantity,
}: {
  disabled: boolean;
  max: number;
  onChange: (next: number) => void;
  productName: string;
  quantity: number;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface-raised">
      <button
        aria-label={`Decrease quantity of ${productName}`}
        className="inline-flex size-11 items-center justify-center rounded-l-lg text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-text-subtle"
        disabled={disabled || quantity <= 1}
        onClick={() => {
          onChange(Math.max(1, quantity - 1));
        }}
        type="button"
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>

      <output
        aria-label={`Quantity of ${productName}`}
        className="min-w-10 px-2 text-center text-body-sm font-semibold text-text"
      >
        {quantity}
      </output>

      <button
        aria-label={`Increase quantity of ${productName}`}
        className="inline-flex size-11 items-center justify-center rounded-r-lg text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-text-subtle"
        disabled={disabled || quantity >= max}
        onClick={() => {
          onChange(Math.min(max, quantity + 1));
        }}
        type="button"
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function PurchaseCta({
  className,
  inStock,
  needsSelection,
  onAdd,
  productName,
}: {
  className?: string;
  inStock: boolean;
  needsSelection: boolean;
  onAdd: () => void;
  productName: string;
}) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 text-caption font-bold tracking-wide whitespace-nowrap uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed sm:gap-2 sm:px-5 sm:text-body-sm";

  if (!inStock) {
    return (
      <button
        className={cn(base, "bg-surface-muted text-text-muted", className)}
        disabled
        type="button"
      >
        Out of stock
      </button>
    );
  }

  if (needsSelection) {
    return (
      <button
        aria-label={`Choose options for ${productName}`}
        className={cn(base, "bg-surface-muted text-text-muted", className)}
        disabled
        type="button"
      >
        Choose options
      </button>
    );
  }

  return (
    <button
      aria-label={`Add ${productName} to cart`}
      className={cn(base, "bg-surface-inverse text-surface hover:bg-text", className)}
      onClick={onAdd}
      type="button"
    >
      <ShoppingCart aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
      Add to cart
    </button>
  );
}
