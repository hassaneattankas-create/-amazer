"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import type { PaymentIntent } from "@/types/order";

type ManualPaymentCardProps = {
  orderId: string;
  data?: PaymentIntent;
  isPending: boolean;
  isError: boolean;
  isConfirming: boolean;
  isStarting: boolean;
  status: string;
  onStart: () => void;
  onConfirm: (providerReference: string) => void;
};

export function ManualPaymentCard({
  orderId,
  data,
  isPending,
  isError,
  isConfirming,
  isStarting,
  status,
  onStart,
  onConfirm,
}: ManualPaymentCardProps) {
  const [providerReference, setProviderReference] = useState("");

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Finaliser le paiement</h1>
        <p className="mt-2 text-sm text-slate-600">
          Lancez le paiement puis validez-le dans votre application AmanaTa.
        </p>

        {isPending ? <p className="mt-3 text-sm text-slate-500">Preparation du paiement...</p> : null}
        {isError ? <p className="mt-3 text-sm text-rose-600">Impossible de charger le paiement.</p> : null}

        {data ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
              <p className="text-xs text-slate-500">Reference paiement</p>
              <p className="mt-1 text-2xl font-semibold tracking-wide text-[#FF4D00]">{data.payment_reference}</p>
              <p className="mt-2 text-sm text-slate-700">Montant: {formatXOF(data.amount)}</p>
            </div>

            {data.payment_mode === "amana" ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Paiement Amana securise</p>
                  <p className="mt-2 text-sm text-slate-700">Validez exactement {formatXOF(data.amount)} dans AmanaTa.</p>
                </div>
                <Button onClick={onStart} className="w-full bg-[#FF4D00] hover:bg-[#E64500]" disabled={isStarting || isConfirming}>
                  Demarrer le paiement Amana
                </Button>
                <Button onClick={() => onConfirm("")} className="w-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50" disabled={isConfirming}>
                  Verifier le paiement
                </Button>
              </>
            ) : (
              <>
                <Input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Reference operateur ou numero de transaction (optionnel)" />
                <Button onClick={() => onConfirm(providerReference)} className="w-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50" disabled={isConfirming}>
                  J&apos;ai paye - confirmer
                </Button>
              </>
            )}
          </div>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">Commande: {orderId}</p>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}
