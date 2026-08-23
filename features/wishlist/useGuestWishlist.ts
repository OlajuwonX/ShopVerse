"use client";

import { useCallback, useSyncExternalStore } from "react";

import { GUEST_WISHLIST_KEY } from "@/constants/wishlist";
import {
  readGuestWishlist,
  setGuestWishlistItem,
} from "@/features/wishlist/guest-wishlist";

const EMPTY: string[] = [];

let snapshot: string[] = EMPTY;
let initialised = false;

const listeners = new Set<() => void>();

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function refresh() {
  const next = readGuestWishlist();

  if (!sameIds(next, snapshot)) {
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
    if (event.key === null || event.key === GUEST_WISHLIST_KEY) {
      publish();
    }
  }

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string[] {
  if (!initialised) {
    initialised = true;
    refresh();
  }

  return snapshot;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

export function setSavedProduct(productId: string, saved: boolean) {
  setGuestWishlistItem(productId, saved);
  publish();
}

export function useGuestWishlistIds() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useGuestWishlistCount() {
  return useGuestWishlistIds().length;
}

export function useWishlistItem(productId: string) {
  const ids = useGuestWishlistIds();
  const isSaved = ids.includes(productId);

  const toggle = useCallback(() => {
    const next = !readGuestWishlist().includes(productId);

    setSavedProduct(productId, next);

    return next;
  }, [productId]);

  return { isSaved, toggle };
}
