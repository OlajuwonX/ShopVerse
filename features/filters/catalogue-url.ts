import {
  catalogueSortOptions,
  type CatalogueSort,
} from "@/features/products/schemas/catalogue-query";
import { toMajorUnits, toMinorUnits } from "@/lib/money";

export const FILTER_PARAM = {
  ATTRIBUTE_PREFIX: "attr.",
  BRAND: "brand",
  IN_STOCK: "inStock",
  MAX_PRICE: "maxPrice",
  MIN_PRICE: "minPrice",
  ON_SALE: "onSale",
  RATING: "rating",
  SORT: "sort",
} as const;

export const MAX_BRAND_FILTERS = 20;
export const MAX_ATTRIBUTE_FILTERS = 12;
export const MAX_ATTRIBUTE_VALUES = 20;
export const MAX_RATING = 5;

export type CatalogueFilterState = {
  attributes: Record<string, string[]>;
  brandSlugs: string[];
  inStockOnly: boolean;
  maxPrice: number | null;
  minPrice: number | null;
  minRating: number | null;
  onSaleOnly: boolean;
  sort: CatalogueSort;
};

export const EMPTY_FILTER_STATE: CatalogueFilterState = {
  attributes: {},
  brandSlugs: [],
  inStockOnly: false,
  maxPrice: null,
  minPrice: null,
  minRating: null,
  onSaleOnly: false,
  sort: "popularity",
};

function splitValues(raw: string[]) {
  return raw
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0 && value.length <= 96);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function parseMajorUnitPrice(raw: string | null) {
  if (raw === null) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return toMinorUnits(Math.floor(parsed));
}

function parseRating(raw: string | null) {
  if (raw === null) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RATING) {
    return null;
  }

  return parsed;
}

function parseFlag(raw: string | null) {
  return raw === "1" || raw === "true";
}

function parseSort(raw: string | null): CatalogueSort {
  const match = catalogueSortOptions.find((option) => option === raw);

  return match ?? EMPTY_FILTER_STATE.sort;
}

export function parseCatalogueFilters(params: URLSearchParams): CatalogueFilterState {
  const attributes: Record<string, string[]> = {};

  for (const key of new Set(params.keys())) {
    if (!key.startsWith(FILTER_PARAM.ATTRIBUTE_PREFIX)) {
      continue;
    }

    const slug = key.slice(FILTER_PARAM.ATTRIBUTE_PREFIX.length).trim().toLowerCase();

    if (slug.length === 0 || slug.length > 96) {
      continue;
    }

    const values = uniqueSorted(splitValues(params.getAll(key))).slice(
      0,
      MAX_ATTRIBUTE_VALUES,
    );

    if (values.length > 0 && Object.keys(attributes).length < MAX_ATTRIBUTE_FILTERS) {
      attributes[slug] = values;
    }
  }

  const minPrice = parseMajorUnitPrice(params.get(FILTER_PARAM.MIN_PRICE));
  const maxPrice = parseMajorUnitPrice(params.get(FILTER_PARAM.MAX_PRICE));
  const swap = minPrice !== null && maxPrice !== null && minPrice > maxPrice;

  return {
    attributes,
    brandSlugs: uniqueSorted(splitValues(params.getAll(FILTER_PARAM.BRAND))).slice(
      0,
      MAX_BRAND_FILTERS,
    ),
    inStockOnly: parseFlag(params.get(FILTER_PARAM.IN_STOCK)),
    maxPrice: swap ? minPrice : maxPrice,
    minPrice: swap ? maxPrice : minPrice,
    minRating: parseRating(params.get(FILTER_PARAM.RATING)),
    onSaleOnly: parseFlag(params.get(FILTER_PARAM.ON_SALE)),
    sort: parseSort(params.get(FILTER_PARAM.SORT)),
  };
}

export function buildCatalogueSearchParams(state: CatalogueFilterState) {
  const params = new URLSearchParams();

  if (state.brandSlugs.length > 0) {
    params.set(FILTER_PARAM.BRAND, uniqueSorted(state.brandSlugs).join(","));
  }

  if (state.minPrice !== null) {
    params.set(FILTER_PARAM.MIN_PRICE, String(toMajorUnits(state.minPrice)));
  }

  if (state.maxPrice !== null) {
    params.set(FILTER_PARAM.MAX_PRICE, String(toMajorUnits(state.maxPrice)));
  }

  if (state.minRating !== null) {
    params.set(FILTER_PARAM.RATING, String(state.minRating));
  }

  if (state.inStockOnly) {
    params.set(FILTER_PARAM.IN_STOCK, "1");
  }

  if (state.onSaleOnly) {
    params.set(FILTER_PARAM.ON_SALE, "1");
  }

  if (state.sort !== EMPTY_FILTER_STATE.sort) {
    params.set(FILTER_PARAM.SORT, state.sort);
  }

  for (const slug of Object.keys(state.attributes).sort()) {
    const values = state.attributes[slug] ?? [];

    if (values.length > 0) {
      params.set(
        `${FILTER_PARAM.ATTRIBUTE_PREFIX}${slug}`,
        uniqueSorted(values).join(","),
      );
    }
  }

  return params;
}

export function activeFilterCount(state: CatalogueFilterState) {
  return (
    state.brandSlugs.length +
    (state.minPrice !== null || state.maxPrice !== null ? 1 : 0) +
    (state.minRating !== null ? 1 : 0) +
    (state.inStockOnly ? 1 : 0) +
    (state.onSaleOnly ? 1 : 0) +
    Object.values(state.attributes).reduce((total, values) => total + values.length, 0)
  );
}

export function hasActiveFilters(state: CatalogueFilterState) {
  return activeFilterCount(state) > 0;
}

export function toggleValue(values: readonly string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}
