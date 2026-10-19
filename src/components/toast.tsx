"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  leaving?: boolean;
}

type PushToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<PushToast | null>(null);

/** Returns `toast(message, tone?)` for transient CRUD feedback. */
export function useToast(): PushToast {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside <ToastProvider>");
  return push;
}

const TONE_STYLE: Record<ToastTone, { icon: typeof CheckCircle2; accent: string }> = {
  success: { icon: CheckCircle2, accent: "text-positive" },
  error: { icon: XCircle, accent: "text-negative" },
  info: { icon: Info, accent: "text-primary" },
};

const DISMISS_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    // Brief leave transition before unmounting.
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 200);
  }, []);

  const push = useCallback<PushToast>(
    (message, tone = "success") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, tone, message }]);
      setTimeout(() => remove(id), DISMISS_MS);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((t) => {
          const { icon: Icon, accent } = TONE_STYLE[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={`anim-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-line bg-surface/95 py-2.5 pr-2 pl-3 shadow-[0_6px_24px_rgb(32_41_35/0.12)] backdrop-blur transition-opacity duration-200 ${
                t.leaving ? "opacity-0" : "opacity-100"
              }`}
            >
              <Icon className={`size-5 shrink-0 ${accent}`} aria-hidden />
              <p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => remove(t.id)}
                className="rounded-md p-1.5 text-ink-soft hover:bg-line/60 hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
