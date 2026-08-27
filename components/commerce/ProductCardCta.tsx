"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";

import { notify } from "@/components/feedback/toast";
import { CART_MAX_LINE_QUANTITY } from "@/constants/cart";
import { cartLineKey } from "@/features/cart/schemas/cart";
import { useGuestCart } from "@/features/cart/useGuestCart";
import { cn } from "@/lib/cn";

const CTA_CLASS =
  "relative z-10 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-caption font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-2 sm:px-4 sm:text-label sm:tracking-wide sm:uppercase";

const STEP_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-surface transition-colors hover:bg-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-text-muted";

type ProductCardCtaProps = {
  inStock: boolean;
  optionLabel: string | null;
  productId: string;
  productName: string;
  unitPrice: number;
  variantId: string | null;
};

export function ProductCardCta({
  inStock,
  optionLabel,
  productId,
  productName,
  unitPrice,
  variantId,
}: ProductCardCtaProps) {
  const { add, lines, remove, setQuantity } = useGuestCart();

  if (!inStock || variantId === null) {
    return (
      <span
        aria-hidden="true"
        className={cn(CTA_CLASS, "cursor-not-allowed bg-surface-muted text-text-muted")}
      >
        Out of stock
      </span>
    );
  }

  const key = cartLineKey({ productId, variantId });
  const line = lines.find((entry) => cartLineKey(entry) === key);

  if (line) {
    return (
      <div className="relative z-10 flex items-center justify-between rounded-lg bg-surface-inverse">
        <button
          aria-label={`Decrease quantity of ${productName}`}
          className={STEP_CLASS}
          onClick={() => {
            if (line.quantity <= 1) {
              remove(key);
              notify({ title: `${productName} removed from cart`, tone: "info" });

              return;
            }

            setQuantity(key, line.quantity - 1);
          }}
          type="button"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>

        <output
          aria-label={`Quantity of ${productName} in cart`}
          className="px-1 text-body-sm font-bold text-surface tabular-nums sm:px-2"
        >
          {line.quantity}
        </output>

        <button
          aria-label={`Increase quantity of ${productName}`}
          className={STEP_CLASS}
          disabled={line.quantity >= CART_MAX_LINE_QUANTITY}
          onClick={() => {
            setQuantity(key, line.quantity + 1);
          }}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      aria-label={`Add ${productName} to cart`}
      className={cn(CTA_CLASS, "bg-surface-inverse text-surface hover:bg-text")}
      onClick={() => {
        const reason = add({
          lastSeenUnitPrice: unitPrice,
          productId,
          quantity: 1,
          variantId,
        });

        if (reason === "cart_full") {
          notify({
            description: "Remove something before adding more.",
            title: "Your cart is full",
            tone: "error",
          });

          return;
        }

        notify({
          description: optionLabel
            ? `${optionLabel} added. Open the product to pick another option.`
            : "Open your cart when you are ready to check out.",
          title: `${productName} added to cart`,
          tone: "success",
        });
      }}
      type="button"
    >
      <ShoppingCart aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
      Add to cart
    </button>
  );
}
