"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect, useSyncExternalStore, type ComponentType } from "react";

import {
  dismissToast,
  getServerToasts,
  getToasts,
  subscribeToToasts,
  TOAST_DURATION_MS,
  type Toast,
  type ToastTone,
} from "@/components/feedback/toast";
import { cn } from "@/lib/cn";

const toneStyles: Record<ToastTone, string> = {
  error: "border-danger bg-danger-soft text-danger",
  info: "border-border bg-surface-raised text-text",
  success: "border-success bg-success-soft text-success",
};

const toneIcons: Record<ToastTone, ComponentType<{ className?: string }>> = {
  error: CircleAlert,
  info: Info,
  success: CircleCheck,
};

function ToastCard({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      dismissToast(toast.id);
    }, TOAST_DURATION_MS[toast.tone]);

    return () => {
      clearTimeout(timer);
    };
  }, [toast.id, toast.tone]);

  const Icon = toneIcons[toast.tone];

  return (
    <li
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-3 shadow-overlay motion-safe:animate-[toast-in_150ms_ease-out]",
        toneStyles[toast.tone],
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />

      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-body-sm font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="text-caption text-text-muted">{toast.description}</p>
        ) : null}
      </div>

      <button
        aria-label="Dismiss notification"
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={() => {
          dismissToast(toast.id);
        }}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts, getServerToasts);

  return (
    <div
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-toast flex justify-center px-(--page-gutter) pt-3 sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-0 sm:justify-end sm:pt-0 sm:pb-4"
      role="log"
    >
      <ul className="grid w-full max-w-sm gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </ul>
    </div>
  );
}
