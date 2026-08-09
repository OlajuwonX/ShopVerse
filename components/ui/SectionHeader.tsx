import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  eyebrow?: string;
  title: string;
};

export function SectionHeader({
  action,
  className,
  eyebrow,
  title,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)} {...props}>
      <div className="grid gap-1">
        {eyebrow ? (
          <p className="text-caption font-bold uppercase text-brand">{eyebrow}</p>
        ) : null}
        <h2 className="text-heading-3 font-bold text-text">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
