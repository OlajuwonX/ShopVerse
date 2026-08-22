import { z } from "zod";

import {
  buildCatalogueSearchParams,
  parseCatalogueFilters,
  type CatalogueFilterState,
} from "@/features/filters/catalogue-url";
import {
  catalogueQuerySchema,
  CATALOGUE_MAX_PAGE_SIZE,
  CATALOGUE_PAGE_SIZE,
  type CatalogueQuery,
} from "@/features/products/schemas/catalogue-query";

export const CATALOGUE_CATEGORY_PARAM = "category";
export const CATALOGUE_CURSOR_PARAM = "cursor";
export const CATALOGUE_LIMIT_PARAM = "limit";

export type CatalogueRequest = {
  categorySlug: string | null;
  filters: CatalogueFilterState;
  limit?: number;
};

export function buildCatalogueRequestParams(
  request: CatalogueRequest,
  cursor?: string | null,
) {
  const params = buildCatalogueSearchParams(request.filters);

  if (request.categorySlug) {
    params.set(CATALOGUE_CATEGORY_PARAM, request.categorySlug);
  }

  if (request.limit !== undefined) {
    params.set(CATALOGUE_LIMIT_PARAM, String(request.limit));
  }

  if (cursor) {
    params.set(CATALOGUE_CURSOR_PARAM, cursor);
  }

  return params;
}

export function parseCatalogueRequest(params: URLSearchParams): CatalogueRequest {
  const raw = params.get(CATALOGUE_CATEGORY_PARAM);
  const categorySlug = z
    .string()
    .trim()
    .min(1)
    .max(96)
    .safeParse(raw ?? "");

  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(CATALOGUE_MAX_PAGE_SIZE)
    .safeParse(params.get(CATALOGUE_LIMIT_PARAM));

  return {
    categorySlug: categorySlug.success ? categorySlug.data.toLowerCase() : null,
    filters: parseCatalogueFilters(params),
    ...(limit.success ? { limit: limit.data } : {}),
  };
}

export function toCatalogueQuery(
  request: CatalogueRequest,
  options: { cursor?: string | null; limit?: number } = {},
): CatalogueQuery {
  const { filters } = request;

  return catalogueQuerySchema.parse({
    ...(Object.keys(filters.attributes).length > 0
      ? { attributes: filters.attributes }
      : {}),
    ...(filters.brandSlugs.length > 0 ? { brandSlugs: filters.brandSlugs } : {}),
    ...(request.categorySlug ? { categorySlug: request.categorySlug } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
    ...(filters.inStockOnly ? { inStockOnly: true } : {}),
    limit: request.limit ?? options.limit ?? CATALOGUE_PAGE_SIZE,
    ...(filters.maxPrice === null ? {} : { maxPrice: filters.maxPrice }),
    ...(filters.minPrice === null ? {} : { minPrice: filters.minPrice }),
    ...(filters.minRating === null ? {} : { minRating: filters.minRating }),
    ...(filters.onSaleOnly ? { onSaleOnly: true } : {}),
    ...(filters.query ? { search: filters.query } : {}),
    sort: filters.sort,
  });
}

export function catalogueRequestKey(request: CatalogueRequest) {
  return buildCatalogueRequestParams(request).toString();
}
