"use client";

import type { ReactNode } from "react";

import { useDirectionalHeader } from "@/hooks/useDirectionalHeader";

type DirectionalHeaderProps = {
  children: ReactNode;
};

export function DirectionalHeader({ children }: DirectionalHeaderProps) {
  const { reveal, state } = useDirectionalHeader();

  return (
    <header
      className="group sticky top-0 z-header border-b border-border bg-surface-raised transition-transform duration-200 ease-standard data-[state=hidden]:-translate-y-full"
      data-state={state}
      onFocusCapture={reveal}
    >
      {children}
    </header>
  );
}
