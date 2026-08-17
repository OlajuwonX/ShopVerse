import {
  ProductCard,
  ProductCardSkeleton,
  PRODUCT_CARD_SIZES,
} from "@/components/commerce/ProductCard";
import type { ProductListItem } from "@/server/services/products";

const RAIL_TRACK_CLASS =
  "-mx-(--page-gutter) flex snap-x snap-mandatory gap-3 overflow-x-auto px-(--page-gutter) pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const RAIL_ITEM_CLASS = "w-[44vw] shrink-0 snap-start sm:w-[30vw] lg:w-[19vw]";

const PRIORITY_ITEMS = 3;

type ProductRailProps = {
  label: string;
  isAboveFold?: boolean;
  products: readonly ProductListItem[];
};

export function ProductRail({
  isAboveFold = false,
  label,
  products,
}: ProductRailProps) {
  return (
    <ul aria-label={label} className={RAIL_TRACK_CLASS} tabIndex={0}>
      {products.map((product, index) => (
        <li className={RAIL_ITEM_CLASS} key={product.id}>
          <ProductCard
            priority={isAboveFold && index < PRIORITY_ITEMS}
            product={product}
            sizes={PRODUCT_CARD_SIZES.rail}
          />
        </li>
      ))}
    </ul>
  );
}

export function ProductRailSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div aria-hidden="true" className={RAIL_TRACK_CLASS}>
      {Array.from({ length: items }, (_, index) => (
        <div className={RAIL_ITEM_CLASS} key={index}>
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  );
}
