"use client";

import { ShoppingBag } from "lucide-react";

import { announce } from "@/components/feedback/announcer";
import { Button } from "@/components/ui/Button";
import { CART_MAX_LINE_QUANTITY } from "@/constants/cart";
import { useGuestCart } from "@/features/cart/useGuestCart";

type AddToCartButtonProps = {
  className?: string;
  inStock: boolean;
  needsSelection: boolean;
  productId: string;
  productName: string;
  unitPrice: number;
  variantId: string | null;
};

export function AddToCartButton({
  className,
  inStock,
  needsSelection,
  productId,
  productName,
  unitPrice,
  variantId,
}: AddToCartButtonProps) {
  const { add } = useGuestCart();

  if (!inStock) {
    return (
      <Button className={className} disabled size="lg" variant="secondary">
        Out of stock
      </Button>
    );
  }

  if (needsSelection || variantId === null) {
    return (
      <Button
        aria-label={`Choose options for ${productName}`}
        className={className}
        disabled
        size="lg"
      >
        Choose options
      </Button>
    );
  }

  return (
    <Button
      aria-label={`Add ${productName} to cart`}
      className={className}
      onClick={() => {
        const reason = add({
          lastSeenUnitPrice: unitPrice,
          productId,
          quantity: 1,
          variantId,
        });

        if (reason === "cart_full") {
          announce("Your cart is full. Remove something before adding more.");

          return;
        }

        if (reason === "line_full") {
          announce(
            `You already have the maximum of ${CART_MAX_LINE_QUANTITY} of ${productName} in your cart`,
          );

          return;
        }

        announce(`${productName} added to cart`);
      }}
      size="lg"
    >
      <ShoppingBag aria-hidden="true" className="size-4" />
      Add to cart
    </Button>
  );
}
