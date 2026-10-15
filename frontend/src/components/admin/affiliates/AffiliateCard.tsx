"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown } from "lucide-react";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import {
  AdminAffiliateEarning,
  decideAffiliateEarning,
  getAffiliateLedger,
  giveAffiliateBonus,
  updateAffiliate,
} from "@/services/finance-service";

import { EARNING_KIND, EARNING_STATUS, formatDate } from "./labels";

/** Un affilie : soldes, signaux de fraude, actions (ambassadeur, suspension, prime, annulation) et detail des gains. */
export function AffiliateCard({ row }: { row: AdminAffiliateEarning }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-earnings"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-ledger", row.user_id] });
  };
  const update = useMutation({
    mutationFn: (data: Parameters<typeof updateAffiliate>[1]) => updateAffiliate(row.user_id, data),
    onSuccess: refresh,
    onError: (err) => setError(getApiErrorMessage(err, "Action impossible.")),
  });
  const bonus = useMutation({
    mutationFn: (data: { amount: number; reason: string }) => giveAffiliateBonus(row.user_id, data),
    onSuccess: refresh,
    onError: (err) => setError(getApiErrorMessage(err, "Prime impossible.")),
  });
  const suspended = row.status === "suspended";
  const ambassador = row.tier === "ambassador";

  const giveBonus = () => {
    const amount = Number(window.prompt("Montant de la prime (XOF) :", "10000") ?? "");
    if (!Number.isFinite(amount) || amount <= 0) return;
    const reason = window.prompt("Motif (visible par l'affilié) :", "Meilleur ambassadeur du mois")?.trim();
    if (!reason) return;
    setError("");
    bonus.mutate({ amount, reason });
  };
  const cancelForFraud = () => {
    const reason = window.prompt("Motif de l'annulation (fraude) :", "Faux comptes / auto-parrainage")?.trim();
    if (!reason) return;
    if (!window.confirm(`Suspendre ${row.full_name} et annuler TOUS ses gains non payés ?`)) return;
    setError("");
    update.mutate({ status: "suspended", cancel_unpaid: true, reason });
  };

  return (
    <article className={`rounded-card border bg-card p-4 ${row.review > 0 || row.flagged_referrals > 0 ? "border-warning" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">
            {row.full_name}
            {ambassador ? <span className="ml-2 rounded-pill bg-brand-50 px-2 py-0.5 text-xs text-brand-700">Ambassadeur</span> : null}
            {suspended ? <span className="ml-2 rounded-pill bg-danger/10 px-2 py-0.5 text-xs text-danger">Suspendu</span> : null}
          </p>
          <p className="truncate text-sm text-ink-600">
            Code <span className="font-mono">{row.code}</span> · {row.clicks} visites · {row.referred} inscrits
          </p>
          {row.flagged_referrals > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-ink-900">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              {row.flagged_referrals} inscription{row.flagged_referrals > 1 ? "s" : ""} suspecte{row.flagged_referrals > 1 ? "s" : ""}
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-right text-sm sm:grid-cols-5">
          <Stat label="Disponible" value={row.available} strong />
          <Stat label="À vérifier" value={row.review} />
          <Stat label="En délai" value={row.on_hold} />
          <Stat label="Demandé" value={row.requested} />
          <Stat label="Payé" value={row.paid} />
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <ChevronDown className={`h-4 w-4 transition-transform duration-fast ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          Détail des gains
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={update.isPending || suspended}
          onClick={() => update.mutate({ tier: ambassador ? "affiliate" : "ambassador" })}
        >
          {ambassador ? "Retirer ambassadeur" : "Nommer ambassadeur"}
        </Button>
        {ambassador && !suspended ? (
          <Button type="button" variant="outline" disabled={bonus.isPending} onClick={giveBonus}>
            Verser une prime
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ status: suspended ? "active" : "suspended" })}
        >
          {suspended ? "Réactiver" : "Suspendre"}
        </Button>
        <Button type="button" variant="outline" className="border-danger text-danger" disabled={update.isPending} onClick={cancelForFraud}>
          Fraude : tout annuler
        </Button>
        {row.whatsapp_phone ? <WhatsAppButton phone={row.whatsapp_phone} variant="link" label="WhatsApp" /> : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {open ? <AffiliateLedger userId={row.user_id} onChanged={refresh} /> : null}
    </article>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-600">{label}</dt>
      <dd className={strong ? "font-bold text-ink-900" : "text-ink-800"}>{formatXOF(value)}</dd>
    </div>
  );
}

function AffiliateLedger({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [error, setError] = useState("");
  const { data = [], isPending } = useQuery({
    queryKey: ["admin-affiliate-ledger", userId],
    queryFn: () => getAffiliateLedger(userId),
  });
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "cancel" }) => decideAffiliateEarning(id, { action }),
    onSuccess: onChanged,
    onError: (err) => setError(getApiErrorMessage(err, "Action impossible.")),
  });
  if (isPending) return <div className="mt-3 h-20 animate-pulse rounded-card bg-surface-3" aria-busy="true" />;
  if (!data.length) return <p className="mt-3 text-sm text-ink-600">Aucun gain enregistré pour le moment.</p>;
  return (
    <div className="mt-3 overflow-x-auto rounded-field border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface-1 text-left text-ink-600">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Origine</th>
            <th className="px-3 py-2 font-medium">Montant</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2 text-ink-700">{formatDate(line.created_at)}</td>
              <td className="px-3 py-2">
                <span className="block text-ink-900">
                  {EARNING_KIND[line.kind] ?? line.kind}
                  {line.percent ? ` · ${line.percent} %` : ""}
                </span>
                {line.source_name ? <span className="text-xs text-ink-600">{line.source_name}</span> : null}
                {line.note ? <span className="block text-xs font-medium text-ink-800">⚠ {line.note}</span> : null}
              </td>
              <td className="px-3 py-2 font-semibold text-ink-900">{formatXOF(line.amount)}</td>
              <td className="px-3 py-2">
                <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${EARNING_STATUS[line.status].className}`}>
                  {EARNING_STATUS[line.status].label}
                </span>
              </td>
              <td className="px-3 py-2">
                {line.status === "review" || line.status === "cancelled" ? (
                  <button
                    type="button"
                    className="min-h-11 font-semibold text-brand-700 hover:underline"
                    onClick={() => decide.mutate({ id: line.id, action: "approve" })}
                  >
                    Valider
                  </button>
                ) : null}
                {["pending", "review", "available"].includes(line.status) ? (
                  <button
                    type="button"
                    className="ml-3 min-h-11 font-semibold text-danger hover:underline"
                    onClick={() => window.confirm("Annuler ce gain ?") && decide.mutate({ id: line.id, action: "cancel" })}
                  >
                    Annuler
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error ? (
        <p className="p-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
