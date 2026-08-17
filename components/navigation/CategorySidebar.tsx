import Link from "next/link";

import { activeBranchIds } from "@/features/categories/navigation";
import { cn } from "@/lib/cn";
import { categoryHref } from "@/lib/routes";
import type { CategoryNode } from "@/server/services/categories";

type CategoryBranchProps = {
  activeIds: ReadonlySet<string>;
  activeSlug: string | null;
  node: CategoryNode;
};

function CategoryBranch({ activeIds, activeSlug, node }: CategoryBranchProps) {
  const isOnActiveBranch = activeIds.has(node.id);
  const isCurrent = node.slug === activeSlug;
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <Link
        aria-current={isCurrent ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center rounded-md px-3 text-body-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          isCurrent
            ? "bg-brand-soft font-semibold text-brand-strong"
            : "text-text hover:bg-surface-muted",
          isOnActiveBranch && !isCurrent ? "font-semibold" : null,
        )}
        href={categoryHref(node.slug)}
      >
        {node.name}
      </Link>

      {hasChildren && isOnActiveBranch ? (
        <ul className="mt-1 ml-3 grid gap-1 border-l border-border pl-2">
          {node.children.map((child) => (
            <CategoryBranch
              activeIds={activeIds}
              activeSlug={activeSlug}
              key={child.id}
              node={child}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type CategorySidebarProps = {
  activeSlug: string | null;
  tree: readonly CategoryNode[];
};

export function CategorySidebar({ activeSlug, tree }: CategorySidebarProps) {
  const activeIds = activeSlug ? activeBranchIds(tree, activeSlug) : new Set<string>();

  return (
    <nav aria-label="Categories" className="grid gap-2">
      <h2 className="px-3 text-caption font-semibold tracking-wide text-text-subtle uppercase">
        Category
      </h2>
      <ul className="grid gap-1">
        {tree.map((node) => (
          <CategoryBranch
            activeIds={activeIds}
            activeSlug={activeSlug}
            key={node.id}
            node={node}
          />
        ))}
      </ul>
    </nav>
  );
}
