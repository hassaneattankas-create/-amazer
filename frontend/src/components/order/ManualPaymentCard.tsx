"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import type { PaymentIntent } from "@/types/order";
import { WhatsAppButton } from "@/components/contact/WhatsAppButton";

type ManualPaymentCardProps = {
  orderId: string;
  data?: PaymentIntent;
  isPending: boolean;
  isError: boolean;
  isConfirming: boolean;
  isStarting: boolean;
  status: string;
  /** Référence envoyée : en attente de vérification par AMAZER. */
  awaitingReview?: boolean;
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
  awaitingReview = false,
  onStart,
  onConfirm,
}: ManualPaymentCardProps) {
  const [providerReference, setProviderReference] = useState("");

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-ink-900">Finaliser le paiement</h1>
        <p className="mt-2 text-sm text-slate-600">
          {data?.payment_mode === "amana"
            ? "Lancez le paiement, puis validez-le dans votre application AmanaTa."
            : "Envoyez le montant par Nita, puis indiquez la référence de votre transaction."}
        </p>

        {isPending ? <p className="mt-3 text-sm text-slate-500">Préparation du paiement…</p> : null}
        {isError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            Impossible de charger le paiement. Vérifiez votre connexion ou reconnectez-vous.
          </p>
        ) : null}

        {data ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
              <p className="text-xs text-slate-500">Référence paiement</p>
              <p className="mt-1 text-2xl font-semibold tracking-wide text-brand-600">{data.payment_reference}</p>
              <p className="mt-2 text-sm text-slate-700">Montant : {formatXOF(data.amount)}</p>
            </div>

            {data.payment_mode === "amana" ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Paiement Amana sécurisé</p>
                  <p className="mt-2 text-sm text-slate-700">Validez exactement {formatXOF(data.amount)} dans AmanaTa.</p>
                </div>
                <Button onClick={onStart} className="w-full" disabled={isStarting || isConfirming}>
                  {isStarting ? "Lancement…" : "Démarrer le paiement Amana"}
                </Button>
                <Button onClick={() => onConfirm("")} className="w-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50" disabled={isConfirming}>
                  {isConfirming ? "Vérification…" : "Vérifier le paiement"}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-700">
                  {data.platform_wallet_phone ? (
                    <p>
                      Envoyez {formatXOF(data.amount)} par Nita au{" "}
                      <span className="font-semibold text-ink-900">{data.platform_wallet_phone}</span>, en indiquant la
                      référence {data.payment_reference}.
                    </p>
                  ) : (
                    <p>Le numéro de paiement Nita n&apos;est pas encore disponible : contactez le support avant de payer.</p>
                  )}
                  <p className="mt-1">
                    Saisissez ensuite la référence de votre transaction. La commande sera confirmée après vérification
                    par AMAZER.
                  </p>
                </div>
                <Input
                  value={providerReference}
                  onChange={(event) => setProviderReference(event.target.value)}
                  aria-label="Référence de la transaction"
                  placeholder="Référence de la transaction (facultatif)"
                />
                <Button onClick={() => onConfirm(providerReference)} className="w-full" disabled={isConfirming || awaitingReview}>
                  {isConfirming ? "Envoi…" : "J'ai payé, envoyer la référence"}
                </Button>
              </>
            )}
          </div>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">Commande : {orderId}</p>
        <WhatsAppButton
          variant="link"
          label="Besoin d'aide pour payer ?"
          message={`Bonjour AMAZER, j'ai besoin d'aide pour payer la commande ${orderId}.`}
          className="mt-3"
        />
        {status ? (
          <p className="mt-3 text-sm text-slate-700" role="status">
            {status}
          </p>
        ) : null}
        {awaitingReview ? (
          <Link href="/dashboard" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
            Suivre ma commande
          </Link>
        ) : null}
      </article>
    </section>
  );
}
