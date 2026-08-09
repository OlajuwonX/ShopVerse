import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type ErrorStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  correlationId?: string;
  description: string;
  title?: string;
};

export function ErrorState({
  action,
  className,
  correlationId,
  description,
  title = "Something went wrong",
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-danger bg-danger-soft p-6",
        className,
      )}
      role="alert"
      {...props}
    >
      <div className="grid gap-1">
        <h2 className="text-heading-3 font-bold text-danger">{title}</h2>
        <p className="max-w-md text-body-sm text-text">{description}</p>
      </div>
      {correlationId ? (
        <p className="text-caption font-semibold text-text-muted">
          Reference: {correlationId}
        </p>
      ) : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
