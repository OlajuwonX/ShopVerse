import type { Metadata } from "next";

import { InfiniteProductGrid } from "@/components/commerce/InfiniteProductGrid";
import { AppliedFilters } from "@/components/filters/AppliedFilters";
import { FilterSheet } from "@/components/filters/FilterSheet";
import { ResultCount } from "@/components/filters/ResultCount";
import { SortSelect } from "@/components/filters/SortSelect";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { SEARCH_MIN_LENGTH } from "@/constants/search";
import { parseCatalogueFilters } from "@/features/filters/catalogue-url";
import {
  toCatalogueQuery,
  type CatalogueRequest,
} from "@/features/products/schemas/catalogue-api";
import {
  getCachedBrandsForCategory,
  getCachedProductPage,
} from "@/server/cache/catalogue";
import { CATALOGUE_PRICE_CEILING } from "@/server/services/products";

export const revalidate = 60;

const SEARCH_PAGE_SIZE = 24;

export const metadata: Metadata = {
  robots: { follow: true, index: false },
  title: "Search",
};

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry === "string") {
        params.append(key, entry);
      }
    }
  }

  const filters = parseCatalogueFilters(params);
  const term = filters.query;
  const isSearchable = term !== null && term.length >= SEARCH_MIN_LENGTH;

  const brands = await getCachedBrandsForCategory();
  const knownBrands = new Set(brands.map((brand) => brand.slug));
  const appliedBrands = filters.brandSlugs.filter((slug) => knownBrands.has(slug));
  const droppedBrands = filters.brandSlugs.length - appliedBrands.length;

  const catalogueRequest: CatalogueRequest = {
    categorySlug: null,
    filters: { ...filters, brandSlugs: appliedBrands },
  };

  const page = isSearchable
    ? await getCachedProductPage(
        toCatalogueQuery(catalogueRequest, { limit: SEARCH_PAGE_SIZE }),
      )
    : null;

  const brandNames = Object.fromEntries(
    brands.map((brand) => [brand.slug, brand.name]),
  );

  const facets = {
    attributes: [],
    brands,
    priceCeiling: CATALOGUE_PRICE_CEILING,
  };

  return (
    <div className="w-full py-6">
      <Breadcrumb
        className="mb-4"
        items={[
          { href: "/", label: "Home" },
          { label: "Search" },
          ...(term ? [{ label: term }] : []),
        ]}
      />

      <header className="mb-4 grid gap-2">
        <h1 className="text-heading-2 font-bold text-text">
          {term ? `Results for ${term}` : "Search ShopVerse"}
        </h1>

        {page ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ResultCount context={term ?? ""} total={page.totalCount} />
            <div className="flex items-center gap-3">
              <FilterSheet facets={facets} />
              <SortSelect />
            </div>
          </div>
        ) : null}

        {droppedBrands > 0 ? (
          <p className="text-caption text-warning">
            {droppedBrands} brand filter{droppedBrands === 1 ? "" : "s"} no longer
            {droppedBrands === 1 ? " applies" : " apply"} and{" "}
            {droppedBrands === 1 ? "was" : "were"} ignored.
          </p>
        ) : null}

        <AppliedFilters brandNames={brandNames} />
      </header>

      {!isSearchable ? (
        <EmptyState
          description={
            term === null
              ? "Use the search field in the header to look for products, categories and brands."
              : `Search terms need at least ${SEARCH_MIN_LENGTH} characters.`
          }
          title="Enter a search term"
        />
      ) : page && page.items.length === 0 ? (
        <EmptyState
          description="No products match this search. Try a different term, clear your filters, or browse a category from the sidebar."
          title={`No results for ${term}`}
        />
      ) : page ? (
        <InfiniteProductGrid
          initialPage={page}
          label={`Search results for ${term}`}
          request={catalogueRequest}
        />
      ) : null}
    </div>
  );
}
