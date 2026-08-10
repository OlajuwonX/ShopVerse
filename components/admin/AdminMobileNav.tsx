"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { AdminNav } from "@/components/admin/AdminNav";
import type { Permission } from "@/constants/permissions";

type AdminMobileNavProps = {
  adminRoot: string;
  permissions: readonly Permission[];
};

export function AdminMobileNav({ adminRoot, permissions }: AdminMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-surface-raised text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={() => {
          setIsOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
        <span className="sr-only">Open backoffice menu</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-drawer flex">
          <button
            aria-label="Close backoffice menu"
            className="absolute inset-0 bg-surface-inverse/40"
            onClick={() => {
              setIsOpen(false);
            }}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label="Backoffice menu"
            className="relative flex h-full w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto border-r border-border bg-surface-raised p-4 shadow-overlay"
            id={panelId}
            role="dialog"
          >
            <div className="flex items-center justify-between">
              <span className="text-label font-semibold text-text">Navigation</span>
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">Close backoffice menu</span>
              </button>
            </div>
            <AdminNav
              adminRoot={adminRoot}
              onNavigate={() => {
                setIsOpen(false);
              }}
              permissions={permissions}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
