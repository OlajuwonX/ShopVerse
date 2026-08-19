"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import {
  buildCatalogueSearchParams,
  parseCatalogueFilters,
  toggleValue,
  type CatalogueFilterState,
} from "@/features/filters/catalogue-url";

export function useCatalogueFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters = useMemo(
    () => parseCatalogueFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const apply = useCallback(
    (next: CatalogueFilterState) => {
      const params = buildCatalogueSearchParams(next);
      const query = params.toString();

      startTransition(() => {
        router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router],
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
      router.replace(pathname, { scroll: false });
    });
  }, [pathname, router]);

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
