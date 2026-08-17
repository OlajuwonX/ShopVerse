import { Heart } from "lucide-react";

import { cn } from "@/lib/cn";

type WishlistToggleProps = {
  className?: string;
  productName: string;
};

export function WishlistToggle({ className, productName }: WishlistToggleProps) {
  return (
    <button
      aria-label={`Save ${productName}, available soon`}
      className={cn(
        "relative z-10 inline-flex size-11 items-center justify-center rounded-full text-text-subtle disabled:cursor-not-allowed",
        className,
      )}
      disabled
      type="button"
    >
      <Heart aria-hidden="true" className="size-5" />
    </button>
  );
}
