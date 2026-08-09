import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  description?: ReactNode;
  label: ReactNode;
};

export function Switch({ className, description, label, ...props }: SwitchProps) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 text-body-sm text-text">
      <span className="grid gap-1">
        <span className="font-semibold">{label}</span>
        {description ? (
          <span className="text-caption text-text-muted">{description}</span>
        ) : null}
      </span>
      <input
        className={cn(
          "h-6 w-11 rounded-full border-border bg-surface-muted text-brand accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed",
          className,
        )}
        role="switch"
        type="checkbox"
        {...props}
      />
    </label>
  );
}
