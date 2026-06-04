"use client";

import { CheckCircle2, Circle, Truck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { confirmOrderReception } from "@/services/order-service";
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
  const normalizedStatus =
    order.status === "CLAIMED" ? "recu" : order.status === "payment_pending" ? "commande" : order.status;
  const activeIndex = steps.indexOf(normalizedStatus);

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrderReception(order.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["orders-me"] }); },
  });

  const canConfirm = normalizedStatus === "livraison";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">Commande #{order.id.slice(0, 8)}</p>
          {order.status === "payment_pending" ? (
            <p className="mt-1 text-xs text-amber-700">Paiement en attente de confirmation.</p>
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

      <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
        <Truck className="h-3.5 w-3.5 text-[#FF4D00]" />
        Suivi: {order.tracking_code || "en cours"}
      </p>
    </div>
  );
}
