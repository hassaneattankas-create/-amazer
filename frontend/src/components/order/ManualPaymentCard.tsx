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
  status: string;
  onConfirm: (providerReference: string) => void;
};

const FALLBACK_PAYMENT_PHONE = "+227 96953163";

export function ManualPaymentCard({
  orderId,
  data,
  isPending,
  isError,
  isConfirming,
  status,
  onConfirm,
}: ManualPaymentCardProps) {
  const [providerReference, setProviderReference] = useState("");

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Finaliser le paiement</h1>
        <p className="mt-2 text-sm text-slate-600">
          Faites le versement manuellement puis revenez confirmer le paiement ici.
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Paiement {data.payment_mode === "nita" ? "Nita" : "Amana"} par versement manuel
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Envoyez exactement <span className="font-semibold">{formatXOF(data.amount)}</span> au numero{" "}
                <span className="font-semibold text-[#FF4D00]">{FALLBACK_PAYMENT_PHONE}</span>.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Ajoutez la reference <span className="font-semibold">{data.payment_reference}</span> si votre operateur
                le permet, puis revenez ici pour confirmer apres le versement.
              </p>
            </div>

            <Input
              value={providerReference}
              onChange={(event) => setProviderReference(event.target.value)}
              placeholder="Reference operateur ou numero de transaction (optionnel)"
            />

            <Button
              onClick={() => onConfirm(providerReference)}
              className="w-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              disabled={isConfirming}
            >
              J&apos;ai paye - confirmer
            </Button>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">Commande: {orderId}</p>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}
