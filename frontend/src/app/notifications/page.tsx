"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useNotificationStore } from "@/store/notification-store";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", { hour12: false });
}

export default function NotificationsPage() {
  const items = useNotificationStore((state) => state.items);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const clearAll = useNotificationStore((state) => state.clearAll);

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Notifications</h1>
        <p className="mt-2 text-sm text-slate-600">
          Historique des alertes internes: commandes, activites vendeur et suivi admin.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={markAllAsRead}>
            Tout marquer comme lu
          </Button>
          <Button
            type="button"
            className="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
            onClick={clearAll}
          >
            Vider
          </Button>
        </div>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <div className="space-y-3">
          {items.map((item) => {
            const content = (
              <div
                className={`rounded-2xl border p-4 transition ${
                  item.unread
                    ? "border-[#FF4D00]/30 bg-orange-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.body}</p>
                {item.unread ? (
                  <button
                    type="button"
                    className="mt-3 text-xs font-medium text-[#FF4D00] hover:underline"
                    onClick={() => markAsRead(item.id)}
                  >
                    Marquer comme lu
                  </button>
                ) : null}
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} onClick={() => markAsRead(item.id)}>
                  {content}
                </Link>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
          {!items.length ? (
            <p className="text-sm text-slate-500">Aucune notification pour le moment.</p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
