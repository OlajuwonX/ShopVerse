"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { ProductGrid, ProductGridSkeleton } from "@/components/commerce/ProductGrid";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  buildCatalogueRequestParams,
  type CatalogueRequest,
} from "@/features/products/schemas/catalogue-api";
import { queryKeys } from "@/lib/query-keys";
import type { ProductPage } from "@/server/services/products";

const PREFETCH_ROOT_MARGIN = "600px";

type InfiniteProductGridProps = {
  initialPage: ProductPage;
  label: string;
  request: CatalogueRequest;
};

async function fetchCataloguePage(
  request: CatalogueRequest,
  cursor: string | null,
  signal: AbortSignal,
): Promise<ProductPage> {
  const params = buildCatalogueRequestParams(request, cursor);
  const response = await fetch(`/api/products?${params.toString()}`, { signal });

  if (!response.ok) {
    throw Object.assign(new Error("Could not load more products"), {
      status: response.status,
    });
  }

  return (await response.json()) as ProductPage;
}

export function InfiniteProductGrid({
  initialPage,
  label,
  request,
}: InfiniteProductGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: ProductPage) => lastPage.nextCursor ?? undefined,
    initialData: { pageParams: [null], pages: [initialPage] },
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchCataloguePage(request, pageParam, signal),
    queryKey: queryKeys.products.list(request),
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const products = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const totalCount = query.data?.pages[0]?.totalCount ?? initialPage.totalCount;

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: PREFETCH_ROOT_MARGIN },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="grid gap-6">
      <ProductGrid isAboveFold label={label} products={products} />

      <p aria-atomic="true" aria-live="polite" className="sr-only">
        Showing {products.length} of {totalCount} products
      </p>

      {query.isError ? (
        <ErrorState
          description="More products could not be loaded. Your current results are unchanged."
          title="Could not load more"
        />
      ) : null}

      {isFetchingNextPage ? <ProductGridSkeleton items={4} /> : null}

      <div aria-hidden="true" ref={sentinelRef} />

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            aria-busy={isFetchingNextPage}
            onClick={() => {
              if (!isFetchingNextPage) {
                void fetchNextPage();
              }
            }}
            variant="secondary"
          >
            {query.isError ? "Try again" : "Load more products"}
          </Button>
        </div>
      ) : (
        <p className="text-center text-caption text-text-subtle">
          {products.length >= totalCount && totalCount > 0
            ? `All ${totalCount} products shown`
            : null}
        </p>
      )}
    </div>
  );
}
