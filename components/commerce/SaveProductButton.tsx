"use client";

import { Heart } from "lucide-react";

import { notify } from "@/components/feedback/toast";
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

        notify({
          description: next ? "Find it again under Wishlist in the header." : undefined,
          title: next
            ? `${productName} saved to wishlist`
            : `${productName} removed from wishlist`,
          tone: next ? "success" : "info",
        });
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
