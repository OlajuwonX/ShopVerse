import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type IconButtonVariant = "default" | "ghost" | "danger";
type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  variant?: IconButtonVariant;
};

const variants: Record<IconButtonVariant, string> = {
  default:
    "border-border bg-surface-raised text-text hover:bg-surface-muted focus-visible:outline-brand disabled:bg-surface-muted disabled:text-text-muted",
  ghost:
    "border-transparent bg-transparent text-text hover:bg-surface-muted focus-visible:outline-brand disabled:text-text-muted",
  danger:
    "border-danger text-danger hover:bg-danger-soft focus-visible:outline-danger disabled:border-border disabled:text-text-muted",
};

export function IconButton({
  children,
  className,
  type = "button",
  variant = "default",
  ...props
}: IconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-md border transition-colors duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
