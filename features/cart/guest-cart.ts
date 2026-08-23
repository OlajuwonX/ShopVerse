import {
  CART_MAX_LINE_QUANTITY,
  CART_MAX_LINES,
  GUEST_CART_KEY,
} from "@/constants/cart";
import {
  cartLineKey,
  normaliseStoredCart,
  storedCartSchema,
  type StoredCartLine,
} from "@/features/cart/schemas/cart";

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
  try {
    const store = window.localStorage;

    return {
      read: () => store.getItem(GUEST_CART_KEY),
      write: (value) => {
        store.setItem(GUEST_CART_KEY, value);
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

export function isGuestCartDegraded() {
  return degraded;
}

export function resetGuestCartStorage() {
  degraded = false;
  memoryValue = null;
}

export function parseGuestCart(raw: string | null): StoredCartLine[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = storedCartSchema.safeParse(JSON.parse(raw));

    if (parsed.success) {
      return normaliseStoredCart(parsed.data.lines);
    }
  } catch {
    return [];
  }

  return [];
}

export function readGuestCart(): StoredCartLine[] {
  const storage = resolveStorage();

  if (!storage) {
    return [];
  }

  try {
    return parseGuestCart(storage.read());
  } catch {
    return [];
  }
}

function persist(lines: readonly StoredCartLine[]): StoredCartLine[] {
  const next = normaliseStoredCart(lines);
  const storage = resolveStorage();
  const payload = JSON.stringify({ lines: next, version: 1 });

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

export type AddCartLineResult = {
  lines: StoredCartLine[];
  reason: "added" | "increased" | "cart_full" | "line_full";
};

export function addGuestCartLine(line: {
  lastSeenUnitPrice: number | null;
  productId: string;
  quantity: number;
  variantId: string;
}): AddCartLineResult {
  const current = readGuestCart();
  const key = cartLineKey(line);
  const existing = current.find((entry) => cartLineKey(entry) === key);

  if (existing) {
    if (existing.quantity >= CART_MAX_LINE_QUANTITY) {
      return { lines: current, reason: "line_full" };
    }

    return {
      lines: persist(
        current.map((entry) =>
          cartLineKey(entry) === key
            ? {
                ...entry,
                lastSeenUnitPrice: line.lastSeenUnitPrice,
                quantity: Math.min(
                  entry.quantity + line.quantity,
                  CART_MAX_LINE_QUANTITY,
                ),
              }
            : entry,
        ),
      ),
      reason: "increased",
    };
  }

  if (current.length >= CART_MAX_LINES) {
    return { lines: current, reason: "cart_full" };
  }

  return { lines: persist([...current, { ...line }]), reason: "added" };
}

export function setGuestCartQuantity(key: string, quantity: number): StoredCartLine[] {
  const current = readGuestCart();

  if (quantity <= 0) {
    return persist(current.filter((entry) => cartLineKey(entry) !== key));
  }

  return persist(
    current.map((entry) =>
      cartLineKey(entry) === key
        ? { ...entry, quantity: Math.min(quantity, CART_MAX_LINE_QUANTITY) }
        : entry,
    ),
  );
}

export function removeGuestCartLine(key: string): StoredCartLine[] {
  return setGuestCartQuantity(key, 0);
}

export function acknowledgeGuestCartPrices(
  prices: ReadonlyMap<string, number>,
): StoredCartLine[] {
  const current = readGuestCart();

  return persist(
    current.map((entry) => {
      const price = prices.get(cartLineKey(entry));

      return price === undefined ? entry : { ...entry, lastSeenUnitPrice: price };
    }),
  );
}

export function clearGuestCart(): StoredCartLine[] {
  return persist([]);
}
