import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CartItem, SavingsHistoryRecord } from "@/types/cart";

type CartStoreState = {
  items: CartItem[];
  savingsHistory: SavingsHistoryRecord[];
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  addSavingsRecord: (savings: number) => void;
  resetSession: () => void;
};

export const useCartStore = create<CartStoreState>()(
  persist(
    (set) => ({
      items: [],
      savingsHistory: [],
      hasHydrated: false,
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      addItem: (item) =>
        set((state) => {
          const quantity = Math.max(1, item.quantity ?? 1);
          const existing = state.items.find((entry) => entry.productId === item.productId);

          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.productId === item.productId
                  ? {
                      ...entry,
                      quantity: entry.quantity + quantity,
                      offersSnapshot: item.offersSnapshot,
                    }
                  : entry
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                productId: item.productId,
                name: item.name,
                quantity,
                offersSnapshot: item.offersSnapshot,
              },
            ],
          };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((entry) => entry.productId !== productId),
        })),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((entry) =>
            entry.productId === productId
              ? { ...entry, quantity: Math.max(1, Math.floor(quantity)) }
              : entry
          ),
        })),
      clearCart: () => set({ items: [] }),
      addSavingsRecord: (savings) =>
        set((state) => ({
          savingsHistory: [
            {
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              createdAt: new Date().toISOString(),
              savings: Math.max(0, savings),
            },
            ...state.savingsHistory,
          ].slice(0, 40),
        })),
      resetSession: () => set({ items: [], savingsHistory: [] }),
    }),
    {
      name: "amazer-smart-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        savingsHistory: state.savingsHistory,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
