import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  description?: ReactNode;
  label: ReactNode;
};

export function Radio({ className, description, label, ...props }: RadioProps) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-body-sm text-text">
      <input
        className={cn(
          "mt-1 size-4 border-border text-brand accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed",
          className,
        )}
        type="radio"
        {...props}
      />
      <span className="grid gap-1">
        <span className="font-semibold">{label}</span>
        {description ? (
          <span className="text-caption text-text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
