"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  decideResellerPayment,
  listAllResellers,
  listResellerEarnings,
  listResellerPayments,
  recordResellerPayout,
  type AdminResellerEarning,
  type AdminResellerRow,
} from "@/services/finance-service";

const SUBSCRIPTION_LABELS: Record<AdminResellerRow["subscription"], { label: string; className: string }> = {
  free: { label: "Gratuit", className: "bg-surface-2 text-ink-700" },
  active: { label: "Actif", className: "bg-success/10 text-success" },
  expired: { label: "Expiré", className: "bg-danger/10 text-danger" },
  none: { label: "Jamais activé", className: "bg-warning/10 text-ink-800" },
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** Tous les revendeurs presents sur la plateforme, meme sans vente. */
function AllResellers() {
  const [search, setSearch] = useState("");
  const { data = [], isPending, error } = useQuery({ queryKey: ["admin-resellers"], queryFn: listAllResellers, retry: false });
  const needle = search.trim().toLowerCase();
  const rows = needle
    ? data.filter((row) => [row.full_name, row.contact, row.whatsapp_phone ?? ""].some((value) => value.toLowerCase().includes(needle)))
    : data;
  const active = data.filter((row) => row.subscription === "active" || row.subscription === "free").length;
  const withListings = data.filter((row) => row.listings_active > 0).length;

  return (
    <section aria-label="Tous les revendeurs" className="space-y-2">
      <h2 className="text-lg font-semibold text-ink-900">Tous les revendeurs ({data.length})</h2>
      {data.length ? (
        <p className="text-sm text-ink-600">
          {active} abonnement{active > 1 ? "s" : ""} actif{active > 1 ? "s" : ""} · {withListings} avec des annonces en ligne
        </p>
      ) : null}
      <label className="block">
        <span className="sr-only">Rechercher un revendeur</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par nom, e-mail ou téléphone"
          className="h-10 w-full rounded-field border border-border bg-card px-3 text-sm"
        />
      </label>
      {isPending ? (
        <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : error ? (
        <p className="text-sm text-danger" role="alert">
          {getAdminFinanceDataError(error) || "Chargement impossible."}
        </p>
      ) : rows.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-card">
          {rows.map((row) => {
            const badge = SUBSCRIPTION_LABELS[row.subscription];
            return (
              <li key={row.user_id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                    {row.full_name}
                    <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
                    {row.has_paid ? <span className="rounded-pill bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">A déjà payé</span> : null}
                  </p>
                  <p className="text-xs text-ink-600">
                    {row.contact}
                    {row.whatsapp_phone ? ` · ${row.whatsapp_phone}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-700">
                    Inscrit le {formatDate(row.joined_at)}
                    {row.paid_until && row.subscription !== "free" ? ` · abonnement jusqu'au ${formatDate(row.paid_until)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-700">
                    {row.listings_active} annonce{row.listings_active > 1 ? "s" : ""} en ligne sur {row.listings_total} · {row.orders_delivered} vente
                    {row.orders_delivered > 1 ? "s" : ""} livrée{row.orders_delivered > 1 ? "s" : ""} · gagné {formatXOF(row.earned)}
                    {row.pending ? ` · en attente ${formatXOF(row.pending)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/revendeur/${row.user_id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    Voir sa boutique
                  </Link>
                  {row.whatsapp_phone ? (
                    <WhatsAppButton phone={row.whatsapp_phone} variant="link" label="WhatsApp" message={`Bonjour ${row.full_name}, ici AMAZER.`} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">
          {needle ? "Aucun revendeur ne correspond à cette recherche." : "Aucun revendeur pour le moment."}
        </p>
      )}
    </section>
  );
}

/** Gains des revendeurs (revente sans stock) : a verser par Nita / Amana apres livraison. */
export default function AdminResellersPage() {
  const { data = [], isPending, error } = useQuery({ queryKey: ["admin-reseller-earnings"], queryFn: listResellerEarnings, retry: false });
  const errorText = error ? getAdminFinanceDataError(error) || "Chargement impossible." : "";
  const totalDue = data.reduce((sum, row) => sum + (row.to_pay ?? row.earned), 0);
  const [payoutStatus, setPayoutStatus] = useState("");
  const queryClient = useQueryClient();
  const { data: payments = [] } = useQuery({ queryKey: ["admin-reseller-payments"], queryFn: listResellerPayments, retry: false });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => decideResellerPayment(id, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-reseller-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-resellers"] });
    },
  });
  const payout = useMutation({
    mutationFn: ({ row, amount, reference }: { row: AdminResellerEarning; amount: number; reference: string }) =>
      recordResellerPayout(row.user_id, amount, reference),
    onSuccess: (row) => {
      setPayoutStatus(`Versement enregistré pour ${row.full_name}. Reste à verser : ${formatXOF(row.to_pay ?? 0)}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-reseller-earnings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-resellers"] });
    },
    onError: (error) => setPayoutStatus(getApiErrorMessage(error, "Versement non enregistré.")),
  });
  const askPayout = (row: AdminResellerEarning) => {
    const due = row.to_pay ?? row.earned;
    const typed = window.prompt(`Montant versé à ${row.full_name} par Nita / Amana (reste ${formatXOF(due)}) :`, String(Math.round(due)));
    if (typed === null) return;
    const amount = Number(typed.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayoutStatus("Montant invalide.");
      return;
    }
    const reference = window.prompt("Référence de la transaction (facultatif) :", "") ?? "";
    payout.mutate({ row, amount, reference: reference.trim() });
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Revendeurs</h1>
        <p className="mt-1 text-sm text-ink-600">
          Tous les revendeurs de la plateforme, abonnements à valider et gains nets (après commission AMAZER). Total à verser : {formatXOF(totalDue)}.
        </p>
      </header>
      {errorText ? (
        <p className="text-sm text-danger" role="alert">
          {errorText}{" "}
          {errorText.includes("PIN") ? (
            <Link href="/admin/users" className="font-semibold underline">
              Valider le PIN
            </Link>
          ) : null}
        </p>
      ) : null}
      {payments.length ? (
        <section aria-label="Abonnements à valider" className="space-y-2">
          <h2 className="text-lg font-semibold text-ink-900">Abonnements à valider ({payments.length})</h2>
          <ul className="divide-y divide-border rounded-card border border-border bg-card">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold text-ink-900">
                    {payment.full_name} · {formatXOF(payment.amount_claimed)} ({payment.months} mois)
                  </p>
                  <p className="text-xs text-ink-600">
                    {payment.payment_mode.toUpperCase()} · réf. {payment.transaction_reference} · {payment.contact}
                  </p>
                </div>
                <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: payment.id, decision: "approved" })}>
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: payment.id, decision: "rejected" })}
                >
                  Refuser
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-600">Vérifiez la référence sur votre compte Nita / Amana avant de valider.</p>
        </section>
      ) : null}

      <AllResellers />

      <h2 className="text-lg font-semibold text-ink-900">Gains à verser</h2>
      <p className="text-sm text-ink-600">
        Versez la marge par Nita / Amana, puis cliquez « Enregistrer un versement » : le reste à verser baisse et le revendeur est prévenu.
      </p>
      {payoutStatus ? (
        <p className="rounded-field bg-surface-1 p-3 text-sm text-ink-800" role="status">
          {payoutStatus}
        </p>
      ) : null}
      {isPending ? (
        <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : data.length ? (
        <div className="overflow-x-auto rounded-card border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-1 text-left text-ink-600">
              <tr>
                <th className="px-3 py-2 font-medium">Revendeur</th>
                <th className="px-3 py-2 font-medium">Reste à verser</th>
                <th className="px-3 py-2 font-medium">Déjà versé</th>
                <th className="px-3 py-2 font-medium">En attente</th>
                <th className="px-3 py-2 font-medium">Livrées</th>
                <th className="px-3 py-2 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => (
                <tr key={row.user_id}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-ink-900">{row.full_name}</span>
                    <span className="text-xs text-ink-600">{row.contact}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block font-semibold text-success">{formatXOF(row.to_pay ?? row.earned)}</span>
                    {(row.to_pay ?? row.earned) > 0 ? (
                      <button
                        type="button"
                        disabled={payout.isPending}
                        onClick={() => askPayout(row)}
                        className="mt-1 text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
                      >
                        Enregistrer un versement
                      </button>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-ink-700">{formatXOF(row.paid ?? 0)}</td>
                  <td className="px-3 py-2 text-ink-700">{formatXOF(row.pending)}</td>
                  <td className="px-3 py-2 text-ink-700">{row.orders_delivered}</td>
                  <td className="px-3 py-2">
                    {row.whatsapp_phone ? (
                      <WhatsAppButton
                        phone={row.whatsapp_phone}
                        variant="link"
                        label="WhatsApp"
                        message={`Bonjour ${row.full_name}, votre gain AMAZER de ${formatXOF(row.to_pay ?? row.earned)} est prêt à être versé.`}
                      />
                    ) : (
                      <span className="text-xs text-ink-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !errorText ? (
        <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">Aucun gain revendeur pour le moment.</p>
      ) : null}
    </section>
  );
}
