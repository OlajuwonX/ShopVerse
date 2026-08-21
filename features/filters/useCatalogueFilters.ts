"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useOptimistic, useTransition } from "react";

import {
  buildCatalogueSearchParams,
  EMPTY_FILTER_STATE,
  parseCatalogueFilters,
  toggleValue,
  type CatalogueFilterState,
} from "@/features/filters/catalogue-url";

export function useCatalogueFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlFilters = useMemo(
    () => parseCatalogueFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [filters, setOptimisticFilters] = useOptimistic(urlFilters);

  const apply = useCallback(
    (next: CatalogueFilterState) => {
      const params = buildCatalogueSearchParams(next);
      const query = params.toString();

      startTransition(() => {
        setOptimisticFilters(next);
        router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, setOptimisticFilters],
  );

  const update = useCallback(
    (patch: Partial<CatalogueFilterState>) => {
      apply({ ...filters, ...patch });
    },
    [apply, filters],
  );

  const toggleBrand = useCallback(
    (slug: string) => {
      update({ brandSlugs: toggleValue(filters.brandSlugs, slug) });
    },
    [filters.brandSlugs, update],
  );

  const toggleAttribute = useCallback(
    (attributeSlug: string, value: string) => {
      const current = filters.attributes[attributeSlug] ?? [];
      const next = toggleValue(current, value);
      const attributes = { ...filters.attributes };

      if (next.length > 0) {
        attributes[attributeSlug] = next;
      } else {
        delete attributes[attributeSlug];
      }

      update({ attributes });
    },
    [filters.attributes, update],
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      setOptimisticFilters({
        ...EMPTY_FILTER_STATE,
        ...(filters.query ? { query: filters.query } : {}),
      });
      router.replace(
        filters.query
          ? `${pathname}?${buildCatalogueSearchParams({
              ...EMPTY_FILTER_STATE,
              query: filters.query,
            }).toString()}`
          : pathname,
        { scroll: false },
      );
    });
  }, [filters.query, pathname, router, setOptimisticFilters]);

  return {
    apply,
    clearAll,
    filters,
    isPending,
    toggleAttribute,
    toggleBrand,
    update,
  };
}
