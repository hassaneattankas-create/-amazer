"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { AdminAffiliatePayout, decideAffiliatePayout, listAffiliatePayouts } from "@/services/finance-service";

import { formatDate, PAYOUT_METHOD } from "./labels";

/** Demandes de paiement : verser par mobile money, puis saisir la reference de la transaction. */
export function AffiliatePayoutsPanel() {
  const [view, setView] = useState<"requested" | "all">("requested");
  const { data = [], isPending } = useQuery({
    queryKey: ["admin-affiliate-payouts", view],
    queryFn: () => listAffiliatePayouts(view),
    retry: false,
  });
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["requested", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`min-h-11 rounded-pill px-4 text-sm font-semibold ${view === key ? "bg-ink-900 text-white" : "border border-border text-ink-800"}`}
          >
            {key === "requested" ? "À traiter" : "Historique"}
          </button>
        ))}
      </div>
      {isPending ? (
        <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : data.length ? (
        data.map((payout) => <PayoutCard key={payout.id} payout={payout} />)
      ) : (
        <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">
          {view === "requested" ? "Aucune demande de paiement à traiter." : "Aucun paiement pour le moment."}
        </p>
      )}
    </div>
  );
}

function PayoutCard({ payout }: { payout: AdminAffiliatePayout }) {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof decideAffiliatePayout>[1]) => decideAffiliatePayout(payout.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-payouts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-earnings"] });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Action impossible.")),
  });
  const open = payout.status === "requested";

  const reject = (cancel: boolean) => {
    if (cancel && !window.confirm("Annuler définitivement ces gains pour fraude ?")) return;
    setError("");
    mutation.mutate({ action: "rejected", note: note.trim() || undefined, cancel_earnings: cancel });
  };

  return (
    <article className="space-y-3 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink-900">
            {payout.full_name}
            {payout.tier === "ambassador" ? <span className="ml-2 rounded-pill bg-brand-50 px-2 py-0.5 text-xs text-brand-700">Ambassadeur</span> : null}
          </p>
          <p className="text-sm text-ink-600">
            {PAYOUT_METHOD[payout.method] ?? payout.method} · <span className="font-mono">{payout.phone}</span> · demandé le {formatDate(payout.created_at)}
          </p>
        </div>
        <p className="text-xl font-bold text-ink-900">{formatXOF(payout.amount)}</p>
      </div>
      {payout.review_amount > 0 ? (
        <p className="flex items-start gap-2 rounded-field bg-warning/10 px-3 py-2 text-sm text-ink-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          Ce compte a aussi {formatXOF(payout.review_amount)} de gains à vérifier (signaux de fraude). Vérifiez le détail avant de payer.
        </p>
      ) : null}
      {open ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor={`ref-${payout.id}`} className="block text-sm font-medium text-ink-800">
              Référence de la transaction (après l&apos;envoi)
            </label>
            <input
              id={`ref-${payout.id}`}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="h-11 w-full rounded-field border border-border bg-card px-3 text-sm"
              placeholder="Ex. NT2610150123"
            />
            <Button
              type="button"
              disabled={!reference.trim() || mutation.isPending}
              onClick={() => {
                setError("");
                mutation.mutate({ action: "paid", transaction_reference: reference.trim() });
              }}
            >
              Marquer comme payé
            </Button>
          </div>
          <div className="space-y-2">
            <label htmlFor={`note-${payout.id}`} className="block text-sm font-medium text-ink-800">
              Motif du refus (visible par l&apos;affilié)
            </label>
            <input
              id={`note-${payout.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="h-11 w-full rounded-field border border-border bg-card px-3 text-sm"
              placeholder="Ex. numéro incorrect"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => reject(false)}>
                Refuser (gains rendus)
              </Button>
              <Button type="button" variant="outline" className="border-danger text-danger" disabled={mutation.isPending} onClick={() => reject(true)}>
                Refuser et annuler (fraude)
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-700">
          {payout.status === "paid" ? `Payé le ${formatDate(payout.processed_at)} · réf. ${payout.transaction_reference}` : `Refusé le ${formatDate(payout.processed_at)}`}
          {payout.admin_note ? ` · ${payout.admin_note}` : ""}
        </p>
      )}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
