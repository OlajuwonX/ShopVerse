import Link from "next/link";

import { resolveCategoryRail } from "@/features/categories/navigation";
import { cn } from "@/lib/cn";
import { categoryHref } from "@/lib/routes";
import type { CategoryNode } from "@/server/services/categories";

const CHIP_CLASS =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-body-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

type CategoryRailProps = {
  activeSlug: string | null;
  className?: string;
  tree: readonly CategoryNode[];
};

export function CategoryRail({ activeSlug, className, tree }: CategoryRailProps) {
  const { parent, siblings } = resolveCategoryRail(tree, activeSlug);

  return (
    <nav
      aria-label="Browse categories"
      className={cn("-mx-(--page-gutter) px-(--page-gutter)", className)}
    >
      <ul className="flex snap-x gap-2 overflow-x-auto pb-2">
        <li className="snap-start">
          <Link
            className={cn(
              CHIP_CLASS,
              activeSlug === null
                ? "border-brand bg-brand-soft text-brand-strong"
                : "border-border bg-surface-raised text-text hover:border-border-strong hover:bg-surface-muted",
            )}
            href="/"
          >
            All
          </Link>
        </li>

        {parent ? (
          <li className="snap-start">
            <Link
              className={cn(
                CHIP_CLASS,
                "border-border bg-surface-raised text-text hover:border-border-strong hover:bg-surface-muted",
              )}
              href={categoryHref(parent.slug)}
            >
              ← {parent.name}
            </Link>
          </li>
        ) : null}

        {siblings.map((node) => {
          const isCurrent = node.slug === activeSlug;

          return (
            <li className="snap-start" key={node.id}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  CHIP_CLASS,
                  isCurrent
                    ? "border-brand bg-brand-soft text-brand-strong"
                    : "border-border bg-surface-raised text-text hover:border-border-strong hover:bg-surface-muted",
                )}
                href={categoryHref(node.slug)}
              >
                {node.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
