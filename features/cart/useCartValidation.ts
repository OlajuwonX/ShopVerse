"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { toCartLineInputs, type StoredCartLine } from "@/features/cart/schemas/cart";
import { queryKeys } from "@/lib/query-keys";
import type { CartValidation, ValidatedCartLine } from "@/server/services/cart";

export type CartLineView = ValidatedCartLine & {
  lastSeenUnitPrice: number | null;
  priceChanged: boolean;
};

type CartValidationData = {
  requestedKeys: string[];
  requestedState: string | null;
  validation: CartValidation;
};

const EMPTY_LINES: CartLineView[] = [];

async function fetchCartValidation(
  lines: readonly StoredCartLine[],
  deliveryState: string | undefined,
  signal: AbortSignal,
): Promise<CartValidationData> {
  const response = await fetch("/api/cart/validate", {
    body: JSON.stringify({
      ...(deliveryState === undefined ? {} : { deliveryState }),
      lines: toCartLineInputs(lines),
    }),
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
    requestedState: deliveryState ?? null,
    validation: (await response.json()) as CartValidation,
  };
}

function sameKeys(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((key, index) => key === right[index])
  );
}

export function useCartValidation(
  lines: readonly StoredCartLine[],
  deliveryState?: string | undefined,
) {
  const requestKeys = useMemo(
    () => [
      ...lines.map((line) => `${line.productId}:${line.variantId}:${line.quantity}`),
      ...(deliveryState === undefined ? [] : [`state=${deliveryState}`]),
    ],
    [deliveryState, lines],
  );

  const query = useQuery({
    enabled: lines.length > 0,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchCartValidation(lines, deliveryState, signal),
    queryKey: queryKeys.cart.validation(requestKeys),
  });

  const resolved = useMemo<{
    linesMatched: boolean;
    lines: CartLineView[];
    quoteMatched: boolean;
    validation: CartValidation | null;
  }>(() => {
    const data = query.data;
    const keys = lines.map((line) => `${line.productId}:${line.variantId}`);

    if (!data || !sameKeys(data.requestedKeys, keys)) {
      return {
        linesMatched: false,
        lines: EMPTY_LINES,
        quoteMatched: false,
        validation: null,
      };
    }

    const stored = new Map(
      lines.map((line) => [`${line.productId}:${line.variantId}`, line]),
    );

    return {
      linesMatched: true,
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
      quoteMatched: data.requestedState === (deliveryState ?? null),
      validation: data.validation,
    };
  }, [deliveryState, lines, query.data]);

  const blockingIssues = resolved.lines.some(
    (line) => !line.purchasable || line.priceChanged,
  );

  return {
    canCheckout:
      resolved.linesMatched &&
      resolved.quoteMatched &&
      resolved.lines.length > 0 &&
      !blockingIssues,
    isError: query.isError,
    isLoading: lines.length > 0 && !resolved.linesMatched && !query.isError,
    isRevalidating:
      resolved.linesMatched && (query.isFetching || !resolved.quoteMatched),
    lines: resolved.lines,
    refetch: query.refetch,
    totals: resolved.validation?.totals ?? null,
  };
}
