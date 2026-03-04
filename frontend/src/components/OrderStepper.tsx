"use client";

import { CheckCircle2, Circle, Truck } from "lucide-react";

import { Order } from "@/types/order";

type OrderStepperProps = {
  order: Order;
};

export function OrderStepper({ order }: OrderStepperProps) {
  const steps = ["commande", "preparation", "livraison", "recu"] as const;
  const normalizedStatus =
    order.status === "CLAIMED" ? "recu" : order.status === "payment_pending" ? "commande" : order.status;
  const activeIndex = steps.indexOf(normalizedStatus);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">Commande #{order.id.slice(0, 8)}</p>
      {order.status === "payment_pending" ? (
        <p className="mt-2 text-xs text-amber-700">Paiement en attente de confirmation.</p>
      ) : null}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {steps.map((step, index) => {
          const done = index <= activeIndex;
          return (
            <div key={`${order.id}-${step}`} className="space-y-1">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-slate-200">
                {done ? <CheckCircle2 className="h-5 w-5 text-[#FF4D00]" /> : <Circle className="h-5 w-5 text-slate-300" />}
              </div>
              <p className={`text-[11px] ${done ? "text-slate-800" : "text-slate-400"}`}>{step}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
        <Truck className="h-3.5 w-3.5 text-[#FF4D00]" />
        ETA: {order.estimated_minutes} min {order.tracking_code ? `- ${order.tracking_code}` : ""}
      </p>
    </div>
  );
}
