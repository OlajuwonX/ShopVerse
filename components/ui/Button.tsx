import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-surface-inverse bg-surface-inverse text-surface hover:bg-text hover:border-text active:bg-text focus-visible:outline-brand disabled:border-border-strong disabled:bg-surface-muted disabled:text-text-muted",
  secondary:
    "border-border bg-surface-raised text-text hover:border-border-strong hover:bg-surface-muted active:bg-surface-muted focus-visible:outline-brand disabled:border-border disabled:bg-surface-muted disabled:text-text-muted",
  ghost:
    "border-transparent bg-transparent text-text hover:bg-surface-muted active:bg-surface-muted focus-visible:outline-brand disabled:text-text-muted",
  danger:
    "border-danger bg-danger text-white hover:bg-danger-strong active:bg-danger-stronger focus-visible:outline-danger disabled:border-border-strong disabled:bg-surface-muted disabled:text-text-muted",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-label",
  md: "min-h-11 px-4 text-label",
  lg: "min-h-12 px-5 text-body-sm font-semibold",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed";

export function buttonStyles(
  options: {
    className?: string | undefined;
    size?: ButtonSize | undefined;
    variant?: ButtonVariant | undefined;
  } = {},
) {
  const { className, size = "md", variant = "primary" } = options;

  return cn(BUTTON_BASE, variants[variant], sizes[size], className);
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonStyles({ className, size, variant })}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
