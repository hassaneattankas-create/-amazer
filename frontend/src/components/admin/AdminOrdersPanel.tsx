"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { cancelAdminOrder, dispatchAdminOrder, listAdminOrders } from "@/services/finance-service";
import { confirmPayment } from "@/services/order-service";
import { confirmRestaurantPayment } from "@/services/restaurant-service";
import { toast } from "@/store/toast-store";
import type { AdminOrderTracking } from "@/types/finance";

type Tab = "valider" | "livrer" | "toutes";

const STATUS_LABELS: Record<string, string> = {
  commande: "Nouvelle",
  preparation: "En préparation",
  livraison: "En livraison",
  recu: "Livrée",
  CLAIMED: "Livrée",
  annulee: "Annulée",
};

const isClosed = (order: AdminOrderTracking) => ["recu", "CLAIMED", "annulee"].includes(order.status);
const isPaid = (order: AdminOrderTracking) => (order.payment_status ?? "paid") === "paid";

/** Commandes : valider les paiements, faire avancer la livraison, annuler — tout au même endroit. */
export function AdminOrdersPanel() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("valider");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const { data: orders = [], isPending, isError, error } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listAdminOrders(80),
    refetchInterval: 15000,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  const onError = (err: unknown) => toast.error(getApiErrorMessage(err, "Action impossible. Réessayez."));

  const confirm = useMutation({
    mutationFn: ({ id, reference, restaurant }: { id: string; reference?: string; restaurant?: boolean }) =>
      (restaurant ? confirmRestaurantPayment : confirmPayment)(id, reference ? { provider_reference: reference } : {}),
    onSuccess: (result) => {
      if (result.payment_status === "paid") toast.success("Paiement validé : le vendeur et les livreurs sont prévenus.");
      else toast.info(result.message || "Paiement toujours en attente.");
      refresh();
    },
    onError,
  });
  const dispatch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "livraison" | "recu" }) => dispatchAdminOrder(id, status),
    onSuccess: () => {
      toast.success("Commande mise à jour.");
      refresh();
    },
    onError,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelAdminOrder(id),
    onSuccess: () => {
      toast.success("Commande annulée. Si elle était payée, enregistrez le remboursement dans « Remboursements ».");
      refresh();
    },
    onError,
  });

  const groups = useMemo(
    () => ({
      valider: orders.filter((o) => !isPaid(o) && o.status !== "annulee"),
      // Les restaurants livrent eux-mêmes : seules les commandes boutiques sont à suivre ici.
      livrer: orders.filter((o) => isPaid(o) && !isClosed(o) && o.kind !== "restaurant"),
      toutes: orders,
    }),
    [orders]
  );
  const visible = groups[tab];
  const busy = confirm.isPending || dispatch.isPending || cancel.isPending;

  return (
    <article className="rounded-card border border-border bg-card p-4 sm:p-6" aria-labelledby="orders-title">
      <h2 id="orders-title" className="text-lg font-semibold text-ink-900">
        Commandes à traiter
      </h2>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Filtre des commandes">
        {(
          [
            ["valider", `Paiements à valider (${groups.valider.length})`],
            ["livrer", `À livrer (${groups.livrer.length})`],
            ["toutes", "Toutes"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-10 rounded-pill border px-4 text-sm font-medium ${
              tab === key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isError ? <p className="mt-4 text-sm text-danger">{getAdminFinanceDataError(error)}</p> : null}
      {isPending ? <div className="mt-4 h-24 animate-pulse rounded-field bg-surface-2" aria-busy="true" /> : null}

      <div className="mt-4 space-y-2">
        {visible.map((order) => {
          const paid = isPaid(order);
          const restaurant = order.kind === "restaurant";
          const closed = isClosed(order) || restaurant;
          const next = !paid || closed ? null : order.status === "livraison" ? { label: "Marquer livrée", to: "recu" as const } : { label: "Envoyer en livraison", to: "livraison" as const };
          const reference = refs[order.id] ?? order.client_reference ?? "";
          return (
            <div key={order.id} className="rounded-field border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {order.customer_name} <span className="font-normal text-ink-500">#{order.tracking_code ?? order.id.slice(0, 8)}</span>
                  </p>
                  {restaurant ? (
                    <p className="text-xs font-semibold text-brand-700">Restaurant{order.place_name ? ` · ${order.place_name}` : ""} (prépare et livre lui-même)</p>
                  ) : null}
                  <p className="text-xs text-ink-600">
                    {new Date(order.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    {order.delivery_district ? ` · ${order.delivery_district}` : ""}
                    {order.item_count ? ` · ${order.item_count} article${order.item_count > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink-900">{formatXOF(order.total_amount)}</p>
                  <p className="text-xs text-ink-600">
                    {paid ? "Payé" : "Paiement à valider"} · {order.payment_mode.toUpperCase()} · {STATUS_LABELS[order.status] ?? order.status}
                  </p>
                </div>
              </div>

              {!paid && order.status !== "annulee" ? (
                order.payment_mode === "amana" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-ink-600">Amana se valide tout seul dès que le client confirme dans AmanaTa.</p>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => confirm.mutate({ id: order.id, restaurant })}>
                      Vérifier maintenant
                    </Button>
                  </div>
                ) : (
                  <form
                    className="mt-2 flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!reference.trim()) {
                        toast.error("Saisissez la référence Nita lue sur votre relevé.");
                        return;
                      }
                      confirm.mutate({ id: order.id, reference: reference.trim(), restaurant });
                    }}
                  >
                    <label className="min-w-0 flex-1 text-xs font-medium text-ink-700">
                      Référence Nita (vérifiez-la sur votre relevé)
                      <input
                        value={reference}
                        onChange={(event) => setRefs((prev) => ({ ...prev, [order.id]: event.target.value }))}
                        placeholder={order.client_reference ? "" : "Le client n'a pas encore envoyé de référence"}
                        className="mt-1 h-10 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
                      />
                    </label>
                    <Button type="submit" size="sm" disabled={busy}>
                      Valider le paiement
                    </Button>
                  </form>
                )
              ) : null}

              {next || !closed ? (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {next ? (
                    <Button type="button" size="sm" disabled={busy} onClick={() => dispatch.mutate({ id: order.id, status: next.to })}>
                      {next.label}
                    </Button>
                  ) : null}
                  {!closed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Annuler cette commande ? Si elle est payée, le remboursement se fait hors plateforme.")) cancel.mutate(order.id);
                      }}
                    >
                      Annuler
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {!isPending && !visible.length ? (
          <p className="text-sm text-ink-600">
            {tab === "valider" ? "Aucun paiement à valider." : tab === "livrer" ? "Aucune commande à livrer." : "Aucune commande pour le moment."}
          </p>
        ) : null}
      </div>
    </article>
  );
}
