"use client";

import { Heart } from "lucide-react";

import { announce } from "@/components/feedback/announcer";
import { Button } from "@/components/ui/Button";
import { useWishlistItem } from "@/features/wishlist/useGuestWishlist";
import { cn } from "@/lib/cn";

type SaveProductButtonProps = {
  className?: string;
  productId: string;
  productName: string;
};

export function SaveProductButton({
  className,
  productId,
  productName,
}: SaveProductButtonProps) {
  const { isSaved, toggle } = useWishlistItem(productId);

  return (
    <Button
      aria-pressed={isSaved}
      className={className}
      onClick={() => {
        const next = toggle();

        announce(
          next
            ? `${productName} saved to wishlist`
            : `${productName} removed from wishlist`,
        );
      }}
      variant="secondary"
    >
      <Heart
        aria-hidden="true"
        className={cn("size-4", isSaved ? "fill-current text-sale" : null)}
      />
      {isSaved ? "Saved" : "Save for later"}
    </Button>
  );
}
