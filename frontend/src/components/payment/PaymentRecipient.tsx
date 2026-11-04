"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import { toast } from "@/store/toast-store";

/** Valeur à recopier (numéro, référence), avec un bouton qui la copie. */
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible : recopiez-le à la main.");
    }
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-field bg-surface-1 p-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-600">{label}</p>
        <p className="break-all text-lg font-semibold text-ink-900">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copier : ${label}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-field border border-border bg-card text-ink-700 hover:border-brand-500"
      >
        {copied ? <Check className="h-5 w-5 text-success" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}

type PaymentRecipientProps = {
  amount: number;
  methodName: string;
  accountNumber: string | null;
  accountName?: string | null;
  instructions?: string | null;
};

/** Où envoyer l'argent : montant, numéro à copier, titulaire et instructions réglées dans l'admin. */
export function PaymentRecipient({ amount, methodName, accountNumber, accountName, instructions }: PaymentRecipientProps) {
  if (!accountNumber) {
    return (
      <p className="rounded-field bg-warning/10 p-3 text-sm text-ink-800" role="alert">
        Le numéro de paiement n&apos;est pas encore disponible : contactez le support avant de payer.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-800">
        Envoyez <strong className="text-ink-900">{formatXOF(amount)}</strong> par {methodName} :
      </p>
      <CopyValue label="Numéro" value={accountNumber} />
      {accountName ? <p className="text-sm text-ink-700">Au nom de : {accountName}</p> : null}
      {instructions ? <p className="whitespace-pre-line text-sm text-ink-700">{instructions}</p> : null}
    </div>
  );
}
