"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AuthState = {
  cartCount: number;
  preferredCurrency: "XOF";
  appMode: "client" | "seller";
  setCartCount: (count: number) => void;
  setPreferredCurrency: (currency: "XOF") => void;
  setAppMode: (mode: "client" | "seller") => void;
  resetSessionView: () => void;
};

const secureLocalStorage = () => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return window.localStorage;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      cartCount: 0,
      preferredCurrency: "XOF",
      appMode: "client",
      setCartCount: (count) => set({ cartCount: Math.max(0, count) }),
      setPreferredCurrency: () => set({ preferredCurrency: "XOF" }),
      setAppMode: (mode) => set({ appMode: mode }),
      resetSessionView: () => set({ appMode: "client", cartCount: 0 }),
    }),
    {
      name: "amazer-auth",
      storage: createJSONStorage(secureLocalStorage),
      partialize: (state) => ({
        cartCount: state.cartCount,
        preferredCurrency: state.preferredCurrency,
        appMode: state.appMode,
      }),
    }
  )
);
