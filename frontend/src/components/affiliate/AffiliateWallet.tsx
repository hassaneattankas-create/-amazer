"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { AffiliateMe, PayoutMethod, requestAffiliatePayout } from "@/services/affiliate-service";

const METHODS: Array<{ value: PayoutMethod; label: string }> = [
  { value: "nita", label: "Nita" },
  { value: "amana", label: "Amana" },
  { value: "airtel", label: "Airtel Money" },
  { value: "moov", label: "Moov Money" },
];

const STATUS_LABEL: Record<AffiliateMe["recent_earnings"][number]["status"], string> = {
  pending: "Délai de sécurité",
  review: "En vérification",
  available: "Disponible",
  requested: "Paiement demandé",
  paid: "Payé",
  cancelled: "Annulé",
};

function shortDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
}

/** Soldes, demande de paiement (tout le disponible) et historique. */
export function AffiliateWallet({ me }: { me: AffiliateMe }) {
  const queryClient = useQueryClient();
  const e = me.earnings;
  const [method, setMethod] = useState<PayoutMethod>(me.payout_method ?? "nita");
  const [phone, setPhone] = useState(me.payout_phone ?? "");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const openRequest = me.payouts.find((payout) => payout.status === "requested");
  const canRequest = !openRequest && me.status === "active" && e.available > 0 && e.available >= me.min_payout;
  const waiting = e.on_hold + e.review + e.pending;

  const mutation = useMutation({
    mutationFn: requestAffiliatePayout,
    onSuccess: (payout) => {
      setFeedback({ ok: true, text: `Demande envoyée : ${formatXOF(payout.amount)}. Vous serez prévenu dès le versement.` });
      void queryClient.invalidateQueries({ queryKey: ["affiliate-me"] });
    },
    onError: (error) => setFeedback({ ok: false, text: getApiErrorMessage(error, "Demande impossible. Réessayez.") }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    mutation.mutate({ method, phone: phone.trim() });
  };

  return (
    <div className="space-y-3 rounded-card border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Disponible
          </p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatXOF(e.available)}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <Clock className="h-4 w-4" aria-hidden="true" />
            En attente
          </p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatXOF(waiting)}</p>
          <p className="text-xs text-ink-600">
            Livraison en cours, puis {me.hold_days} jours de sécurité
            {e.review > 0 ? ` · ${formatXOF(e.review)} en vérification` : ""}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Déjà payé
          </p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatXOF(e.paid)}</p>
          {e.requested > 0 ? <p className="text-xs text-ink-600">{formatXOF(e.requested)} en cours de paiement</p> : null}
        </div>
      </div>

      {me.status !== "active" ? (
        <p className="rounded-field bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          Votre compte affilié est suspendu. Contactez AMAZER sur WhatsApp.
        </p>
      ) : openRequest ? (
        <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">
          Demande de {formatXOF(openRequest.amount)} en cours ({openRequest.phone}). AMAZER vous verse l&apos;argent et vous prévient.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-semibold text-ink-900">Recevoir mon argent</p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="text-sm text-ink-700">
              <span className="sr-only">Moyen de paiement</span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as PayoutMethod)}
                className="h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
              >
                {METHODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink-700">
              <span className="sr-only">Numéro qui reçoit l&apos;argent</span>
              <input
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Numéro qui reçoit (ex. 90 00 00 00)"
                className="h-11 w-full rounded-field border border-border bg-card px-3 text-sm"
              />
            </label>
            <Button type="submit" disabled={!canRequest || mutation.isPending}>
              {mutation.isPending ? "Envoi…" : "Demander le paiement"}
            </Button>
          </div>
          <p className="text-xs text-ink-600">
            Tout votre solde disponible est versé en une fois, à partir de {formatXOF(me.min_payout)}.
          </p>
        </form>
      )}
      {feedback ? (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-danger"}`} role="status">
          {feedback.text}
        </p>
      ) : null}

      {me.recent_earnings.length || me.payouts.length ? (
        <details className="border-t border-border pt-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-ink-900">Historique</summary>
          <ul className="mt-2 divide-y divide-border text-sm">
            {me.payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ink-800">
                  Paiement {payout.status === "paid" ? "reçu" : payout.status === "rejected" ? "refusé" : "demandé"} · {shortDate(payout.created_at)}
                  {payout.transaction_reference ? ` · réf. ${payout.transaction_reference}` : ""}
                  {payout.admin_note ? ` · ${payout.admin_note}` : ""}
                </span>
                <span className="font-semibold text-ink-900">{formatXOF(payout.amount)}</span>
              </li>
            ))}
            {me.recent_earnings.map((line) => (
              <li key={line.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ink-800">
                  {line.label} · {shortDate(line.created_at)} ·{" "}
                  <span className="text-ink-600">
                    {STATUS_LABEL[line.status]}
                    {line.status === "pending" && line.available_at ? ` jusqu'au ${shortDate(line.available_at)}` : ""}
                    {line.note ? ` (${line.note})` : ""}
                  </span>
                </span>
                <span className={`font-semibold ${line.status === "cancelled" ? "text-ink-500 line-through" : "text-ink-900"}`}>
                  +{formatXOF(line.amount)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
