"use client";

import { Heart } from "lucide-react";
import Link from "next/link";

import { WISHLIST_MAX_ITEMS } from "@/constants/wishlist";
import { useGuestWishlistCount } from "@/features/wishlist/useGuestWishlist";
import { wishlistHref } from "@/lib/routes";

export function WishlistLink() {
  const count = useGuestWishlistCount();
  const label =
    count === 0
      ? "Wishlist, nothing saved"
      : `Wishlist, ${count} saved product${count === 1 ? "" : "s"}`;

  return (
    <Link
      aria-label={label}
      className="relative inline-flex size-11 items-center justify-center rounded-md border border-transparent text-text transition-colors duration-150 ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      href={wishlistHref()}
    >
      <Heart aria-hidden="true" className="size-5" />

      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-sale px-1 text-caption font-semibold text-white"
        >
          {count > WISHLIST_MAX_ITEMS ? `${WISHLIST_MAX_ITEMS}+` : count}
        </span>
      ) : null}
    </Link>
  );
}
