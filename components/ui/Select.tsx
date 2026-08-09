import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
  hint?: string;
  label: string;
};

export function Select({
  children,
  className,
  error,
  hint,
  id,
  label,
  required,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  const errorId = error && selectId ? `${selectId}-error` : undefined;
  const hintId = hint && selectId ? `${selectId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="grid gap-2 text-label font-semibold text-text">
      <span>
        {label}
        {required ? <span className="text-danger"> required</span> : null}
      </span>
      <select
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-11 rounded-md border border-border bg-surface-raised px-3 text-body-sm text-text shadow-sm transition-colors focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted",
          error
            ? "border-danger focus-visible:border-danger focus-visible:outline-danger"
            : null,
          className,
        )}
        id={selectId}
        required={required}
        {...props}
      >
        {children}
      </select>
      {hint ? (
        <span id={hintId} className="text-caption font-normal text-text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-caption font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
