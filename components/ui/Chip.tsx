import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function Chip({
  className,
  selected = false,
  type = "button",
  ...props
}: ChipProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-label font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted",
        selected
          ? "border-surface-inverse bg-surface-inverse text-surface"
          : "border-border bg-surface-raised text-text hover:bg-surface-muted",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
