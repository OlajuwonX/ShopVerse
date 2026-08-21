"use client";

import { useCallback, useSyncExternalStore } from "react";

import { RECENT_SEARCHES_KEY } from "@/constants/search";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from "@/features/search/recent-searches";

const EMPTY: string[] = [];

let snapshot: string[] = EMPTY;
let snapshotSource: string | null = null;
let initialised = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === RECENT_SEARCHES_KEY) {
      emit();
    }
  }

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string[] {
  const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);

  if (!initialised || raw !== snapshotSource) {
    initialised = true;
    snapshotSource = raw;
    snapshot = readRecentSearches();
  }

  return snapshot;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

export function useRecentSearches() {
  const recent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const remember = useCallback((term: string) => {
    rememberSearch(term);
    emit();
  }, []);

  const clear = useCallback(() => {
    clearRecentSearches();
    emit();
  }, []);

  return { clear, recent, remember };
}
