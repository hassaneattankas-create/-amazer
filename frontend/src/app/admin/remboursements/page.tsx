"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { formatDate, PAYOUT_METHOD } from "@/components/admin/affiliates/labels";
import { Button } from "@/components/ui/button";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { AdminRefund, decideRefund, listRefunds } from "@/services/finance-service";

const SOURCE: Record<AdminRefund["source"], string> = { order: "Commande boutique", restaurant_order: "Commande restaurant" };

/** Remboursements a faire : commandes payees puis annulees (AMAZER) ou refusees (restaurant). */
export default function AdminRefundsPage() {
  const [view, setView] = useState<"to_refund" | "all">("to_refund");
  const { data = [], isPending, error } = useQuery({ queryKey: ["admin-refunds", view], queryFn: () => listRefunds(view), retry: false });
  const errorText = error ? getAdminFinanceDataError(error) || "Chargement impossible." : "";
  const due = data.filter((row) => row.status === "to_refund").reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Remboursements</h1>
        <p className="mt-1 text-sm text-ink-600">
          Commandes payées puis annulées ou refusées. À rembourser : <strong>{formatXOF(due)}</strong>. Envoyez l&apos;argent par Nita ou Amana,
          puis saisissez la référence : le client est prévenu.
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
      <div className="flex gap-2">
        {(["to_refund", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`min-h-11 rounded-pill px-4 text-sm font-semibold ${view === key ? "bg-ink-900 text-white" : "border border-border text-ink-800"}`}
          >
            {key === "to_refund" ? "À rembourser" : "Historique"}
          </button>
        ))}
      </div>
      {isPending ? (
        <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : data.length ? (
        <div className="space-y-3">
          {data.map((row) => (
            <RefundCard key={row.id} row={row} />
          ))}
        </div>
      ) : !errorText ? (
        <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">
          {view === "to_refund" ? "Aucun remboursement en attente." : "Aucun remboursement pour le moment."}
        </p>
      ) : null}
    </section>
  );
}

function RefundCard({ row }: { row: AdminRefund }) {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof decideRefund>[1]) => decideRefund(row.id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-refunds"] }),
    onError: (err) => setError(getApiErrorMessage(err, "Action impossible.")),
  });
  const open = row.status === "to_refund";
  return (
    <article className="space-y-3 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink-900">{row.customer_name}</p>
          <p className="text-sm text-ink-600">
            {SOURCE[row.source]} #{row.source_id.slice(0, 8).toUpperCase()} · {row.reason} · {formatDate(row.created_at)}
          </p>
          <p className="text-sm text-ink-800">
            Payé par {PAYOUT_METHOD[row.method ?? ""] ?? row.method ?? "—"} · <span className="font-mono">{row.phone ?? "numéro inconnu"}</span>
          </p>
        </div>
        <p className="text-xl font-bold text-ink-900">{formatXOF(row.amount)}</p>
      </div>
      {open ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-0 flex-1 text-sm font-medium text-ink-800">
            Référence du virement
            <input
              className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ex. NT2610160045"
            />
          </label>
          <Button type="button" disabled={!reference.trim() || mutation.isPending} onClick={() => mutation.mutate({ action: "refunded", reference: reference.trim() })}>
            Remboursé
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => {
              const note = window.prompt("Pourquoi aucun remboursement n'est nécessaire ?", "Client remboursé autrement");
              if (note) mutation.mutate({ action: "not_needed", note });
            }}
          >
            Pas nécessaire
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-700">
          {row.status === "refunded" ? `Remboursé le ${formatDate(row.processed_at)} · réf. ${row.reference}` : `Classé sans remboursement · ${row.admin_note ?? ""}`}
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
