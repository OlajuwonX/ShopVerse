"use client";

import { ShoppingBag } from "lucide-react";

import { notify } from "@/components/feedback/toast";
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
            title: `That is as many as we can hold`,
            tone: "error",
          });

          return;
        }

        notify({
          description: "Open your cart when you are ready to check out.",
          title: `${productName} added to cart`,
          tone: "success",
        });
      }}
      size="lg"
    >
      <ShoppingBag aria-hidden="true" className="size-4" />
      Add to cart
    </Button>
  );
}
