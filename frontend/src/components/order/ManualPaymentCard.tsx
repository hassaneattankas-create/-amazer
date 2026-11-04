"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { CopyValue, PaymentRecipient } from "@/components/payment/PaymentRecipient";
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
  /** Référence envoyée : en attente de vérification par AMAZER. */
  awaitingReview?: boolean;
  onStart: () => void;
  onConfirm: (providerReference: string) => void;
};

function Step({ rank, title, children }: { rank: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-ink-900 text-sm font-semibold text-white" aria-hidden="true">
        {rank}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="pt-0.5 font-semibold text-ink-900">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** Paiement d'une commande en étapes numérotées, quel que soit le moyen choisi. */
export function ManualPaymentCard({ orderId, data, isPending, isError, isConfirming, isStarting, status, awaitingReview = false, onStart, onConfirm }: ManualPaymentCardProps) {
  const [providerReference, setProviderReference] = useState("");
  const isAmana = (data?.method_kind ?? data?.payment_mode) === "amana";
  const methodName = data?.method_name ?? data?.payment_mode.toUpperCase() ?? "";

  return (
    <section className="mx-auto w-full max-w-xl space-y-4 px-gutter pb-14 pt-4">
      <article className="space-y-5 rounded-card border border-border bg-card p-5 shadow-resting">
        <header>
          <h1 className="text-2xl font-semibold text-ink-900">Payer ma commande</h1>
          {data ? (
            <p className="mt-1 text-sm text-ink-600">
              {formatXOF(data.amount)} par {methodName}
            </p>
          ) : null}
        </header>

        {isPending ? <div className="h-40 animate-pulse rounded-field bg-surface-2" aria-busy="true" aria-label="Préparation du paiement" /> : null}
        {isError ? (
          <p className="text-sm text-danger" role="alert">
            Impossible de charger le paiement. Vérifiez votre connexion ou reconnectez-vous.
          </p>
        ) : null}

        {data && isAmana ? (
          <ol className="space-y-5">
            <Step rank={1} title="Lancez le paiement">
              <Button onClick={onStart} className="min-h-11 w-full" disabled={isStarting || isConfirming}>
                {isStarting ? "Lancement…" : `Payer ${formatXOF(data.amount)}`}
              </Button>
            </Step>
            <Step rank={2} title="Validez dans votre application AmanaTa">
              <p className="text-sm text-ink-700">Le montant doit être exactement {formatXOF(data.amount)}.</p>
              {data.instructions ? <p className="whitespace-pre-line text-sm text-ink-700">{data.instructions}</p> : null}
            </Step>
            <Step rank={3} title="Revenez ici">
              <Button variant="outline" onClick={() => onConfirm("")} className="min-h-11 w-full" disabled={isConfirming}>
                {isConfirming ? "Vérification…" : "Vérifier mon paiement"}
              </Button>
            </Step>
          </ol>
        ) : null}

        {data && !isAmana ? (
          <ol className="space-y-5">
            <Step rank={1} title="Envoyez l'argent">
              <PaymentRecipient
                amount={data.amount}
                methodName={methodName}
                accountNumber={data.account_number ?? data.platform_wallet_phone ?? null}
                accountName={data.account_name}
                instructions={data.instructions}
              />
            </Step>
            <Step rank={2} title="Indiquez ce motif">
              <CopyValue label="Motif du paiement" value={data.payment_reference} />
            </Step>
            <Step rank={3} title="Confirmez ici">
              <label className="block text-sm text-ink-700">
                Référence reçue par SMS (facultatif)
                <Input className="mt-1 h-11" value={providerReference} onChange={(event) => setProviderReference(event.target.value)} />
              </label>
              <Button onClick={() => onConfirm(providerReference)} className="min-h-11 w-full" disabled={isConfirming || awaitingReview}>
                {isConfirming ? "Envoi…" : "J'ai payé"}
              </Button>
              <p className="text-xs text-ink-600">AMAZER vérifie le paiement, puis confirme votre commande.</p>
            </Step>
          </ol>
        ) : null}

        {status ? (
          <p className="rounded-field bg-surface-1 p-3 text-sm text-ink-800" role="status">
            {status}
          </p>
        ) : null}
        {awaitingReview ? (
          <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
            Suivre ma commande
          </Link>
        ) : null}
        <WhatsAppButton variant="link" label="Besoin d'aide pour payer ?" message={`Bonjour AMAZER, j'ai besoin d'aide pour payer la commande ${orderId}.`} />
      </article>
    </section>
  );
}
