import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
  hint?: string;
  label: string;
};

export function Textarea({
  className,
  error,
  hint,
  id,
  label,
  required,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name;
  const errorId = error && textareaId ? `${textareaId}-error` : undefined;
  const hintId = hint && textareaId ? `${textareaId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="grid gap-2 text-label font-semibold text-text">
      <span>
        {label}
        {required ? <span className="text-danger"> required</span> : null}
      </span>
      <textarea
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-28 resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-body-sm text-text shadow-sm transition-colors placeholder:text-text-subtle focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted",
          error
            ? "border-danger focus-visible:border-danger focus-visible:outline-danger"
            : null,
          className,
        )}
        id={textareaId}
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
