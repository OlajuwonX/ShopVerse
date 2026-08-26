"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  CatalogueFilters,
  type FilterFacets,
} from "@/components/filters/CatalogueFilters";
import { activeFilterCount } from "@/features/filters/catalogue-url";
import { useCatalogueFilters } from "@/features/filters/useCatalogueFilters";

export function FilterSheet({ facets }: { facets: FilterFacets }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { filters } = useCatalogueFilters();
  const count = activeFilterCount(filters);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    if (scrollbar > 0) {
      document.body.style.paddingRight = `${scrollbar}px`;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface-raised px-4 text-label font-semibold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={() => {
          setIsOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Filters
        {count > 0 ? (
          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-caption font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-drawer flex items-end">
          <button
            aria-hidden="true"
            className="absolute inset-0 bg-surface-inverse/40"
            onClick={() => {
              setIsOpen(false);
            }}
            tabIndex={-1}
            type="button"
          />

          <div
            aria-label="Filters"
            aria-modal="true"
            className="relative flex max-h-[85vh] w-full flex-col rounded-t-lg border-t border-border bg-surface-raised shadow-overlay"
            id={panelId}
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-label font-semibold text-text">Filters</h2>
              <button
                className="inline-flex size-11 items-center justify-center rounded-md text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                ref={closeRef}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">Close filters</span>
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4">
              <CatalogueFilters facets={facets} />
            </div>

            <div className="border-t border-border px-4 py-3">
              <button
                className="min-h-11 w-full rounded-md bg-surface-inverse px-4 text-label font-semibold text-surface hover:bg-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                type="button"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
