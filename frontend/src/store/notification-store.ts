"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  tag: string;
  href?: string;
  createdAt: string;
  unread: boolean;
};

type NotificationState = {
  items: AppNotification[];
  pushNotification: (notification: Omit<AppNotification, "id" | "createdAt" | "unread">) => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
};

function secureLocalStorage() {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return window.localStorage;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      pushNotification: (notification) =>
        set((state) => {
          const duplicate = state.items.find(
            (item) => item.tag === notification.tag && item.body === notification.body
          );
          if (duplicate) {
            return state;
          }
          return {
            items: [
              {
                id: `${notification.tag}-${Date.now()}`,
                title: notification.title,
                body: notification.body,
                tag: notification.tag,
                href: notification.href,
                createdAt: new Date().toISOString(),
                unread: true,
              },
              ...state.items,
            ].slice(0, 100),
          };
        }),
      markAllAsRead: () =>
        set((state) => ({
          items: state.items.map((item) => ({ ...item, unread: false })),
        })),
      markAsRead: (id) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, unread: false } : item)),
        })),
      clearAll: () => set({ items: [] }),
    }),
    {
      name: "amazer-notifications",
      storage: createJSONStorage(secureLocalStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
