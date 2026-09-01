import {
  ProductCard,
  ProductCardSkeleton,
  PRODUCT_CARD_SIZES,
} from "@/components/commerce/ProductCard";
import { cn } from "@/lib/cn";
import type { ProductListItem } from "@/server/services/products";

const columnClasses: Record<number, string> = {
  2: "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),1fr))]",
  3: "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]",
  4: "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,14rem),1fr))]",
  5: "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,11rem),1fr))]",
  6: "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,9rem),1fr))]",
};

const GRID_TRACK_CLASS =
  "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,9rem),1fr))]";
const PRIORITY_ITEMS = 4;

export function gridColumnClass(columns: number) {
  return columnClasses[columns] ?? "lg:grid-cols-4";
}

type ProductGridProps = {
  columns?: number;
  isAboveFold?: boolean;
  label?: string;
  products: readonly ProductListItem[];
};

export function ProductGrid({
  columns = 4,
  isAboveFold = false,
  label,
  products,
}: ProductGridProps) {
  return (
    <ul
      className={cn(GRID_TRACK_CLASS, gridColumnClass(columns))}
      {...(label ? { "aria-label": label } : {})}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard
            priority={isAboveFold && index < PRIORITY_ITEMS}
            product={product}
            sizes={PRODUCT_CARD_SIZES.grid}
          />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({
  columns = 4,
  items = 8,
}: {
  columns?: number;
  items?: number;
}) {
  return (
    <div aria-hidden="true" className={cn(GRID_TRACK_CLASS, gridColumnClass(columns))}>
      {Array.from({ length: items }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
