import { MAX_RECENT_SEARCHES, RECENT_SEARCHES_KEY } from "@/constants/search";

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function rememberSearch(term: string): string[] {
  const normalised = term.trim().replace(/\s+/g, " ");

  if (typeof window === "undefined" || normalised.length === 0) {
    return readRecentSearches();
  }

  const existing = readRecentSearches().filter(
    (entry) => entry.toLowerCase() !== normalised.toLowerCase(),
  );

  const next = [normalised, ...existing].slice(0, MAX_RECENT_SEARCHES);

  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    return existing;
  }

  return next;
}

export function clearRecentSearches() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    return;
  }
}
