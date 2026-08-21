import "server-only";

import { unstable_cache } from "next/cache";

import { cacheTags, CATALOGUE_LISTING_TTL_SECONDS } from "@/server/cache/tags";
import {
  normaliseSearchTerm,
  searchSuggestions,
  type SearchSuggestions,
} from "@/server/services/search";

const CACHE_NAMESPACE = "search";

export function getCachedSearchSuggestions(term: string): Promise<SearchSuggestions> {
  const key = normaliseSearchTerm(term).toLowerCase();

  return unstable_cache(
    () => searchSuggestions(key),
    [CACHE_NAMESPACE, "suggestions", key],
    {
      revalidate: CATALOGUE_LISTING_TTL_SECONDS,
      tags: [cacheTags.products(), cacheTags.categories(), cacheTags.brands()],
    },
  )();
}
