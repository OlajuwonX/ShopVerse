import { notFound } from "next/navigation";

import {
  CatalogueFilters,
  type FilterFacets,
} from "@/components/filters/CatalogueFilters";
import { StorefrontSidebar } from "@/components/navigation/StorefrontSidebar";
import {
  getCachedBrandsForCategory,
  getCachedCategoryBySlug,
  getCachedCategoryFilterAttributes,
  getCachedCategoryTree,
} from "@/server/cache/catalogue";
import { CATALOGUE_PRICE_CEILING } from "@/server/services/products";

export const revalidate = 60;

export default async function CategorySidebarSlot({
  params,
}: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const [tree, brands, attributes] = await Promise.all([
    getCachedCategoryTree(),
    getCachedBrandsForCategory(category.slug),
    getCachedCategoryFilterAttributes(category.id),
  ]);

  const facets: FilterFacets = {
    attributes: attributes.map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      options: attribute.options,
      slug: attribute.slug,
      unit: attribute.unit,
    })),
    brands,
    priceCeiling: CATALOGUE_PRICE_CEILING,
  };

  return (
    <StorefrontSidebar activeSlug={category.slug} tree={tree}>
      <CatalogueFilters facets={facets} />
    </StorefrontSidebar>
  );
}
