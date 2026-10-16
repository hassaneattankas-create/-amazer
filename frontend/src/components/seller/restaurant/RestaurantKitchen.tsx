"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bike, ChefHat, Clock3, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { updateSellerRestaurantOrderStatus } from "@/services/restaurant-service";
import type { RestaurantOrder } from "@/types/restaurant";

type Column = "nouvelles" | "cuisine" | "route" | "terminees";

const COLUMNS: Array<{ key: Column; label: string }> = [
  { key: "nouvelles", label: "Nouvelles" },
  { key: "cuisine", label: "En cuisine" },
  { key: "route", label: "En livraison" },
  { key: "terminees", label: "Terminées" },
];

function columnOf(order: RestaurantOrder): Column | null {
  if (order.status === "payment_pending" || order.status === "commande") return "nouvelles";
  if (order.status === "preparation") return "cuisine";
  if (order.status === "livraison") return "route";
  return "terminees";
}

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

/** Ecran cuisine (modele Uber Eats) : nouvelles -> en cuisine -> en livraison -> terminees, une action par carte. */
export function RestaurantKitchen({ orders }: { orders: RestaurantOrder[] }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [chosen, setChosen] = useState<Column | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "preparation" | "livraison" | "recu" | "annulee" }) =>
      updateSellerRestaurantOrderStatus(id, status),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["seller-restaurant-orders"] });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Mise à jour impossible. Réessayez.")),
  });

  const counts = COLUMNS.reduce<Record<Column, number>>(
    (acc, column) => ({ ...acc, [column.key]: orders.filter((order) => columnOf(order) === column.key).length }),
    { nouvelles: 0, cuisine: 0, route: 0, terminees: 0 }
  );
  const auto: Column = counts.nouvelles ? "nouvelles" : counts.cuisine ? "cuisine" : counts.route ? "route" : "terminees";
  const view = chosen ?? auto;
  const visible = orders.filter((order) => columnOf(order) === view);

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <ChefHat className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Commandes du restaurant
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Étapes">
        {COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            role="tab"
            aria-selected={view === column.key}
            onClick={() => setChosen(column.key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill px-4 text-sm font-semibold ${
              view === column.key ? "bg-ink-900 text-white" : "border border-border text-ink-800 hover:bg-surface-1"
            }`}
          >
            {column.label}
            <span className={view === column.key ? "text-white/70" : column.key === "nouvelles" && counts.nouvelles ? "text-brand-700" : "text-ink-500"}>
              {counts[column.key]}
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {visible.length ? (
        <ul className="space-y-3">
          {visible.map((order) => {
            const waited = minutesSince(order.created_at, now);
            const late = view !== "terminees" && waited > 45;
            const paid = order.payment_status === "paid";
            return (
              <li key={order.id} className={`rounded-card border bg-card p-4 ${late ? "border-danger" : "border-border"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">
                      #{(order.payment_reference || order.id).slice(-6).toUpperCase()} · {order.customer_name}
                    </p>
                    <p className={`flex items-center gap-1 text-xs ${late ? "font-semibold text-danger" : "text-ink-600"}`}>
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      il y a {waited} min{late ? " · en retard" : ""}
                    </p>
                  </div>
                  <p className="text-base font-bold text-ink-900">{formatXOF(order.total_amount)}</p>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-ink-800">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span className="font-semibold">{item.quantity} ×</span> {item.dish_name}
                      {item.selected_options.length ? (
                        <span className="text-ink-600"> ({item.selected_options.map((option) => option.name).join(", ")})</span>
                      ) : null}
                      {item.customer_note ? <span className="block text-xs text-ink-700">Note : {item.customer_note}</span> : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-600">{order.delivery_address}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!paid && view === "nouvelles" ? (
                    <span className="rounded-pill bg-warning/25 px-3 py-1 text-xs font-semibold text-ink-900">Paiement en vérification</span>
                  ) : null}
                  {paid && order.status === "commande" ? (
                    <>
                      <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: order.id, status: "preparation" })}>
                        <ChefHat className="h-4 w-4" aria-hidden="true" />
                        Accepter et préparer
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-danger text-danger"
                        disabled={mutation.isPending}
                        onClick={() =>
                          window.confirm("Refuser cette commande ? Le client est prévenu et AMAZER le rembourse.") &&
                          mutation.mutate({ id: order.id, status: "annulee" })
                        }
                      >
                        Refuser
                      </Button>
                    </>
                  ) : null}
                  {order.status === "preparation" ? (
                    <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: order.id, status: "livraison" })}>
                      <Bike className="h-4 w-4" aria-hidden="true" />
                      Prête : envoyer
                    </Button>
                  ) : null}
                  {order.status === "livraison" ? (
                    <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: order.id, status: "recu" })}>
                      Marquer livrée
                    </Button>
                  ) : null}
                  {view === "terminees" ? (
                    <span className="text-xs font-semibold text-ink-700">{order.status === "annulee" ? "Refusée" : "Livrée"}</span>
                  ) : null}
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-field border border-border px-3 text-sm font-medium text-ink-800 hover:bg-surface-1"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Appeler
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">
          {view === "nouvelles" ? "Aucune nouvelle commande. Vous serez prévenu avec un son dès qu'une commande arrive." : "Rien ici pour le moment."}
        </p>
      )}
    </div>
  );
}
