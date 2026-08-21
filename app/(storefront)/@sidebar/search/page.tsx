import {
  CatalogueFilters,
  type FilterFacets,
} from "@/components/filters/CatalogueFilters";
import { StorefrontSidebar } from "@/components/navigation/StorefrontSidebar";
import {
  getCachedBrandsForCategory,
  getCachedCategoryTree,
} from "@/server/cache/catalogue";
import { CATALOGUE_PRICE_CEILING } from "@/server/services/products";

export const revalidate = 60;

export default async function SearchSidebarSlot() {
  const [tree, brands] = await Promise.all([
    getCachedCategoryTree(),
    getCachedBrandsForCategory(),
  ]);

  const facets: FilterFacets = {
    attributes: [],
    brands,
    priceCeiling: CATALOGUE_PRICE_CEILING,
  };

  return (
    <StorefrontSidebar tree={tree}>
      <CatalogueFilters facets={facets} />
    </StorefrontSidebar>
  );
}
