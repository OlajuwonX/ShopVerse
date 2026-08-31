import type { InputHTMLAttributes } from "react";

import {
  FIELD_FOCUS,
  FIELD_FOCUS_INVALID,
  FIELD_TEXT,
} from "@/components/ui/field-styles";
import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  label: string;
};

export function Input({
  className,
  error,
  hint,
  id,
  label,
  required,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  const hintId = hint && inputId ? `${inputId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="grid gap-2 text-label font-semibold text-text">
      <span>
        {label}
        {required ? <span className="text-danger"> required</span> : null}
      </span>
      <input
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-11 rounded-md border border-border bg-surface-raised px-3 text-text shadow-sm transition-colors placeholder:text-text-subtle disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted",
          FIELD_TEXT,
          FIELD_FOCUS,
          error && "border-danger",
          error && FIELD_FOCUS_INVALID,
          className,
        )}
        id={inputId}
        required={required}
        {...props}
      />
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
