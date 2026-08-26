export type ToastTone = "success" | "error" | "info";

export type Toast = {
  description: string | null;
  id: string;
  title: string;
  tone: ToastTone;
};

export const TOAST_LIMIT = 3;

export const TOAST_DURATION_MS: Record<ToastTone, number> = {
  error: 8000,
  info: 5000,
  success: 5000,
};

const EMPTY: Toast[] = [];

let toasts: Toast[] = EMPTY;
let sequence = 0;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToToasts(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getToasts() {
  return toasts;
}

export function getServerToasts() {
  return EMPTY;
}

export function notify(input: {
  description?: string | undefined;
  title: string;
  tone?: ToastTone | undefined;
}) {
  sequence += 1;

  const toast: Toast = {
    description: input.description ?? null,
    id: `toast-${sequence}`,
    title: input.title,
    tone: input.tone ?? "info",
  };

  const duplicate = toasts.find(
    (entry) => entry.title === toast.title && entry.description === toast.description,
  );

  toasts = [...toasts.filter((entry) => entry.id !== duplicate?.id), toast].slice(
    -TOAST_LIMIT,
  );

  emit();

  return toast.id;
}

export function dismissToast(id: string) {
  const next = toasts.filter((entry) => entry.id !== id);

  if (next.length !== toasts.length) {
    toasts = next.length === 0 ? EMPTY : next;
    emit();
  }
}

export function clearToasts() {
  if (toasts.length > 0) {
    toasts = EMPTY;
    emit();
  }
}
