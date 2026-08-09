import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({
  action,
  className,
  description,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-dashed border-border bg-surface-raised p-6 text-center",
        className,
      )}
      {...props}
    >
      <h2 className="text-heading-3 font-bold text-text">{title}</h2>
      <p className="mx-auto max-w-md text-body-sm text-text-muted">{description}</p>
      {action ? <div className="mt-1 flex justify-center">{action}</div> : null}
    </div>
  );
}
