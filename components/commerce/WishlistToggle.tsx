"use client";

import { Heart } from "lucide-react";

import { notify } from "@/components/feedback/toast";
import { useWishlistItem } from "@/features/wishlist/useGuestWishlist";
import { cn } from "@/lib/cn";

type WishlistToggleProps = {
  className?: string;
  productId: string;
  productName: string;
};

export function WishlistToggle({
  className,
  productId,
  productName,
}: WishlistToggleProps) {
  const { isSaved, toggle } = useWishlistItem(productId);

  return (
    <button
      aria-label={
        isSaved
          ? `Remove ${productName} from wishlist`
          : `Save ${productName} to wishlist`
      }
      aria-pressed={isSaved}
      className={cn(
        "z-10 inline-flex size-11 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        isSaved ? "text-sale" : "text-text-subtle hover:text-sale",
        className,
      )}
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
      type="button"
    >
      <Heart
        aria-hidden="true"
        className={cn("size-4.5", isSaved ? "fill-current" : null)}
      />
    </button>
  );
}
