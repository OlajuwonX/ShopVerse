import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CART_MAX_LINE_QUANTITY,
  CART_MAX_LINES,
  GUEST_CART_KEY,
} from "@/constants/cart";
import {
  acknowledgeGuestCartPrices,
  addGuestCartLine,
  clearGuestCart,
  isGuestCartDegraded,
  parseGuestCart,
  readGuestCart,
  removeGuestCartLine,
  resetGuestCartStorage,
  setGuestCartQuantity,
} from "@/features/cart/guest-cart";
import {
  cartLineKey,
  normaliseStoredCart,
  toCartLineInputs,
} from "@/features/cart/schemas/cart";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const VARIANT_A1 = "a1111111-1111-4111-8111-111111111111";
const VARIANT_A2 = "a2222222-2222-4222-8222-222222222222";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const VARIANT_B1 = "b1111111-1111-4111-8111-111111111111";

function line(
  productId: string,
  variantId: string,
  quantity = 1,
  lastSeenUnitPrice: number | null = 1000,
) {
  return { lastSeenUnitPrice, productId, quantity, variantId };
}

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

describe("cart line identity", () => {
  it("keys a line by product and variant together", () => {
    expect(cartLineKey({ productId: PRODUCT_A, variantId: VARIANT_A1 })).not.toBe(
      cartLineKey({ productId: PRODUCT_A, variantId: VARIANT_A2 }),
    );
  });

  it("sends only intent to the server, never a price", () => {
    const inputs = toCartLineInputs([line(PRODUCT_A, VARIANT_A1, 2, 4500)]);

    expect(inputs).toStrictEqual([
      { productId: PRODUCT_A, quantity: 2, variantId: VARIANT_A1 },
    ]);
    expect(JSON.stringify(inputs)).not.toContain("4500");
    expect(JSON.stringify(inputs)).not.toContain("lastSeenUnitPrice");
  });
});

describe("normaliseStoredCart", () => {
  it("drops entries that fail the schema", () => {
    expect(
      normaliseStoredCart([
        line(PRODUCT_A, VARIANT_A1),
        { productId: "nope", quantity: 1, variantId: VARIANT_A1 },
        {
          lastSeenUnitPrice: null,
          productId: PRODUCT_B,
          quantity: 0,
          variantId: VARIANT_B1,
        },
        null,
      ]),
    ).toStrictEqual([line(PRODUCT_A, VARIANT_A1)]);
  });

  it("merges duplicate lines by summing within the per-line cap", () => {
    const merged = normaliseStoredCart([
      line(PRODUCT_A, VARIANT_A1, 15),
      line(PRODUCT_A, VARIANT_A1, 15),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(CART_MAX_LINE_QUANTITY);
  });

  it("keeps different variants of the same product apart", () => {
    expect(
      normaliseStoredCart([line(PRODUCT_A, VARIANT_A1), line(PRODUCT_A, VARIANT_A2)]),
    ).toHaveLength(2);
  });

  it("caps the number of lines", () => {
    const many = Array.from({ length: CART_MAX_LINES + 10 }, (_, index) =>
      line(uuidAt(index), uuidAt(index + 1000)),
    );

    expect(normaliseStoredCart(many)).toHaveLength(CART_MAX_LINES);
  });
});

describe("parseGuestCart", () => {
  it("returns nothing for absent storage", () => {
    expect(parseGuestCart(null)).toStrictEqual([]);
  });

  it("discards malformed JSON", () => {
    expect(parseGuestCart("{not json")).toStrictEqual([]);
  });

  it("discards a payload of the wrong shape or version", () => {
    expect(parseGuestCart(JSON.stringify([line(PRODUCT_A, VARIANT_A1)]))).toStrictEqual(
      [],
    );
    expect(
      parseGuestCart(
        JSON.stringify({ lines: [line(PRODUCT_A, VARIANT_A1)], version: 2 }),
      ),
    ).toStrictEqual([]);
  });

  it("discards a hand-edited quantity outside the allowed range", () => {
    const raw = JSON.stringify({
      lines: [line(PRODUCT_A, VARIANT_A1, 9999)],
      version: 1,
    });

    expect(parseGuestCart(raw)).toStrictEqual([]);
  });

  it("reads a valid payload", () => {
    const raw = JSON.stringify({ lines: [line(PRODUCT_A, VARIANT_A1, 2)], version: 1 });

    expect(parseGuestCart(raw)).toStrictEqual([line(PRODUCT_A, VARIANT_A1, 2)]);
  });
});

describe("guest cart storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetGuestCartStorage();
  });

  it("is empty before anything is added", () => {
    installLocalStorage();

    expect(readGuestCart()).toStrictEqual([]);
  });

  it("adds a line and reports it as added", () => {
    installLocalStorage();

    const result = addGuestCartLine(line(PRODUCT_A, VARIANT_A1));

    expect(result.reason).toBe("added");
    expect(readGuestCart()).toStrictEqual([line(PRODUCT_A, VARIANT_A1)]);
  });

  it("adding the same variant twice increases its quantity", () => {
    installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1, 2));
    const second = addGuestCartLine(line(PRODUCT_A, VARIANT_A1, 3));

    expect(second.reason).toBe("increased");
    expect(readGuestCart()[0]?.quantity).toBe(5);
  });

  it("refuses to exceed the per-line quantity cap", () => {
    installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1, CART_MAX_LINE_QUANTITY));
    const blocked = addGuestCartLine(line(PRODUCT_A, VARIANT_A1, 1));

    expect(blocked.reason).toBe("line_full");
    expect(readGuestCart()[0]?.quantity).toBe(CART_MAX_LINE_QUANTITY);
  });

  it("refuses to exceed the cart line cap", () => {
    installLocalStorage();

    for (let index = 0; index < CART_MAX_LINES; index += 1) {
      addGuestCartLine(line(uuidAt(index), uuidAt(index + 1000)));
    }

    const blocked = addGuestCartLine(line(PRODUCT_B, VARIANT_B1));

    expect(blocked.reason).toBe("cart_full");
    expect(readGuestCart()).toHaveLength(CART_MAX_LINES);
  });

  it("changes a quantity and removes a line at zero", () => {
    installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));
    const key = cartLineKey({ productId: PRODUCT_A, variantId: VARIANT_A1 });

    setGuestCartQuantity(key, 4);
    expect(readGuestCart()[0]?.quantity).toBe(4);

    setGuestCartQuantity(key, 0);
    expect(readGuestCart()).toStrictEqual([]);
  });

  it("clamps a quantity change to the per-line cap", () => {
    installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));
    setGuestCartQuantity(
      cartLineKey({ productId: PRODUCT_A, variantId: VARIANT_A1 }),
      999,
    );

    expect(readGuestCart()[0]?.quantity).toBe(CART_MAX_LINE_QUANTITY);
  });

  it("removes one line without touching the others", () => {
    installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));
    addGuestCartLine(line(PRODUCT_B, VARIANT_B1));

    removeGuestCartLine(cartLineKey({ productId: PRODUCT_A, variantId: VARIANT_A1 }));

    expect(readGuestCart()).toStrictEqual([line(PRODUCT_B, VARIANT_B1)]);
  });

  it("records an acknowledged price so the change is not reported twice", () => {
    installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1, 1, 1000));
    const key = cartLineKey({ productId: PRODUCT_A, variantId: VARIANT_A1 });

    acknowledgeGuestCartPrices(new Map([[key, 1500]]));

    expect(readGuestCart()[0]?.lastSeenUnitPrice).toBe(1500);
  });

  it("keeps additions made by another tab between reads", () => {
    const store = installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));

    store.set(
      GUEST_CART_KEY,
      JSON.stringify({
        lines: [line(PRODUCT_A, VARIANT_A1), line(PRODUCT_B, VARIANT_B1)],
        version: 1,
      }),
    );

    addGuestCartLine(line(PRODUCT_A, VARIANT_A2));

    expect(readGuestCart()).toHaveLength(3);
  });

  it("recovers from corrupt storage by starting empty", () => {
    const store = installLocalStorage();

    store.set(GUEST_CART_KEY, "{ not json");

    expect(readGuestCart()).toStrictEqual([]);

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));

    expect(readGuestCart()).toStrictEqual([line(PRODUCT_A, VARIANT_A1)]);
  });

  it("degrades to memory when localStorage rejects writes", () => {
    installLocalStorage({ failWrites: true });

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));

    expect(isGuestCartDegraded()).toBe(true);
    expect(readGuestCart()).toStrictEqual([line(PRODUCT_A, VARIANT_A1)]);

    addGuestCartLine(line(PRODUCT_B, VARIANT_B1));

    expect(readGuestCart()).toHaveLength(2);
  });

  it("survives localStorage being unavailable entirely", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("SecurityError");
      },
    });

    expect(readGuestCart()).toStrictEqual([]);

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));

    expect(isGuestCartDegraded()).toBe(true);
    expect(readGuestCart()).toStrictEqual([line(PRODUCT_A, VARIANT_A1)]);
  });

  it("clears everything", () => {
    installLocalStorage();

    addGuestCartLine(line(PRODUCT_A, VARIANT_A1));

    expect(clearGuestCart()).toStrictEqual([]);
    expect(readGuestCart()).toStrictEqual([]);
  });
});
