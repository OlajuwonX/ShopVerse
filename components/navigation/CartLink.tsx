"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useGuestCartCount } from "@/features/cart/useGuestCart";
import { cartHref } from "@/lib/routes";

export function CartLink() {
  const count = useGuestCartCount();
  const label =
    count === 0 ? "Cart, empty" : `Cart, ${count} item${count === 1 ? "" : "s"}`;

  return (
    <Link
      aria-label={label}
      className="relative inline-flex size-11 items-center justify-center rounded-md border border-transparent text-text transition-colors duration-150 ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      href={cartHref()}
    >
      <ShoppingBag aria-hidden="true" className="size-5" />

      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-caption font-semibold text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
