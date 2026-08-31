"use client";

import { X } from "lucide-react";

import { MAX_RATING } from "@/features/filters/catalogue-url";
import { useCatalogueFilters } from "@/features/filters/useCatalogueFilters";
import { formatMoney } from "@/components/commerce/Money";

type Chip = {
  key: string;
  label: string;
  remove: () => void;
};

export function AppliedFilters({ brandNames }: { brandNames: Record<string, string> }) {
  const { clearAll, filters, toggleAttribute, toggleBrand, update } =
    useCatalogueFilters();

  const chips: Chip[] = [];

  for (const slug of filters.brandSlugs) {
    chips.push({
      key: `brand-${slug}`,
      label: brandNames[slug] ?? slug,
      remove: () => {
        toggleBrand(slug);
      },
    });
  }

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const from = filters.minPrice;
    const to = filters.maxPrice;

    function priceLabel() {
      if (from === null) {
        return `Up to ${formatMoney(to ?? 0)}`;
      }

      if (to === null) {
        return `From ${formatMoney(from)}`;
      }

      return `${formatMoney(from)} – ${formatMoney(to)}`;
    }

    chips.push({
      key: "price",
      label: priceLabel(),
      remove: () => {
        update({ maxPrice: null, minPrice: null });
      },
    });
  }

  if (filters.minRating !== null) {
    chips.push({
      key: "rating",
      label:
        filters.minRating === MAX_RATING
          ? `${filters.minRating}★`
          : `${filters.minRating}★ and up`,
      remove: () => {
        update({ minRating: null });
      },
    });
  }

  if (filters.inStockOnly) {
    chips.push({
      key: "in-stock",
      label: "In stock",
      remove: () => {
        update({ inStockOnly: false });
      },
    });
  }

  if (filters.onSaleOnly) {
    chips.push({
      key: "on-sale",
      label: "On sale",
      remove: () => {
        update({ onSaleOnly: false });
      },
    });
  }

  for (const [slug, values] of Object.entries(filters.attributes)) {
    for (const value of values) {
      chips.push({
        key: `${slug}-${value}`,
        label: value,
        remove: () => {
          toggleAttribute(slug, value);
        },
      });
    }
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface-raised px-3 text-caption font-semibold text-text hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={chip.remove}
              type="button"
            >
              {chip.label}
              <X aria-hidden="true" className="size-3" />
              <span className="sr-only">Remove filter</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        className="min-h-9 rounded-full px-3 text-caption font-semibold text-brand underline hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={clearAll}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}
