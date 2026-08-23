import { PackageX, Star } from "lucide-react";
import Link from "next/link";

import { Money } from "@/components/commerce/Money";
import { WishlistToggle } from "@/components/commerce/WishlistToggle";
import { Badge } from "@/components/ui/Badge";
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
        "group relative flex h-full flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3 transition-colors focus-within:border-border-strong hover:border-border-strong",
        className,
      )}
    >
      <div className="relative">
        <CloudinaryImage
          alt={product.imageAlt ?? product.name}
          displayWidth={400}
          priority={priority}
          publicId={product.imagePublicId}
          ratio="square"
          sizes={sizes}
        />

        {product.discountPercent !== null ? (
          <Badge className="absolute top-2 left-2" tone="sale">
            −{product.discountPercent}%
          </Badge>
        ) : null}

        <WishlistToggle
          className="absolute top-1 right-1"
          productId={product.id}
          productName={product.name}
        />
      </div>

      <div className="grid gap-1">
        <p className="text-caption text-text-subtle">{product.brandName}</p>
        <h3 className="text-body-sm font-semibold text-text">
          <Link
            className="line-clamp-2 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            href={productHref(product.slug)}
          >
            {product.name}
          </Link>
        </h3>
      </div>

      <div className="mt-auto grid gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Money className="text-price font-semibold" minorUnits={product.basePrice} />
          {product.comparePrice !== null ? (
            <span className="text-caption text-text-subtle line-through">
              <Money minorUnits={product.comparePrice} />
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {product.inStock ? null : (
            <Badge tone="warning">
              <PackageX aria-hidden="true" className="mr-1 size-3" />
              Out of stock
            </Badge>
          )}

          {product.inStock && product.requiresSelection ? (
            <span className="text-caption font-semibold text-text-muted">
              Choose options
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-auto h-5 w-1/2" />
    </div>
  );
}
