import Link from "next/link";
import type { ReactNode } from "react";

import { ProductRailSkeleton } from "@/components/commerce/ProductRail";
import { Skeleton } from "@/components/ui/Skeleton";

type SectionShellProps = {
  children: ReactNode;
  title: string;
  viewMoreHref?: string | null;
};

export function SectionShell({ children, title, viewMoreHref }: SectionShellProps) {
  return (
    <section className="grid gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-heading-3 font-bold text-text">{title}</h2>
        {viewMoreHref ? (
          <Link
            className="shrink-0 text-body-sm font-semibold text-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            href={viewMoreHref}
          >
            View more
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SectionSkeleton() {
  return (
    <section className="grid gap-4">
      <Skeleton className="h-7 w-48" />
      <ProductRailSkeleton />
      <span className="sr-only" role="status">
        Loading section
      </span>
    </section>
  );
}
