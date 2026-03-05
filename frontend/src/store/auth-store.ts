"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AuthState = {
  cartCount: number;
  preferredCurrency: "XOF" | "EUR" | "USD";
  setCartCount: (count: number) => void;
  setPreferredCurrency: (currency: "XOF" | "EUR" | "USD") => void;
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
      setCartCount: (count) => set({ cartCount: Math.max(0, count) }),
      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),
    }),
    {
      name: "amazer-auth",
      storage: createJSONStorage(secureLocalStorage),
      partialize: (state) => ({
        cartCount: state.cartCount,
        preferredCurrency: state.preferredCurrency,
      }),
    }
  )
);
