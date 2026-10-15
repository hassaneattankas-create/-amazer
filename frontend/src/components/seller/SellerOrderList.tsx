"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import type { SellerShopOrder } from "@/types/seller";

type NextStatus = "preparation" | "livraison" | "recu";
type Filter = "todo" | "progress" | "done" | "waiting";

// Une seule action claire par etape (le paiement est confirme par AMAZER, jamais par le vendeur).
const NEXT_STEP: Record<string, { label: string; next: NextStatus }> = {
  commande: { label: "Préparer la commande", next: "preparation" },
  preparation: { label: "Remise au livreur", next: "livraison" },
  livraison: { label: "Marquer livrée", next: "recu" },
};

const STATUS: Record<string, { label: string; tone: string }> = {
  payment_pending: { label: "Paiement en vérification", tone: "bg-surface-3 text-ink-700" },
  commande: { label: "À préparer", tone: "bg-brand-50 text-brand-700" },
  preparation: { label: "En préparation", tone: "bg-surface-3 text-ink-800" },
  livraison: { label: "En livraison", tone: "bg-surface-3 text-ink-800" },
  recu: { label: "Livrée", tone: "bg-surface-1 text-success" },
  CLAIMED: { label: "Livrée", tone: "bg-surface-1 text-success" },
  annulee: { label: "Annulée", tone: "bg-surface-1 text-danger" },
};

const FILTERS: { key: Filter; label: string; match: (order: SellerShopOrder) => boolean }[] = [
  { key: "todo", label: "À traiter", match: (o) => o.payment_status === "paid" && o.status === "commande" },
  { key: "progress", label: "En cours", match: (o) => o.status === "preparation" || o.status === "livraison" },
  { key: "done", label: "Terminées", match: (o) => ["recu", "CLAIMED", "annulee"].includes(o.status) },
  { key: "waiting", label: "Paiement en attente", match: (o) => o.payment_status !== "paid" && o.status !== "annulee" },
];

/** Commandes vendeur : filtres simples, une action par commande, statut lisible. */
export function SellerOrderList({
  orders,
  busy,
  onAdvance,
}: {
  orders: SellerShopOrder[];
  busy: boolean;
  onAdvance: (orderId: string, next: NextStatus) => void;
}) {
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, orders.filter(f.match).length])) as Record<Filter, number>,
    [orders]
  );
  // Tant que le vendeur n'a rien choisi, on ouvre le filtre le plus utile (calcule apres chargement).
  const [chosen, setChosen] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? (counts.todo ? "todo" : counts.progress ? "progress" : counts.waiting ? "waiting" : "done");
  const setFilter = setChosen;
  const visible = orders.filter(FILTERS.find((f) => f.key === filter)!.match);

  return (
    <div className="space-y-3">
      <div className="-mx-gutter flex gap-2 overflow-x-auto px-gutter" role="tablist" aria-label="Filtrer les commandes">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-sm font-medium ${
              filter === item.key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700"
            }`}
          >
            {item.label}
            <span className={filter === item.key ? "text-white/70" : "text-ink-500"}>{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <ul className="space-y-2">
          {visible.map((order) => {
            const next = order.payment_status === "paid" && order.status !== "annulee" ? NEXT_STEP[order.status] : undefined;
            const status = STATUS[order.status] ?? { label: order.status, tone: "bg-surface-3 text-ink-700" };
            return (
              <li key={order.id} className="rounded-card border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {order.customer_name}
                      {order.tracking_code ? <span className="font-normal text-ink-600"> · #{order.tracking_code}</span> : null}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-700">
                      {order.items.map((it) => `${it.quantity} × ${it.product_name}`).join(", ")}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-600">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ·{" "}
                      {order.payment_mode?.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-ink-900">{formatXOF(order.total_amount)}</p>
                    <span className={`mt-1 inline-block rounded-pill px-2 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                  </div>
                </div>
                {next ? (
                  <Button type="button" className="mt-3 w-full sm:w-auto" disabled={busy} onClick={() => onAdvance(order.id, next.next)}>
                    {next.label}
                  </Button>
                ) : order.payment_status !== "paid" && order.status !== "annulee" ? (
                  <p className="mt-2 text-xs text-ink-600">AMAZER vérifie le paiement. Vous serez prévenu pour préparer.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">Aucune commande ici.</p>
      )}
    </div>
  );
}
