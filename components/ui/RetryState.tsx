import type { HTMLAttributes } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type RetryStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: string;
  description: string;
  title?: string;
};

export function RetryState({
  action = "Retry",
  className,
  description,
  title = "Unable to load this section",
  ...props
}: RetryStateProps) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-border bg-surface-raised p-6",
        className,
      )}
      role="status"
      {...props}
    >
      <div className="grid gap-1">
        <h2 className="text-heading-3 font-bold text-text">{title}</h2>
        <p className="max-w-md text-body-sm text-text-muted">{description}</p>
      </div>
      <div>
        <Button variant="secondary">{action}</Button>
      </div>
    </div>
  );
}
