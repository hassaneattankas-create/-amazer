"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ContactReminder } from "@/components/account/ContactReminder";
import { Button } from "@/components/ui/button";
import {
  clearAllNotifications,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notification-service";
import { useNotificationStore } from "@/store/notification-store";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", { hour12: false });
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const items = useNotificationStore((state) => state.items);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const appendNotifications = useNotificationStore((state) => state.appendNotifications);
  const [actionError, setActionError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const markOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["remote-notifications"] });
    },
  });
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["remote-notifications"] });
    },
  });
  const clearAllMutation = useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["remote-notifications"] });
    },
  });

  const isBusy = markOneMutation.isPending || markAllMutation.isPending || clearAllMutation.isPending;

  async function handleMarkAsRead(id: string) {
    setActionError("");
    markAsRead(id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return;
    }
    try {
      await markOneMutation.mutateAsync(id);
    } catch {
      setActionError("Impossible de synchroniser cette notification avec le serveur.");
    }
  }

  async function handleMarkAllAsRead() {
    setActionError("");
    markAllAsRead();
    try {
      await markAllMutation.mutateAsync();
    } catch {
      setActionError("Impossible de marquer toutes les notifications comme lues sur le serveur.");
    }
  }

  async function handleClearAll() {
    if (!window.confirm("Effacer toutes vos notifications ?")) return;
    setActionError("");
    clearAll();
    setHasMore(true);
    try {
      await clearAllMutation.mutateAsync();
    } catch {
      setActionError("Impossible de vider les notifications sur le serveur.");
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    setActionError("");
    try {
      const older = await listMyNotifications(50, items.length);
      if (older.length < 50) setHasMore(false);
      if (older.length > 0) appendNotifications(older);
      else setHasMore(false);
    } catch {
      setActionError("Impossible de charger les notifications suivantes.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-gutter pb-14 pt-4">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-ink-900">Notifications</h1>
        <p className="mt-2 text-sm text-slate-600">
          Commandes, paiements, messages et livraisons. Elles vous sont aussi envoyées par e-mail.
        </p>
        <div className="mt-3">
          <ContactReminder />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleMarkAllAsRead} disabled={isBusy}>
            Tout marquer comme lu
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAll}
            disabled={isBusy}
          >
            Vider
          </Button>
        </div>
        {actionError ? (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {actionError}
          </p>
        ) : null}
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <div className="space-y-3">
          {items.map((item) => {
            const content = (
              <div
                className={`rounded-card border p-4 transition-colors duration-fast hover:border-ink-400 ${
                  item.unread ? "border-brand-500 bg-card" : "border-border bg-card"
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
                    className="mt-3 text-xs font-medium text-brand-600 hover:underline"
                    onClick={(event) => {
                      // Dans une notification cliquable : marquer comme lu sans ouvrir la page.
                      event.preventDefault();
                      event.stopPropagation();
                      void handleMarkAsRead(item.id);
                    }}
                  >
                    Marquer comme lu
                  </button>
                ) : null}
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} onClick={() => void handleMarkAsRead(item.id)}>
                  {content}
                </Link>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
          {!items.length ? (
            <p className="py-6 text-center text-sm text-ink-600">Aucune notification pour le moment. Vous serez prévenu ici à chaque étape de vos commandes.</p>
          ) : null}
          {items.length > 0 && hasMore ? (
            <div className="pt-2 text-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-sm"
              >
                {loadingMore ? "Chargement…" : "Voir plus"}
              </Button>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}
