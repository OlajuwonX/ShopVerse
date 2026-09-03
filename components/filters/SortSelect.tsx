"use client";

import { Select, type SelectOption } from "@/components/ui/Select";
import { catalogueSortOptions } from "@/features/products/schemas/catalogue-query";
import { useCatalogueFilters } from "@/features/filters/useCatalogueFilters";

const SORT_LABELS: Record<(typeof catalogueSortOptions)[number], string> = {
  newest: "Newest",
  popularity: "Most popular",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Highest rated",
};

const sortOptions: readonly SelectOption[] = catalogueSortOptions.map((option) => ({
  label: SORT_LABELS[option],
  value: option,
}));

export function SortSelect() {
  const { filters, update } = useCatalogueFilters();

  return (
    <Select
      className="min-w-0"
      label="Sort"
      labelPlacement="inline"
      onValueChange={(next) => {
        update({ sort: next as (typeof catalogueSortOptions)[number] });
      }}
      options={sortOptions}
      value={filters.sort}
    />
  );
}
