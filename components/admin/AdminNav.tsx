"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminNavGroups, type AdminNavItem } from "@/components/admin/navigation";
import type { Permission } from "@/constants/permissions";
import { cn } from "@/lib/cn";

type AdminNavProps = {
  adminRoot: string;
  onNavigate?: () => void;
  /** The signed-in actor's own permissions, used only to shape this menu. */
  permissions: readonly Permission[];
};

function isVisible(item: AdminNavItem, granted: ReadonlySet<Permission>) {
  return (
    item.permissions.length === 0 ||
    item.permissions.some((permission) => granted.has(permission))
  );
}

function hrefFor(adminRoot: string, item: AdminNavItem) {
  return item.segments.length === 0
    ? adminRoot
    : `${adminRoot}/${item.segments.join("/")}`;
}

export function AdminNav({ adminRoot, onNavigate, permissions }: AdminNavProps) {
  const pathname = usePathname();
  const granted = new Set(permissions);

  const groups = adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isVisible(item, granted)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Backoffice" className="grid gap-6">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-2">
          <h2 className="px-3 text-caption font-semibold tracking-wide text-text-subtle uppercase">
            {group.label}
          </h2>
          <ul className="grid gap-1">
            {group.items.map((item) => {
              const href = hrefFor(adminRoot, item);
              const isActive = pathname === href;
              const Icon = item.icon;

              if (!item.available) {
                return (
                  <li key={item.label}>
                    <span
                      aria-disabled="true"
                      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-body-sm text-text-subtle"
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-caption font-semibold text-text-muted">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.label}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      isActive
                        ? "bg-brand-soft text-brand-strong"
                        : "text-text hover:bg-surface-muted",
                    )}
                    href={href}
                    {...(onNavigate ? { onClick: onNavigate } : {})}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
