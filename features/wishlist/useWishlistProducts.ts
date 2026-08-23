"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { WISHLIST_IDS_PARAM } from "@/constants/wishlist";
import { queryKeys } from "@/lib/query-keys";
import type { ProductListItem } from "@/server/services/products";

type WishlistHydration = {
  items: ProductListItem[];
  requestedIds: string[];
};

const NO_PRODUCTS: ProductListItem[] = [];
const NO_IDS: string[] = [];

async function fetchWishlistProducts(
  productIds: readonly string[],
  signal: AbortSignal,
): Promise<WishlistHydration> {
  const params = new URLSearchParams({
    [WISHLIST_IDS_PARAM]: productIds.join(","),
  });

  const response = await fetch(`/api/wishlist?${params.toString()}`, { signal });

  if (!response.ok) {
    throw Object.assign(new Error("Saved products could not be loaded"), {
      status: response.status,
    });
  }

  const payload = (await response.json()) as { items: ProductListItem[] };

  return { items: payload.items, requestedIds: [...productIds] };
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function useWishlistProducts(productIds: readonly string[]) {
  const query = useQuery({
    enabled: productIds.length > 0,
    queryFn: ({ signal }) => fetchWishlistProducts(productIds, signal),
    queryKey: queryKeys.wishlist.hydration(productIds),
  });

  const current = useMemo(() => {
    const data = query.data;

    if (!data || !sameIds(data.requestedIds, productIds)) {
      return { isMatched: false, missingIds: NO_IDS, products: NO_PRODUCTS };
    }

    const byId = new Map(data.items.map((item) => [item.id, item]));

    return {
      isMatched: true,
      missingIds: productIds.filter((productId) => !byId.has(productId)),
      products: productIds.flatMap((productId) => {
        const item = byId.get(productId);

        return item ? [item] : [];
      }),
    };
  }, [productIds, query.data]);

  return {
    isError: query.isError,
    isLoading: productIds.length > 0 && !current.isMatched && !query.isError,
    missingIds: current.missingIds,
    products: current.products,
    refetch: query.refetch,
  };
}
