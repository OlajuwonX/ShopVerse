"use client";

import { useId } from "react";

import { catalogueSortOptions } from "@/features/products/schemas/catalogue-query";
import { useCatalogueFilters } from "@/features/filters/useCatalogueFilters";

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
        className="min-h-11 rounded-md border border-border bg-surface-raised px-3 text-body-sm pointer-coarse:text-body text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
