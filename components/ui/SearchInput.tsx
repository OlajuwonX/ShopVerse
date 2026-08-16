import { Search } from "lucide-react";

import { cn } from "@/lib/cn";

export const SEARCH_QUERY_PARAM = "q";
export const SEARCH_MAX_LENGTH = 120;

type SearchInputProps = {
  className?: string;
  defaultValue?: string;
  id?: string;
};

export function SearchInput({
  className,
  defaultValue,
  id = "storefront-search",
}: SearchInputProps) {
  return (
    <form
      action="/search"
      aria-label="Search ShopVerse"
      className={cn("relative flex items-center", className)}
      method="get"
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
        autoComplete="off"
        className="min-h-11 w-full rounded-full border border-border bg-surface py-2 pr-24 pl-9 text-body-sm text-text transition-colors placeholder:text-text-subtle focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        defaultValue={defaultValue}
        enterKeyHint="search"
        id={id}
        maxLength={SEARCH_MAX_LENGTH}
        name={SEARCH_QUERY_PARAM}
        placeholder="Search anything on ShopVerse"
        type="search"
      />

      <button
        className="absolute right-1 inline-flex min-h-9 items-center rounded-full bg-brand px-4 text-label font-semibold text-white transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
