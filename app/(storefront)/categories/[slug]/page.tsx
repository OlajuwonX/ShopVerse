import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/commerce/ProductGrid";
import { AppliedFilters } from "@/components/filters/AppliedFilters";
import type { FilterFacets } from "@/components/filters/CatalogueFilters";
import { FilterSheet } from "@/components/filters/FilterSheet";
import { ResultCount } from "@/components/filters/ResultCount";
import { SortSelect } from "@/components/filters/SortSelect";
import { CategoryRail } from "@/components/navigation/CategoryRail";
import { buildBreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { serverEnv } from "@/config/env";
import { buildCategoryBreadcrumbs } from "@/features/categories/navigation";
import { parseCatalogueFilters } from "@/features/filters/catalogue-url";
import { catalogueQuerySchema } from "@/features/products/schemas/catalogue-query";
import { categoryHref } from "@/lib/routes";
import {
  getCachedBrandsForCategory,
  getCachedCategoryAncestors,
  getCachedCategoryBySlug,
  getCachedCategoryFilterAttributes,
  getCachedCategoryTree,
  getCachedProductPage,
} from "@/server/cache/catalogue";
import { MAX_PRICE_MINOR_UNITS } from "@/server/services/products";

export const revalidate = 60;

const CATEGORY_PAGE_SIZE = 24;
const PRICE_CEILING = 5_000_000_00;

export async function generateMetadata({
  params,
}: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    alternates: { canonical: categoryHref(category.slug) },
    ...(category.description ? { description: category.description } : {}),
    openGraph: {
      title: `${category.name} | ShopVerse`,
      type: "website",
      url: categoryHref(category.slug),
      ...(category.description ? { description: category.description } : {}),
    },
    title: category.name,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/categories/[slug]">) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const urlParams = new URLSearchParams();

  for (const [key, value] of Object.entries(rawSearchParams)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry === "string") {
        urlParams.append(key, entry);
      }
    }
  }

  const filters = parseCatalogueFilters(urlParams);

  const [ancestors, tree, brands, attributes] = await Promise.all([
    getCachedCategoryAncestors(category.id),
    getCachedCategoryTree(),
    getCachedBrandsForCategory(category.slug),
    getCachedCategoryFilterAttributes(category.id),
  ]);

  const knownBrands = new Set(brands.map((brand) => brand.slug));
  const appliedBrands = filters.brandSlugs.filter((entry) => knownBrands.has(entry));
  const droppedBrands = filters.brandSlugs.length - appliedBrands.length;

  const page = await getCachedProductPage(
    catalogueQuerySchema.parse({
      ...(Object.keys(filters.attributes).length > 0
        ? { attributes: filters.attributes }
        : {}),
      ...(appliedBrands.length > 0 ? { brandSlugs: appliedBrands } : {}),
      categorySlug: category.slug,
      ...(filters.inStockOnly ? { inStockOnly: true } : {}),
      limit: CATEGORY_PAGE_SIZE,
      ...(filters.maxPrice === null ? {} : { maxPrice: filters.maxPrice }),
      ...(filters.minPrice === null ? {} : { minPrice: filters.minPrice }),
      ...(filters.minRating === null ? {} : { minRating: filters.minRating }),
      ...(filters.onSaleOnly ? { onSaleOnly: true } : {}),
      sort: filters.sort,
    }),
  );

  const breadcrumbs = buildCategoryBreadcrumbs(ancestors, categoryHref);
  const brandNames = Object.fromEntries(
    brands.map((brand) => [brand.slug, brand.name]),
  );

  const facets: FilterFacets = {
    attributes: attributes.map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      options: attribute.options,
      slug: attribute.slug,
      unit: attribute.unit,
    })),
    brands,
    priceCeiling: Math.min(PRICE_CEILING, MAX_PRICE_MINOR_UNITS),
  };

  return (
    <div className="w-full py-6">
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbs, serverEnv.APP_ORIGIN)} />

      <Breadcrumb className="mb-4" items={breadcrumbs} />

      <CategoryRail activeSlug={category.slug} className="mb-6 lg:hidden" tree={tree} />

      <div className="min-w-0">
        <header className="mb-4 grid gap-2">
          <h1 className="text-heading-2 font-bold text-text">{category.name}</h1>
          {category.description ? (
            <p className="text-body-sm text-text-muted">{category.description}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ResultCount context={category.name} total={page.totalCount} />
            <div className="flex items-center gap-3">
              <FilterSheet facets={facets} />
              <SortSelect />
            </div>
          </div>

          {droppedBrands > 0 ? (
            <p className="text-caption text-warning">
              {droppedBrands} brand filter{droppedBrands === 1 ? "" : "s"} no longer
              apply to this category and {droppedBrands === 1 ? "was" : "were"} ignored.
            </p>
          ) : null}

          <AppliedFilters brandNames={brandNames} />
        </header>

        {page.items.length === 0 ? (
          <EmptyState
            description="No products match these filters. Clearing them will show the full category."
            title="No products found"
          />
        ) : (
          <ProductGrid
            isAboveFold
            label={`${category.name} products`}
            products={page.items}
          />
        )}

        {page.nextCursor ? (
          <p className="mt-6 text-caption text-text-subtle">
            Showing the first {page.items.length} of {page.totalCount}; continuous
            browsing arrives in Stage 22.
          </p>
        ) : null}
      </div>
    </div>
  );
}
