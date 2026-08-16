import { PackageX } from "lucide-react";

import { Money } from "@/components/commerce/Money";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import type { ProductListItem } from "@/server/services/products";

type SectionProductCardProps = {
  priority?: boolean;
  product: ProductListItem;
  sizes?: string;
};

export function SectionProductCard({
  priority = false,
  product,
  sizes = "(min-width: 1024px) 18vw, (min-width: 640px) 28vw, 44vw",
}: SectionProductCardProps) {
  return (
    <Card className="flex h-full flex-col gap-3 p-3">
      <div className="relative">
        <CloudinaryImage
          alt={product.imageAlt ?? product.name}
          displayWidth={320}
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
      </div>

      <div className="grid gap-1">
        <p className="text-caption text-text-subtle">{product.brandName}</p>
        <h3 className="line-clamp-2 text-body-sm font-semibold text-text">
          {product.name}
        </h3>
      </div>

      <div className="mt-auto grid gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Money className="text-price" minorUnits={product.basePrice} />
          {product.comparePrice !== null ? (
            <span className="text-caption text-text-subtle line-through">
              <Money minorUnits={product.comparePrice} />
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {product.inStock ? null : (
            <Badge tone="warning">
              <PackageX aria-hidden="true" className="mr-1 size-3" />
              Out of stock
            </Badge>
          )}
          {product.requiresSelection ? <Badge>Choose options</Badge> : null}
          {product.rating !== null && product.ratingCount > 0 ? (
            <Badge tone="neutral">
              {(product.rating / 100).toFixed(1)}★ ({product.ratingCount})
            </Badge>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
