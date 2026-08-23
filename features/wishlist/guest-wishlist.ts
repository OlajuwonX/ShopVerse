import { GUEST_WISHLIST_KEY, WISHLIST_MAX_ITEMS } from "@/constants/wishlist";
import {
  normaliseWishlistIds,
  storedWishlistSchema,
} from "@/features/wishlist/schemas/wishlist";

type Storage = {
  read: () => string | null;
  write: (value: string) => void;
};

let memoryValue: string | null = null;
let degraded = false;

const memoryStorage: Storage = {
  read: () => memoryValue,
  write: (value) => {
    memoryValue = value;
  },
};

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const store = window.localStorage;

    return {
      read: () => store.getItem(GUEST_WISHLIST_KEY),
      write: (value) => {
        store.setItem(GUEST_WISHLIST_KEY, value);
      },
    };
  } catch {
    return null;
  }
}

function degrade(seed: string | null) {
  degraded = true;

  if (seed !== null) {
    memoryValue = seed;
  }
}

function resolveStorage(): Storage | null {
  if (degraded) {
    return memoryStorage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const storage = browserStorage();

  if (storage) {
    return storage;
  }

  degrade(null);

  return memoryStorage;
}

export function isGuestWishlistDegraded() {
  return degraded;
}

export function resetGuestWishlistStorage() {
  degraded = false;
  memoryValue = null;
}

export function parseGuestWishlist(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = storedWishlistSchema.safeParse(JSON.parse(raw));

    if (parsed.success) {
      return normaliseWishlistIds(parsed.data.items);
    }
  } catch {
    return [];
  }

  return [];
}

export function readGuestWishlist(): string[] {
  const storage = resolveStorage();

  if (!storage) {
    return [];
  }

  try {
    return parseGuestWishlist(storage.read());
  } catch {
    return [];
  }
}

function serialise(items: readonly string[]) {
  return JSON.stringify({ items, version: 1 });
}

function persist(items: readonly string[]): string[] {
  const next = normaliseWishlistIds(items);
  const storage = resolveStorage();
  const payload = serialise(next);

  if (!storage) {
    return next;
  }

  try {
    storage.write(payload);
  } catch {
    degrade(payload);
  }

  return next;
}

export function setGuestWishlistItem(productId: string, saved: boolean): string[] {
  const current = readGuestWishlist();
  const without = current.filter((entry) => entry !== productId);

  if (!saved) {
    return persist(without);
  }

  return persist([productId, ...without].slice(0, WISHLIST_MAX_ITEMS));
}

export function clearGuestWishlist(): string[] {
  return persist([]);
}
