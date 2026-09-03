"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import {
  FIELD_FOCUS,
  FIELD_FOCUS_INVALID,
  FIELD_TEXT,
} from "@/components/ui/field-styles";
import { cn } from "@/lib/cn";

export type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type SelectProps = {
  autoComplete?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  id?: string;
  label: string;
  labelPlacement?: "inline" | "stacked";
  name?: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  required?: boolean;
  value?: string;
};

const TYPEAHEAD_RESET_MS = 700;

export function Select({
  autoComplete,
  className,
  disabled = false,
  error,
  hint,
  id,
  label,
  labelPlacement = "stacked",
  name,
  onValueChange,
  options,
  placeholder = "Choose an option",
  required = false,
  value = "",
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? name ?? generatedId;
  const labelId = `${triggerId}-label`;
  const listboxId = `${triggerId}-listbox`;
  const errorId = error ? `${triggerId}-error` : undefined;
  const hintId = hint ? `${triggerId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", timer: 0 });

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const firstEnabled = (from: number, step: number) => {
    for (let i = from; i >= 0 && i < options.length; i += step) {
      if (options[i]?.disabled !== true) {
        return i;
      }
    }
    return -1;
  };

  const open = (startAt?: number) => {
    if (disabled) {
      return;
    }
    const fallback = selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1);
    setActiveIndex(startAt ?? fallback);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled === true) {
      return;
    }
    onValueChange?.(option.value);
    close();
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) {
      return;
    }
    listboxRef.current
      ?.querySelector(`#${CSS.escape(`${listboxId}-option-${activeIndex}`)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen, listboxId]);

  const runTypeahead = (key: string) => {
    window.clearTimeout(typeahead.current.timer);
    typeahead.current.buffer += key.toLowerCase();
    typeahead.current.timer = window.setTimeout(() => {
      typeahead.current.buffer = "";
    }, TYPEAHEAD_RESET_MS);

    const query = typeahead.current.buffer;
    const match = options.findIndex(
      (option) =>
        option.disabled !== true && option.label.toLowerCase().startsWith(query),
    );

    if (match < 0) {
      return;
    }

    if (isOpen) {
      setActiveIndex(match);
    } else {
      commit(match);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        close();
      }
      return;
    }

    if (event.key === "Tab") {
      if (isOpen) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;

      if (!isOpen) {
        open();
        return;
      }

      const from = activeIndex < 0 ? (step > 0 ? -1 : options.length) : activeIndex;
      const next = firstEnabled(from + step, step);

      if (next >= 0) {
        setActiveIndex(next);
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? firstEnabled(0, 1)
          : firstEnabled(options.length - 1, -1);

      if (!isOpen) {
        open(next);
        return;
      }
      if (next >= 0) {
        setActiveIndex(next);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) {
        commit(activeIndex);
      } else {
        open();
      }
      return;
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      runTypeahead(event.key);
    }
  };

  const isInline = labelPlacement === "inline";

  return (
    <div className="grid gap-2">
      <div className={isInline ? "flex min-w-0 items-center gap-2" : "contents"}>
        <label
          className={cn(
            "font-semibold",
            isInline
              ? "text-caption whitespace-nowrap text-text-muted"
              : "text-label text-text",
          )}
          htmlFor={triggerId}
          id={labelId}
        >
          {label}
          {required ? <span className="text-danger"> required</span> : null}
        </label>

        <div className="relative min-w-0 flex-1" ref={containerRef}>
          {name ? (
            <input
              autoComplete={autoComplete}
              name={name}
              type="hidden"
              value={value}
            />
          ) : null}

          <button
            aria-activedescendant={
              isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            aria-controls={isOpen ? listboxId : undefined}
            aria-describedby={describedBy}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-invalid={error ? true : undefined}
            aria-labelledby={`${labelId} ${triggerId}`}
            aria-required={required || undefined}
            className={cn(
              "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface-raised px-3 text-left text-text shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted",
              FIELD_TEXT,
              FIELD_FOCUS,
              error && "border-danger",
              error && FIELD_FOCUS_INVALID,
              className,
            )}
            disabled={disabled}
            id={triggerId}
            onClick={() => (isOpen ? close() : open())}
            onKeyDown={onKeyDown}
            ref={triggerRef}
            role="combobox"
            type="button"
          >
            <span className={cn("truncate", !selected && "text-text-subtle")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-70" />
          </button>

          {isOpen ? (
            <ul
              aria-labelledby={labelId}
              className="absolute top-full right-0 left-0 z-dialog mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-raised py-1 shadow-lg"
              id={listboxId}
              ref={listboxRef}
              role="listbox"
            >
              {options.map((option, index) => (
                <li
                  aria-disabled={option.disabled === true || undefined}
                  aria-selected={option.value === value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-body-sm text-text",
                    index === activeIndex && "bg-surface-muted",
                    option.disabled === true && "cursor-not-allowed text-text-subtle",
                  )}
                  id={optionId(index)}
                  key={option.value}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onMouseEnter={() => {
                    if (option.disabled !== true) {
                      setActiveIndex(index);
                    }
                  }}
                  onClick={() => {
                    commit(index);
                  }}
                  role="option"
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value ? (
                    <Check aria-hidden="true" className="size-4 shrink-0 text-brand" />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {hint ? (
        <span className="text-caption font-normal text-text-muted" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="text-caption font-semibold text-danger" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
