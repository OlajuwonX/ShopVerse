"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH } from "@/constants/search";
import { queryKeys } from "@/lib/query-keys";
import type { SearchSuggestions } from "@/server/services/search";

const EMPTY: SearchSuggestions = { brands: [], categories: [], products: [], term: "" };

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debounced;
}

async function fetchSuggestions(term: string, signal: AbortSignal) {
  const response = await fetch(
    `/api/search/suggestions?q=${encodeURIComponent(term)}`,
    {
      signal,
    },
  );

  if (!response.ok) {
    throw Object.assign(new Error("Search unavailable"), { status: response.status });
  }

  return (await response.json()) as SearchSuggestions;
}

export function useSearchSuggestions(term: string) {
  const debouncedTerm = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debouncedTerm.length >= SEARCH_MIN_LENGTH;

  const query = useQuery({
    enabled,
    queryFn: ({ signal }) => fetchSuggestions(debouncedTerm, signal),
    queryKey: queryKeys.search.suggestions(debouncedTerm),
  });

  return {
    isError: query.isError,
    isLoading: enabled && query.isPending,
    isStale: enabled && debouncedTerm !== term.trim(),
    suggestions: query.data ?? EMPTY,
    term: debouncedTerm,
  };
}
