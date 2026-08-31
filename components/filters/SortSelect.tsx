"use client";

import { useId } from "react";

import { FIELD_FOCUS, FIELD_TEXT } from "@/components/ui/field-styles";
import { catalogueSortOptions } from "@/features/products/schemas/catalogue-query";
import { useCatalogueFilters } from "@/features/filters/useCatalogueFilters";
import { cn } from "@/lib/cn";

const SORT_LABELS: Record<(typeof catalogueSortOptions)[number], string> = {
  newest: "Newest",
  popularity: "Most popular",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Highest rated",
};

export function SortSelect() {
  const id = useId();
  const { filters, update } = useCatalogueFilters();

  return (
    <div className="flex items-center gap-2">
      <label className="text-caption font-semibold text-text-muted" htmlFor={id}>
        Sort
      </label>
      <select
        className={cn(
          "min-h-11 rounded-md border border-border bg-surface-raised px-3 text-text",
          FIELD_TEXT,
          FIELD_FOCUS,
        )}
        id={id}
        onChange={(event) => {
          update({ sort: event.target.value as (typeof catalogueSortOptions)[number] });
        }}
        value={filters.sort}
      >
        {catalogueSortOptions.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
