import Link from "next/link";

import { discoveryNavItems } from "@/components/navigation/storefront-navigation";
import { cn } from "@/lib/cn";

type PrimaryNavProps = {
  className?: string;
};

export function PrimaryNav({ className }: PrimaryNavProps) {
  return (
    <nav aria-label="Product discovery" className={cn("w-full", className)}>
      <ul className="flex snap-x snap-mandatory items-center gap-1 overflow-x-auto py-1">
        {discoveryNavItems.map((item) => (
          <li className="snap-start" key={item.href}>
            {item.available ? (
              <Link
                className="inline-flex min-h-11 items-center rounded-md px-3 text-body-sm font-semibold whitespace-nowrap text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                href={item.href}
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-body-sm font-semibold whitespace-nowrap text-text-subtle"
              >
                {item.label}
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-caption font-semibold text-text-muted">
                  Soon
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
