import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CategorySidebar } from "@/components/navigation/CategorySidebar";
import { discoveryNavItems } from "@/components/navigation/storefront-navigation";
import shopverseMark from "@/public/logo/shopverse-mark.webp";
import type { CategoryNode } from "@/server/services/categories";

type StorefrontSidebarProps = {
  activeSlug?: string | null;
  children?: ReactNode;
  tree: readonly CategoryNode[];
};

function SidebarBrand() {
  return (
    <Link
      className="flex items-center gap-2 rounded-md px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      href="/"
    >
      <Image
        alt=""
        className="size-8 shrink-0"
        height={32}
        priority
        src={shopverseMark}
        width={32}
      />
      <span className="text-heading-3 font-bold tracking-tight text-text">
        ShopVerse
      </span>
    </Link>
  );
}

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
      <SidebarBrand />
      <DiscoveryNav />
      <CategorySidebar activeSlug={activeSlug} tree={tree} />
      {children}
    </div>
  );
}
