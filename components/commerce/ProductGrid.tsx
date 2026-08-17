import {
  ProductCard,
  ProductCardSkeleton,
  PRODUCT_CARD_SIZES,
} from "@/components/commerce/ProductCard";
import { cn } from "@/lib/cn";
import type { ProductListItem } from "@/server/services/products";

const columnClasses: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

const GRID_TRACK_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3";
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
