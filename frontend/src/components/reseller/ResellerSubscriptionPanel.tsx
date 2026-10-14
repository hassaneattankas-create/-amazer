"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { submitResellerPayment, type ResellerAccount } from "@/services/reseller-service";

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

/** Abonnement revendeur : etat, et paiement Nita / Amana valide par l'admin (meme principe que les vendeurs). */
export function ResellerSubscriptionPanel({ account }: { account: ResellerAccount }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"nita" | "amana">("nita");
  const [months, setMonths] = useState(1);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const { data: settings } = useQuery({ queryKey: ["public-finance-settings"], queryFn: getPublicFinanceSettings, staleTime: 5 * 60_000 });

  const pay = useMutation({
    mutationFn: submitResellerPayment,
    onSuccess: (next) => {
      queryClient.setQueryData(["reseller-account"], next);
      setReference("");
      setError("");
    },
    onError: (err) => setError(getApiErrorMessage(err, "Envoi impossible. Vérifiez la référence.")),
  });

  const until = account.paid_until ? new Date(account.paid_until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
  const wallet = settings?.platform_wallet_phone || settings?.support_whatsapp || "le numéro AMAZER";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reference.trim().length < 4) return;
    pay.mutate({ payment_mode: mode, transaction_reference: reference.trim(), months });
  }

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          {account.active ? (
            <BadgeCheck className="h-5 w-5 text-success" aria-hidden="true" />
          ) : (
            <Clock className="h-5 w-5 text-warning" aria-hidden="true" />
          )}
          {account.active ? `Abonnement actif${until ? ` jusqu'au ${until}` : ""}` : "Abonnement revendeur à activer"}
        </p>
        <p className="text-xs text-ink-600">
          {account.monthly_fee > 0 ? `${formatXOF(account.monthly_fee)} / mois` : "Gratuit"} · commission AMAZER{" "}
          {account.commission_percent} % de la marge
        </p>
      </div>

      {account.pending_payment ? (
        <p className="mt-3 rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800" role="status">
          Paiement reçu, en cours de vérification par AMAZER. Vous serez prévenu dès l&apos;activation.
        </p>
      ) : account.monthly_fee > 0 ? (
        <form onSubmit={onSubmit} className="mt-3 space-y-3 border-t border-border pt-3">
          <p className="text-sm text-ink-700">
            Envoyez <span className="font-semibold">{formatXOF(account.monthly_fee * months)}</span> au{" "}
            <span className="font-semibold">{wallet}</span> par Nita ou Amana, puis saisissez la référence du paiement.
            {account.active ? " Le nouveau mois s'ajoute à la fin de votre abonnement." : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium text-ink-800">
              Moyen
              <select className={fieldClass} value={mode} onChange={(event) => setMode(event.target.value as "nita" | "amana")}>
                <option value="nita">Nita</option>
                <option value="amana">Amana</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-800">
              Durée
              <select className={fieldClass} value={months} onChange={(event) => setMonths(Number(event.target.value))}>
                {[1, 3, 6, 12].map((value) => (
                  <option key={value} value={value}>
                    {value} mois
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-800">
              Référence du paiement
              <input className={fieldClass} value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          </div>
          <Button type="submit" disabled={pay.isPending || reference.trim().length < 4}>
            {pay.isPending ? "Envoi…" : account.active ? "Prolonger mon abonnement" : "Activer mon abonnement"}
          </Button>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
