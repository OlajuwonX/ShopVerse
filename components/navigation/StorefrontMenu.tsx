"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import {
  accountNavItems,
  supportNavItems,
  type StorefrontNavItem,
} from "@/components/navigation/storefront-navigation";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function MenuSection({
  items,
  onNavigate,
  title,
}: {
  items: readonly StorefrontNavItem[];
  onNavigate: () => void;
  title: string;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="text-caption font-semibold tracking-wide text-text-subtle uppercase">
        {title}
      </h3>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item.href}>
            {item.available ? (
              <Link
                className="flex min-h-11 items-center rounded-md px-3 text-body-sm font-medium text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                href={item.href}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="flex min-h-11 items-center gap-2 rounded-md px-3 text-body-sm text-text-subtle"
              >
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-caption font-semibold text-text-muted">
                  Soon
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StorefrontMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = "hidden";

    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        event.preventDefault();

        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();

        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  return (
    <>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="inline-flex size-11 items-center justify-center rounded-md border border-transparent text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:hidden"
        onClick={() => {
          setIsOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
        <span className="sr-only">Open menu</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-drawer flex md:hidden">
          <button
            aria-hidden="true"
            className="absolute inset-0 bg-surface-inverse/40"
            onClick={close}
            tabIndex={-1}
            type="button"
          />

          <div
            aria-label="Account and support"
            aria-modal="true"
            className="relative flex h-full w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto border-r border-border bg-surface-raised p-4 shadow-overlay"
            id={panelId}
            ref={panelRef}
            role="dialog"
          >
            <div className="flex items-center justify-between">
              <span className="text-label font-semibold text-text">Menu</span>
              <button
                className="inline-flex size-11 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={close}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>

            <MenuSection items={accountNavItems} onNavigate={close} title="Account" />
            <MenuSection items={supportNavItems} onNavigate={close} title="Support" />

            <p className="mt-auto text-caption text-text-subtle">
              Shopping, categories and offers stay in the main navigation — this menu is
              for account and support only.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
