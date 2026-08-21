import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_RECENT_SEARCHES, RECENT_SEARCHES_KEY } from "@/constants/search";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from "@/features/search/recent-searches";
import {
  buildCatalogueSearchParams,
  EMPTY_FILTER_STATE,
  parseCatalogueFilters,
} from "@/features/filters/catalogue-url";
import { normaliseSearchTerm } from "@/server/services/search";

function installLocalStorage() {
  const store = new Map<string, string>();

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });

  return store;
}

describe("normaliseSearchTerm", () => {
  it("trims and collapses whitespace", () => {
    expect(normaliseSearchTerm("  office   chair  ")).toBe("office chair");
  });

  it("leaves an already clean term untouched", () => {
    expect(normaliseSearchTerm("galaxy")).toBe("galaxy");
  });
});

describe("recent searches", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns nothing before anything is stored", () => {
    installLocalStorage();

    expect(readRecentSearches()).toStrictEqual([]);
  });

  it("stores the newest term first", () => {
    installLocalStorage();

    rememberSearch("chair");
    const result = rememberSearch("desk");

    expect(result).toStrictEqual(["desk", "chair"]);
  });

  it("de-duplicates case-insensitively and promotes the repeat", () => {
    installLocalStorage();

    rememberSearch("Chair");
    rememberSearch("desk");
    const result = rememberSearch("chair");

    expect(result).toStrictEqual(["chair", "desk"]);
  });

  it("caps the stored history", () => {
    installLocalStorage();

    for (let index = 0; index < MAX_RECENT_SEARCHES + 5; index += 1) {
      rememberSearch(`term-${index}`);
    }

    expect(readRecentSearches().length).toBe(MAX_RECENT_SEARCHES);
  });

  it("ignores blank terms", () => {
    installLocalStorage();

    rememberSearch("   ");

    expect(readRecentSearches()).toStrictEqual([]);
  });

  it("survives corrupt storage without throwing", () => {
    const store = installLocalStorage();
    store.set(RECENT_SEARCHES_KEY, "{not json");

    expect(readRecentSearches()).toStrictEqual([]);
  });

  it("discards non-string entries", () => {
    const store = installLocalStorage();
    store.set(RECENT_SEARCHES_KEY, JSON.stringify(["ok", 42, null, { a: 1 }]));

    expect(readRecentSearches()).toStrictEqual(["ok"]);
  });

  it("clears history", () => {
    installLocalStorage();

    rememberSearch("chair");
    clearRecentSearches();

    expect(readRecentSearches()).toStrictEqual([]);
  });
});

describe("search term in filter URL state (SRCH-12)", () => {
  function parse(query: string) {
    return parseCatalogueFilters(new URLSearchParams(query));
  }

  it("reads the search term from the url", () => {
    expect(parse("q=office+chair").query).toBe("office chair");
  });

  it("treats a blank term as absent", () => {
    expect(parse("q=").query).toBeNull();
    expect(parse("q=%20%20").query).toBeNull();
  });

  it("caps an overlong term", () => {
    expect(parse(`q=${"a".repeat(500)}`).query?.length).toBeLessThanOrEqual(120);
  });

  it("preserves the term when filters change", () => {
    const filters = parse("q=chair&onSale=1");
    const rebuilt = buildCatalogueSearchParams({ ...filters, minRating: 4 });

    expect(rebuilt.get("q")).toBe("chair");
    expect(rebuilt.get("rating")).toBe("4");
    expect(rebuilt.get("onSale")).toBe("1");
  });

  it("round-trips a search plus filters", () => {
    const original = {
      ...EMPTY_FILTER_STATE,
      inStockOnly: true,
      minRating: 4,
      query: "office chair",
      sort: "price_asc" as const,
    };

    expect(parseCatalogueFilters(buildCatalogueSearchParams(original))).toStrictEqual(
      original,
    );
  });

  it("omits q entirely when there is no term", () => {
    expect(buildCatalogueSearchParams(EMPTY_FILTER_STATE).has("q")).toBe(false);
  });
});
