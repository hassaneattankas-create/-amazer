"use client";

import { CheckCircle2, Circle, Truck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { cancelOrder, confirmOrderReception } from "@/services/order-service";
import { Order } from "@/types/order";

type OrderStepperProps = {
  order: Order;
};

const STEP_LABELS: Record<string, string> = {
  commande: "Commande",
  preparation: "Preparation",
  livraison: "En livraison",
  recu: "Recu",
};

export function OrderStepper({ order }: OrderStepperProps) {
  const queryClient = useQueryClient();
  const steps = ["commande", "preparation", "livraison", "recu"] as const;
  const isCancelled = order.status === "annulee";
  const normalizedStatus: (typeof steps)[number] | null = order.status === "annulee"
    ? null
    : order.status === "CLAIMED"
      ? "recu"
      : order.status === "payment_pending"
        ? "commande"
        : order.status;
  const activeIndex = normalizedStatus ? steps.indexOf(normalizedStatus) : -1;

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrderReception(order.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["orders-me"] }); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(order.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["orders-me"] }); },
  });

  const canConfirm = normalizedStatus === "livraison";
  // Le serveur n'accepte l'annulation que pour une commande non payee et pas encore traitee.
  const canCancel =
    order.payment_status !== "paid" && (order.status === "payment_pending" || order.status === "commande");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">Commande #{order.id.slice(0, 8)}</p>
          {order.status === "payment_pending" ? (
            <p className="mt-1 text-xs text-amber-700">Paiement en attente de confirmation.</p>
          ) : null}
          {isCancelled ? <p className="mt-1 text-xs font-medium text-danger">Commande annulée.</p> : null}
          {canCancel ? (
            <button
              type="button"
              className="mt-1 min-h-11 text-xs font-medium text-ink-600 hover:text-danger disabled:opacity-50"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (window.confirm("Annuler cette commande ? Cette action est définitive.")) {
                  cancelMutation.mutate();
                }
              }}
            >
              {cancelMutation.isPending ? "Annulation…" : "Annuler la commande"}
            </button>
          ) : null}
          {cancelMutation.isError ? (
            <p className="mt-1 text-xs text-danger" role="alert">
              Annulation impossible : la commande a peut-être déjà été traitée.
            </p>
          ) : null}
        </div>
        {canConfirm ? (
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
            disabled={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending ? "..." : "J ai recu ma commande"}
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {steps.map((step, index) => {
          const done = index <= activeIndex;
          return (
            <div key={`${order.id}-${step}`} className="space-y-1">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-slate-200">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-[#FF4D00]" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300" />
                )}
              </div>
              <p className={`text-[11px] ${done ? "text-slate-800" : "text-slate-400"}`}>
                {STEP_LABELS[step] ?? step}
              </p>
            </div>
          );
        })}
      </div>

      {order.fulfillments && order.fulfillments.length > 1 ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3" aria-label="Suivi par boutique">
          {order.fulfillments.map((part) => (
            <li key={`${order.id}-${part.vendor_id}`} className="flex justify-between gap-2 text-xs text-ink-700">
              <span className="truncate">{part.vendor_name ?? "Boutique"}</span>
              <span className="shrink-0 font-medium">{STEP_LABELS[part.status] ?? part.status}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
        <Truck className="h-3.5 w-3.5 text-[#FF4D00]" />
        Suivi: {order.tracking_code || "en cours"}
      </p>
    </div>
  );
}
