import { beforeEach, describe, expect, it, vi } from "vitest";

import { GUEST_WISHLIST_KEY, WISHLIST_MAX_ITEMS } from "@/constants/wishlist";
import {
  clearGuestWishlist,
  isGuestWishlistDegraded,
  parseGuestWishlist,
  readGuestWishlist,
  resetGuestWishlistStorage,
  setGuestWishlistItem,
} from "@/features/wishlist/guest-wishlist";
import { normaliseWishlistIds } from "@/features/wishlist/schemas/wishlist";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_C = "33333333-3333-4333-8333-333333333333";

function uuidAt(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

function installLocalStorage(options: { failWrites?: boolean } = {}) {
  const store = new Map<string, string>();

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => {
        if (options.failWrites) {
          throw new Error("QuotaExceededError");
        }

        store.set(key, value);
      },
    },
  });

  return store;
}

describe("normaliseWishlistIds", () => {
  it("drops non-uuid entries and duplicates while keeping order", () => {
    expect(
      normaliseWishlistIds([PRODUCT_B, "not-a-uuid", PRODUCT_A, PRODUCT_B, 42, null]),
    ).toStrictEqual([PRODUCT_B, PRODUCT_A]);
  });

  it("caps the list at the maximum size", () => {
    const ids = Array.from({ length: WISHLIST_MAX_ITEMS + 20 }, (_, index) =>
      uuidAt(index),
    );

    expect(normaliseWishlistIds(ids)).toHaveLength(WISHLIST_MAX_ITEMS);
  });
});

describe("parseGuestWishlist", () => {
  it("returns nothing for absent storage", () => {
    expect(parseGuestWishlist(null)).toStrictEqual([]);
  });

  it("discards malformed JSON", () => {
    expect(parseGuestWishlist("{not json")).toStrictEqual([]);
  });

  it("discards a payload without the expected shape", () => {
    expect(parseGuestWishlist(JSON.stringify([PRODUCT_A]))).toStrictEqual([]);
    expect(
      parseGuestWishlist(JSON.stringify({ items: [PRODUCT_A], version: 9 })),
    ).toStrictEqual([]);
  });

  it("discards a payload that stores product objects rather than identifiers", () => {
    const raw = JSON.stringify({
      items: [{ id: PRODUCT_A, name: "Leaked product", price: 1 }],
      version: 1,
    });

    expect(parseGuestWishlist(raw)).toStrictEqual([]);
  });

  it("reads a valid payload", () => {
    const raw = JSON.stringify({ items: [PRODUCT_A, PRODUCT_B], version: 1 });

    expect(parseGuestWishlist(raw)).toStrictEqual([PRODUCT_A, PRODUCT_B]);
  });
});

describe("guest wishlist storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetGuestWishlistStorage();
  });

  it("is empty before anything is saved", () => {
    installLocalStorage();

    expect(readGuestWishlist()).toStrictEqual([]);
  });

  it("stores identifiers only", () => {
    const store = installLocalStorage();

    setGuestWishlistItem(PRODUCT_A, true);

    expect(JSON.parse(store.get(GUEST_WISHLIST_KEY) ?? "null")).toStrictEqual({
      items: [PRODUCT_A],
      version: 1,
    });
  });

  it("puts the most recently saved product first", () => {
    installLocalStorage();

    setGuestWishlistItem(PRODUCT_A, true);
    setGuestWishlistItem(PRODUCT_B, true);

    expect(readGuestWishlist()).toStrictEqual([PRODUCT_B, PRODUCT_A]);
  });

  it("saving the same product twice does not duplicate it", () => {
    installLocalStorage();

    setGuestWishlistItem(PRODUCT_A, true);
    setGuestWishlistItem(PRODUCT_A, true);

    expect(readGuestWishlist()).toStrictEqual([PRODUCT_A]);
  });

  it("removes a product without touching the rest", () => {
    installLocalStorage();

    setGuestWishlistItem(PRODUCT_A, true);
    setGuestWishlistItem(PRODUCT_B, true);
    setGuestWishlistItem(PRODUCT_A, false);

    expect(readGuestWishlist()).toStrictEqual([PRODUCT_B]);
  });

  it("keeps additions made by another tab between reads", () => {
    const store = installLocalStorage();

    setGuestWishlistItem(PRODUCT_A, true);

    store.set(
      GUEST_WISHLIST_KEY,
      JSON.stringify({ items: [PRODUCT_C, PRODUCT_A], version: 1 }),
    );

    setGuestWishlistItem(PRODUCT_B, true);

    expect(readGuestWishlist()).toStrictEqual([PRODUCT_B, PRODUCT_C, PRODUCT_A]);
  });

  it("recovers from corrupt storage by starting empty", () => {
    const store = installLocalStorage();

    store.set(GUEST_WISHLIST_KEY, "�not json");

    expect(readGuestWishlist()).toStrictEqual([]);

    setGuestWishlistItem(PRODUCT_A, true);

    expect(readGuestWishlist()).toStrictEqual([PRODUCT_A]);
  });

  it("caps the saved list", () => {
    installLocalStorage();

    for (let index = 0; index < WISHLIST_MAX_ITEMS + 5; index += 1) {
      setGuestWishlistItem(uuidAt(index), true);
    }

    const saved = readGuestWishlist();

    expect(saved).toHaveLength(WISHLIST_MAX_ITEMS);
    expect(saved[0]).toBe(uuidAt(WISHLIST_MAX_ITEMS + 4));
  });

  it("degrades to memory when localStorage rejects writes", () => {
    installLocalStorage({ failWrites: true });

    setGuestWishlistItem(PRODUCT_A, true);

    expect(isGuestWishlistDegraded()).toBe(true);
    expect(readGuestWishlist()).toStrictEqual([PRODUCT_A]);

    setGuestWishlistItem(PRODUCT_B, true);

    expect(readGuestWishlist()).toStrictEqual([PRODUCT_B, PRODUCT_A]);
  });

  it("survives localStorage being unavailable entirely", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("SecurityError");
      },
    });

    expect(readGuestWishlist()).toStrictEqual([]);
    expect(setGuestWishlistItem(PRODUCT_A, true)).toStrictEqual([PRODUCT_A]);
    expect(isGuestWishlistDegraded()).toBe(true);
    expect(readGuestWishlist()).toStrictEqual([PRODUCT_A]);
  });

  it("clears everything", () => {
    installLocalStorage();

    setGuestWishlistItem(PRODUCT_A, true);

    expect(clearGuestWishlist()).toStrictEqual([]);
    expect(readGuestWishlist()).toStrictEqual([]);
  });
});
