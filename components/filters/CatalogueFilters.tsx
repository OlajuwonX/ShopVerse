"use client";

import { PriceRange } from "@/components/filters/PriceRange";
import { Checkbox } from "@/components/ui/Checkbox";
import { useCatalogueFilters } from "@/features/filters/useCatalogueFilters";
import { MAX_RATING } from "@/features/filters/catalogue-url";

export type FilterFacets = {
  attributes: {
    id: string;
    name: string;
    options: { id: string; value: string }[];
    slug: string;
    unit: string | null;
  }[];
  brands: { name: string; slug: string }[];
  priceCeiling: number;
};

function FilterSection({
  children,
  legend,
}: {
  children: React.ReactNode;
  legend: string;
}) {
  return (
    <fieldset className="grid gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <legend className="text-label font-semibold text-text">{legend}</legend>
      <div className="grid gap-2">{children}</div>
    </fieldset>
  );
}

export function CatalogueFilters({ facets }: { facets: FilterFacets }) {
  const { clearAll, filters, isPending, toggleAttribute, toggleBrand, update } =
    useCatalogueFilters();

  return (
    <div aria-busy={isPending} className="grid gap-4">
      <PriceRange
        ceiling={facets.priceCeiling}
        key={filters.maxPrice ?? "max"}
        maxPrice={filters.maxPrice}
        onCommit={(range) => {
          update(range);
        }}
      />

      {facets.brands.length > 0 ? (
        <FilterSection legend="Brand">
          {facets.brands.map((brand) => (
            <Checkbox
              checked={filters.brandSlugs.includes(brand.slug)}
              key={brand.slug}
              label={brand.name}
              name={`brand-${brand.slug}`}
              onChange={() => {
                toggleBrand(brand.slug);
              }}
            />
          ))}
        </FilterSection>
      ) : null}

      <FilterSection legend="Rating">
        {Array.from({ length: MAX_RATING - 1 }, (_, index) => MAX_RATING - index).map(
          (rating) => (
            <Checkbox
              checked={filters.minRating === rating}
              key={rating}
              label={rating === MAX_RATING ? `${rating} stars` : `${rating} stars and up`}
              name={`rating-${rating}`}
              onChange={() => {
                update({ minRating: filters.minRating === rating ? null : rating });
              }}
            />
          ),
        )}
      </FilterSection>

      <FilterSection legend="Availability">
        <Checkbox
          checked={filters.inStockOnly}
          label="In stock only"
          name="in-stock"
          onChange={() => {
            update({ inStockOnly: !filters.inStockOnly });
          }}
        />
        <Checkbox
          checked={filters.onSaleOnly}
          label="On sale"
          name="on-sale"
          onChange={() => {
            update({ onSaleOnly: !filters.onSaleOnly });
          }}
        />
      </FilterSection>

      {facets.attributes.map((attribute) => (
        <FilterSection
          key={attribute.id}
          legend={
            attribute.unit ? `${attribute.name} (${attribute.unit})` : attribute.name
          }
        >
          {attribute.options.map((option) => (
            <Checkbox
              checked={(filters.attributes[attribute.slug] ?? []).includes(
                option.value.toLowerCase(),
              )}
              key={option.id}
              label={option.value}
              name={`${attribute.slug}-${option.id}`}
              onChange={() => {
                toggleAttribute(attribute.slug, option.value.toLowerCase());
              }}
            />
          ))}
        </FilterSection>
      ))}

      <button
        className="mt-2 min-h-11 rounded-md border border-border px-4 text-label font-semibold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={clearAll}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}
