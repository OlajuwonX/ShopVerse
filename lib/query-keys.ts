import type { SearchSuggestions } from "@/server/services/search";

export const queryKeys = {
  search: {
    all: ["search"] as const,
    suggestions: (term: string) =>
      [...queryKeys.search.all, "suggestions", term.trim().toLowerCase()] as const,
  },
} as const;

export type SearchSuggestionsResult = SearchSuggestions;
