import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";
export type Toast = { id: number; kind: ToastKind; text: string };

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, text: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

/** Messages courts affiches en haut de l'ecran (succes, erreur, info). */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, text) => {
    const clean = text.trim();
    if (!clean) return;
    // pas de doublon exact deja visible
    if (get().toasts.some((toast) => toast.text === clean)) return;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id: nextId++, kind, text: clean }] }));
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Raccourcis utilisables partout (composants, services, callbacks). */
export const toast = {
  success: (text: string) => useToastStore.getState().push("success", text),
  error: (text: string) => useToastStore.getState().push("error", text),
  info: (text: string) => useToastStore.getState().push("info", text),
};
