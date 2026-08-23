"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { toCartLineInputs, type StoredCartLine } from "@/features/cart/schemas/cart";
import { queryKeys } from "@/lib/query-keys";
import type { CartValidation, ValidatedCartLine } from "@/server/services/cart";

export type CartLineView = ValidatedCartLine & {
  lastSeenUnitPrice: number | null;
  priceChanged: boolean;
};

const EMPTY_LINES: CartLineView[] = [];

async function fetchCartValidation(
  lines: readonly StoredCartLine[],
  signal: AbortSignal,
): Promise<{ requestedKeys: string[]; validation: CartValidation }> {
  const response = await fetch("/api/cart/validate", {
    body: JSON.stringify({ lines: toCartLineInputs(lines) }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal,
  });

  if (!response.ok) {
    throw Object.assign(new Error("Your cart could not be checked"), {
      status: response.status,
    });
  }

  return {
    requestedKeys: lines.map((line) => `${line.productId}:${line.variantId}`),
    validation: (await response.json()) as CartValidation,
  };
}

function sameKeys(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((key, index) => key === right[index])
  );
}

export function useCartValidation(lines: readonly StoredCartLine[]) {
  const requestKeys = useMemo(
    () => lines.map((line) => `${line.productId}:${line.variantId}:${line.quantity}`),
    [lines],
  );

  const query = useQuery({
    enabled: lines.length > 0,
    queryFn: ({ signal }) => fetchCartValidation(lines, signal),
    queryKey: queryKeys.cart.validation(requestKeys),
  });

  const resolved = useMemo(() => {
    const data = query.data;
    const keys = lines.map((line) => `${line.productId}:${line.variantId}`);

    if (!data || !sameKeys(data.requestedKeys, keys)) {
      return { isMatched: false, lines: EMPTY_LINES, validation: null };
    }

    const stored = new Map(
      lines.map((line) => [`${line.productId}:${line.variantId}`, line]),
    );

    return {
      isMatched: true,
      lines: data.validation.lines.map((line) => {
        const lastSeenUnitPrice = stored.get(line.key)?.lastSeenUnitPrice ?? null;

        return {
          ...line,
          lastSeenUnitPrice,
          priceChanged:
            line.snapshot !== null &&
            lastSeenUnitPrice !== null &&
            lastSeenUnitPrice !== line.unitPrice,
        };
      }),
      validation: data.validation,
    };
  }, [lines, query.data]);

  const blockingIssues = resolved.lines.some(
    (line) => !line.purchasable || line.priceChanged,
  );

  return {
    canCheckout: resolved.isMatched && resolved.lines.length > 0 && !blockingIssues,
    isError: query.isError,
    isLoading: lines.length > 0 && !resolved.isMatched && !query.isError,
    isRevalidating: query.isFetching && resolved.isMatched,
    lines: resolved.lines,
    refetch: query.refetch,
    totals: resolved.validation?.totals ?? null,
  };
}
