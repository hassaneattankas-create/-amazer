"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import { getRestaurantOrderPayRoute, getRestaurantOrderReceiptRoute } from "@/lib/mobile-routes";
import { getRestaurantReceiptLink, listMyRestaurantOrders } from "@/services/restaurant-service";

const STATUS_LABELS: Record<string, string> = {
  payment_pending: "Paiement en vérification",
  commande: "Reçue par le restaurant",
  preparation: "En préparation",
  livraison: "En livraison",
  recu: "Livrée",
  CLAIMED: "Livrée",
  annulee: "Annulée",
};

/** Commandes restaurant du client : suivi, paiement à terminer et reçu. */
export function MyRestaurantOrders() {
  const [receiptError, setReceiptError] = useState("");
  const { data: orders = [] } = useQuery({
    queryKey: ["restaurant-orders-me"],
    queryFn: listMyRestaurantOrders,
    retry: false,
    refetchInterval: 30_000,
  });
  if (!orders.length) return null;

  const openReceipt = async (orderId: string) => {
    setReceiptError("");
    try {
      const receipt = await getRestaurantReceiptLink(orderId);
      window.location.assign(getRestaurantOrderReceiptRoute(orderId, receipt.token));
    } catch {
      setReceiptError("Reçu indisponible pour le moment. Réessayez.");
    }
  };

  return (
    <article className="rounded-card border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <UtensilsCrossed className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Mes commandes restaurant
      </h2>
      <ul className="mt-3 divide-y divide-border">
        {orders.slice(0, 10).map((order) => {
          const unpaid = order.payment_status !== "paid" && order.status !== "annulee";
          return (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-ink-900">{order.vendor_name}</p>
                <p className="text-xs text-ink-600">
                  {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ·{" "}
                  {order.items.map((item) => `${item.quantity} × ${item.dish_name}`).join(", ")}
                </p>
                <p className="text-xs font-medium text-ink-800">{STATUS_LABELS[order.status] ?? order.status}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-bold text-ink-900">{formatXOF(order.total_amount)}</span>
                {unpaid ? (
                  <Link href={getRestaurantOrderPayRoute(order.id)} className="text-xs font-semibold text-brand-700 underline">
                    Payer ou envoyer la référence
                  </Link>
                ) : order.payment_status === "paid" ? (
                  <button type="button" onClick={() => void openReceipt(order.id)} className="min-h-9 text-xs font-semibold text-brand-700 underline">
                    Mon reçu
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {receiptError ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {receiptError}
        </p>
      ) : null}
    </article>
  );
}
