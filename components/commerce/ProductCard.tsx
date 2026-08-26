import { Star } from "lucide-react";
import Link from "next/link";

import { Money } from "@/components/commerce/Money";
import { ProductCardCta } from "@/components/commerce/ProductCardCta";
import { WishlistToggle } from "@/components/commerce/WishlistToggle";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { productHref } from "@/lib/routes";
import type { ProductListItem } from "@/server/services/products";

export const PRODUCT_CARD_SIZES = {
  grid: "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw",
  rail: "(min-width: 1024px) 19vw, (min-width: 640px) 30vw, 44vw",
} as const;

type ProductCardProps = {
  className?: string;
  priority?: boolean;
  product: ProductListItem;
  sizes?: string;
};

export function ProductCard({
  className,
  priority = false,
  product,
  sizes = PRODUCT_CARD_SIZES.grid,
}: ProductCardProps) {
  const rating = product.rating === null ? null : product.rating / 100;
  const hasRating = rating !== null && product.ratingCount > 0;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-2xl bg-surface-card p-3 shadow-card transition-shadow focus-within:shadow-raised hover:shadow-raised",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-xl bg-surface-card-media">
        <CloudinaryImage
          alt={product.imageAlt ?? product.name}
          displayWidth={400}
          priority={priority}
          publicId={product.imagePublicId}
          ratio="square"
          sizes={sizes}
        />

        {product.discountPercent !== null ? (
          <span className="absolute top-2 left-2 rounded-md bg-sale px-2 py-0.5 text-caption font-bold text-white">
            −{product.discountPercent}%
          </span>
        ) : null}

        <WishlistToggle
          className="absolute top-0 right-0"
          productId={product.id}
          productName={product.name}
        />
      </div>

      <div className="grid gap-1.5">
        <h3 className="text-body-sm font-bold text-text">
          <Link
            className="line-clamp-2 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            href={productHref(product.slug)}
          >
            {product.name}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-brand-soft px-2 py-0.5 text-caption font-semibold tracking-wide text-brand-strong uppercase">
            {product.categoryName}
          </span>

          {hasRating ? (
            <span className="inline-flex items-center gap-1 text-caption text-text-muted">
              <Star aria-hidden="true" className="size-3 fill-current text-warning" />
              {rating.toFixed(1)}
              <span className="sr-only">
                {" "}
                out of 5 from {product.ratingCount} reviews
              </span>
              <span aria-hidden="true">({product.ratingCount})</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-auto grid gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Money
            className="text-price font-bold text-text"
            minorUnits={product.basePrice}
          />
          {product.comparePrice !== null ? (
            <span className="text-body-sm text-text-muted line-through">
              <Money className="text-text-muted" minorUnits={product.comparePrice} />
            </span>
          ) : null}
        </div>

        <ProductCardCta
          inStock={product.inStock}
          optionLabel={product.defaultVariantLabel}
          productId={product.id}
          productName={product.name}
          unitPrice={product.basePrice}
          variantId={product.defaultVariantId}
        />
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-surface-card p-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="mt-auto h-4 w-1/2" />
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
