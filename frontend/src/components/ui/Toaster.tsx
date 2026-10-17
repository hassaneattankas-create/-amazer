"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { useToastStore, type Toast } from "@/store/toast-store";

const STYLE: Record<Toast["kind"], string> = {
  success: "border-success bg-card text-ink-900",
  error: "border-danger bg-card text-ink-900",
  info: "border-ink-400 bg-card text-ink-900",
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  useEffect(() => {
    // fermeture automatique (interface utilisateur, pas d'animation de rendu)
    const timer = window.setTimeout(() => dismiss(toast.id), toast.kind === "error" ? 9000 : 4500);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.id, toast.kind]);
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-card border-l-4 p-3 shadow-overlay ${STYLE[toast.kind]}`}
    >
      {toast.kind === "error" ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
      ) : (
        <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${toast.kind === "success" ? "text-success" : "text-ink-600"}`} aria-hidden="true" />
      )}
      <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.text}</p>
      <button
        type="button"
        aria-label="Fermer le message"
        onClick={() => dismiss(toast.id)}
        className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field text-ink-600 hover:bg-surface-1"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Messages en haut de l'ecran, visibles sur telephone comme sur ordinateur. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-toast mx-auto flex w-full max-w-md flex-col gap-2 px-gutter" aria-live="polite">
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </div>
  );
}
