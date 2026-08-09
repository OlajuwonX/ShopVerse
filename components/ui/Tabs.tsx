import Link from "next/link";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type TabItem = {
  href: string;
  label: string;
  selected?: boolean;
};

type TabsProps = HTMLAttributes<HTMLElement> & {
  items: TabItem[];
  label: string;
};

export function Tabs({ className, items, label, ...props }: TabsProps) {
  return (
    <nav aria-label={label} className={cn("overflow-x-auto", className)} {...props}>
      <div className="flex min-h-11 w-max gap-2 border-b border-border">
        {items.map((item) => (
          <Link
            aria-current={item.selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center border-b-2 px-3 text-label font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              item.selected
                ? "border-brand text-brand-strong"
                : "border-transparent text-text-muted hover:text-text",
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
