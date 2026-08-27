"use client";

import { Clock, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  SEARCH_QUERY_PARAM,
} from "@/constants/search";
import { useRecentSearches } from "@/features/search/useRecentSearches";
import { useSearchSuggestions } from "@/features/search/useSearchSuggestions";
import { cn } from "@/lib/cn";
import { categoryHref, productHref } from "@/lib/routes";

export { SEARCH_MAX_LENGTH, SEARCH_QUERY_PARAM } from "@/constants/search";

type SearchInputProps = {
  className?: string;
  defaultValue?: string;
  id?: string;
};

type Option = {
  href: string;
  kind: "brand" | "category" | "product" | "recent";
  label: string;
};

export function searchHref(term: string) {
  return `/search?${SEARCH_QUERY_PARAM}=${encodeURIComponent(term)}`;
}

export function SearchInput({
  className,
  defaultValue = "",
  id = "storefront-search",
}: SearchInputProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { recent, remember } = useRecentSearches();
  const { isError, isLoading, suggestions } = useSearchSuggestions(term);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  const trimmed = term.trim();
  const showRecent = trimmed.length < SEARCH_MIN_LENGTH && recent.length > 0;

  const options: Option[] = showRecent
    ? recent.map((entry) => ({
        href: searchHref(entry),
        kind: "recent" as const,
        label: entry,
      }))
    : [
        ...suggestions.products.map((product) => ({
          href: productHref(product.slug),
          kind: "product" as const,
          label: product.name,
        })),
        ...suggestions.categories.map((category) => ({
          href: categoryHref(category.slug),
          kind: "category" as const,
          label: category.name,
        })),
        ...suggestions.brands.map((brand) => ({
          href: searchHref(brand.name),
          kind: "brand" as const,
          label: brand.name,
        })),
      ];

  const hasPanel = isOpen && (showRecent || trimmed.length >= SEARCH_MIN_LENGTH);

  function submitTerm(value: string) {
    const next = value.trim();

    if (next.length === 0) {
      return;
    }

    remember(next);
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(searchHref(next));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const option = activeIndex >= 0 ? options[activeIndex] : undefined;

    if (option) {
      remember(showRecent ? option.label : trimmed);
      setIsOpen(false);
      router.push(option.href);

      return;
    }

    submitTerm(term);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);

      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    if (options.length === 0) {
      return;
    }

    event.preventDefault();
    setIsOpen(true);
    setActiveIndex((current) => {
      const next = current + (event.key === "ArrowDown" ? 1 : -1);

      if (next < 0) {
        return options.length - 1;
      }

      return next >= options.length ? 0 : next;
    });
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <form
        aria-label="Search ShopVerse"
        className="relative flex items-center"
        onSubmit={handleSubmit}
        role="search"
      >
        <label className="sr-only" htmlFor={id}>
          Search anything on ShopVerse
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 size-4 text-text-subtle"
        />
        <input
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={hasPanel ? listboxId : undefined}
          aria-expanded={hasPanel}
          autoComplete="off"
          className="min-h-11 w-full rounded-full border border-border bg-surface py-2 pr-16 pl-9 text-body-sm text-text transition-colors placeholder:text-text-subtle focus-visible:border-text focus-visible:outline-1.5  focus-visible:outline-text"
          enterKeyHint="search"
          id={id}
          maxLength={SEARCH_MAX_LENGTH}
          name={SEARCH_QUERY_PARAM}
          onChange={(event) => {
            setTerm(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search anything on ShopVerse"
          ref={inputRef}
          role="combobox"
          type="text"
          value={term}
        />
        {isLoading ? (
          <Loader2
            aria-hidden="true"
            className="absolute right-10 size-4 animate-spin text-text-subtle"
          />
        ) : null}
        {term.length > 0 ? (
          <button
            aria-label="Clear search"
            className="absolute right-1 inline-flex size-8 items-center justify-center rounded-full text-text-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            onClick={() => {
              setTerm("");
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </form>

      {hasPanel ? (
        <div className="absolute top-full right-0 left-0 z-dialog mt-2 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-overlay">
          <ul
            aria-label="Search suggestions"
            className="max-h-[60vh] overflow-y-auto py-1"
            id={listboxId}
            role="listbox"
          >
            {showRecent ? (
              <li
                className="px-3 py-1 text-caption font-semibold text-text-subtle"
                role="presentation"
              >
                Recent searches
              </li>
            ) : null}

            {options.map((option, index) => (
              <li
                aria-selected={index === activeIndex}
                className={cn(
                  "flex items-center gap-2 px-3",
                  index === activeIndex ? "bg-surface-muted" : null,
                )}
                id={`${listboxId}-option-${index}`}
                key={`${option.kind}-${option.href}`}
                role="option"
              >
                {option.kind === "recent" ? (
                  <Clock
                    aria-hidden="true"
                    className="size-3 shrink-0 text-text-subtle"
                  />
                ) : null}

                <Link
                  className="flex min-h-11 flex-1 items-center justify-between gap-3 text-body-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  href={option.href}
                  onClick={() => {
                    remember(showRecent ? option.label : trimmed);
                    setIsOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {option.kind === "category" || option.kind === "brand" ? (
                    <span className="shrink-0 text-caption text-text-subtle capitalize">
                      {option.kind}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}

            {!showRecent && options.length === 0 && !isLoading ? (
              <li
                className="px-3 py-3 text-body-sm text-text-muted"
                role="presentation"
              >
                {isError
                  ? "Search is unavailable right now."
                  : `No matches for ${trimmed}.`}
              </li>
            ) : null}

            {!showRecent && trimmed.length >= SEARCH_MIN_LENGTH ? (
              <li className="border-t border-border" role="presentation">
                <button
                  className="flex min-h-11 w-full items-center px-3 text-body-sm font-semibold text-brand hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => {
                    submitTerm(term);
                  }}
                  type="button"
                >
                  See all results for {trimmed}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
