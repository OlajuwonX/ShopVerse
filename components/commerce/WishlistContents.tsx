"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ProductGrid, ProductGridSkeleton } from "@/components/commerce/ProductGrid";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  setSavedProduct,
  useGuestWishlistIds,
} from "@/features/wishlist/useGuestWishlist";
import { useWishlistProducts } from "@/features/wishlist/useWishlistProducts";

export function WishlistContents() {
  const ids = useGuestWishlistIds();
  const { isError, isLoading, missingIds, products, refetch } =
    useWishlistProducts(ids);

  useEffect(() => {
    for (const productId of missingIds) {
      setSavedProduct(productId, false);
    }
  }, [missingIds]);

  if (ids.length === 0) {
    return (
      <EmptyState
        action={
          <Link className={buttonStyles()} href="/">
            Browse products
          </Link>
        }
        description="Tap the heart on any product to save it here. Saved products stay on this device until you create an account."
        title="Nothing saved yet"
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        action={
          <Button
            onClick={() => {
              void refetch();
            }}
            variant="secondary"
          >
            Try again
          </Button>
        }
        description="Your saved products are still on this device. We could not reach the catalogue to show them."
        title="Could not load your wishlist"
      />
    );
  }

  if (isLoading) {
    return (
      <>
        <p aria-live="polite" className="sr-only" role="status">
          Loading saved products
        </p>
        <ProductGridSkeleton items={Math.min(ids.length, 8)} />
      </>
    );
  }

  return (
    <div className="grid gap-4">
      <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {products.length} saved product{products.length === 1 ? "" : "s"}
      </p>

      <ProductGrid isAboveFold label="Saved products" products={products} />
    </div>
  );
}
