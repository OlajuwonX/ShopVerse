import type { CatalogueRequest } from "@/features/products/schemas/catalogue-api";
import { catalogueRequestKey } from "@/features/products/schemas/catalogue-api";
import type { SearchSuggestions } from "@/server/services/search";

export const queryKeys = {
  products: {
    all: ["products"] as const,
    list: (request: CatalogueRequest) =>
      [...queryKeys.products.all, "list", catalogueRequestKey(request)] as const,
  },
  search: {
    all: ["search"] as const,
    suggestions: (term: string) =>
      [...queryKeys.search.all, "suggestions", term.trim().toLowerCase()] as const,
  },
  wishlist: {
    all: ["wishlist"] as const,
    hydration: (productIds: readonly string[]) =>
      [
        ...queryKeys.wishlist.all,
        "hydration",
        [...productIds].sort().join(","),
      ] as const,
  },
} as const;

export type SearchSuggestionsResult = SearchSuggestions;
