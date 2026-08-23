import type { ReactNode } from "react";

import { CategorySidebar } from "@/components/navigation/CategorySidebar";
import { discoveryNavItems } from "@/components/navigation/storefront-navigation";
import type { CategoryNode } from "@/server/services/categories";

type StorefrontSidebarProps = {
  activeSlug?: string | null;
  children?: ReactNode;
  tree: readonly CategoryNode[];
};

function DiscoveryNav() {
  return (
    <nav aria-label="Discover" className="grid gap-2">
      <h2 className="px-3 text-caption font-semibold tracking-wide text-text-subtle uppercase">
        Discover
      </h2>
      <ul className="grid gap-1">
        {discoveryNavItems.map((item) => (
          <li key={item.href}>
            <span
              aria-disabled="true"
              className="flex min-h-11 items-center justify-between rounded-md px-3 text-body-sm text-text-subtle"
            >
              {item.label}
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-caption font-semibold text-text-muted">
                Soon
              </span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StorefrontSidebar({
  activeSlug = null,
  children,
  tree,
}: StorefrontSidebarProps) {
  return (
    <div className="grid gap-6">
      <DiscoveryNav />
      <CategorySidebar activeSlug={activeSlug} tree={tree} />
      {children}
    </div>
  );
}
