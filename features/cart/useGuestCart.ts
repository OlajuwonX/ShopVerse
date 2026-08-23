"use client";

import { useCallback, useSyncExternalStore } from "react";

import { GUEST_CART_KEY } from "@/constants/cart";
import {
  acknowledgeGuestCartPrices,
  addGuestCartLine,
  clearGuestCart,
  readGuestCart,
  removeGuestCartLine,
  setGuestCartQuantity,
} from "@/features/cart/guest-cart";
import type { StoredCartLine } from "@/features/cart/schemas/cart";

const EMPTY: StoredCartLine[] = [];

let snapshot: StoredCartLine[] = EMPTY;
let initialised = false;

const listeners = new Set<() => void>();

function sameLines(left: readonly StoredCartLine[], right: readonly StoredCartLine[]) {
  return (
    left.length === right.length &&
    left.every((line, index) => {
      const other = right[index];

      return (
        other !== undefined &&
        line.productId === other.productId &&
        line.variantId === other.variantId &&
        line.quantity === other.quantity &&
        line.lastSeenUnitPrice === other.lastSeenUnitPrice
      );
    })
  );
}

function refresh() {
  const next = readGuestCart();

  if (!sameLines(next, snapshot)) {
    snapshot = next;
  }
}

function publish() {
  refresh();

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === GUEST_CART_KEY) {
      publish();
    }
  }

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): StoredCartLine[] {
  if (!initialised) {
    initialised = true;
    refresh();
  }

  return snapshot;
}

function getServerSnapshot(): StoredCartLine[] {
  return EMPTY;
}

export function useGuestCartLines() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useGuestCartCount() {
  return useGuestCartLines().reduce((total, line) => total + line.quantity, 0);
}

export function useGuestCart() {
  const lines = useGuestCartLines();

  const add = useCallback(
    (line: {
      lastSeenUnitPrice: number | null;
      productId: string;
      quantity: number;
      variantId: string;
    }) => {
      const result = addGuestCartLine(line);

      publish();

      return result.reason;
    },
    [],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setGuestCartQuantity(key, quantity);
    publish();
  }, []);

  const remove = useCallback((key: string) => {
    removeGuestCartLine(key);
    publish();
  }, []);

  const acknowledgePrices = useCallback((prices: ReadonlyMap<string, number>) => {
    acknowledgeGuestCartPrices(prices);
    publish();
  }, []);

  const clear = useCallback(() => {
    clearGuestCart();
    publish();
  }, []);

  return { acknowledgePrices, add, clear, lines, remove, setQuantity };
}
