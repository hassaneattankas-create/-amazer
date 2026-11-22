"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bus } from "lucide-react";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { getTransportCommissions, recordTransportCommission } from "@/services/finance-service";
import type { TransportCommissionRow } from "@/types/finance";

const MODE_LABEL = { subscription: "Abonnement", commission: "Commission par billet", both: "Abonnement + commission" } as const;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-15T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Une compagnie : billets du mois, commission due, déjà encaissé, et l'enregistrement d'un encaissement. */
function CompanyRow({ row, month }: { row: TransportCommissionRow; month: string }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(row.to_collect > 0 ? String(row.to_collect) : "");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const record = useMutation({
    mutationFn: () => recordTransportCommission(row.vendor_id, month, Number(amount), reference.trim()),
    onSuccess: (report) => {
      queryClient.setQueryData(["admin-transport-commissions", month], report);
      setReference("");
      setStatus({ ok: true, text: "Encaissement enregistré." });
    },
    onError: (error) => setStatus({ ok: false, text: getApiErrorMessage(error, "Enregistrement impossible.") }),
  });

  return (
    <AccordionItem
      id={row.vendor_id}
      title={row.business_name}
      description={`${MODE_LABEL[row.billing_mode]} · ${row.commission_percent} % par billet`}
      meta={row.to_collect > 0 ? `${formatXOF(row.to_collect)} à encaisser` : "À jour"}
      tone={row.to_collect > 0 ? "warning" : "default"}
    >
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-600">Billets confirmés</dt>
          <dd className="font-semibold text-ink-900">{row.tickets}</dd>
        </div>
        <div>
          <dt className="text-ink-600">Ventes de billets</dt>
          <dd className="font-semibold text-ink-900">{formatXOF(row.sales)}</dd>
        </div>
        <div>
          <dt className="text-ink-600">Commission due</dt>
          <dd className="font-semibold text-ink-900">{formatXOF(row.commission)}</dd>
        </div>
        <div>
          <dt className="text-ink-600">Déjà encaissé</dt>
          <dd className="font-semibold text-ink-900">{formatXOF(row.collected)}</dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-ink-800">
          Montant encaissé (XOF)
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
          />
        </label>
        <label className="text-sm font-medium text-ink-800">
          Référence du paiement (facultatif)
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="ID de transaction"
            className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
          />
        </label>
        <Button
          type="button"
          disabled={record.isPending || !(Number(amount) > 0)}
          onClick={() => record.mutate()}
          className="h-11 bg-brand-600 text-white hover:bg-brand-700"
        >
          {record.isPending ? "Enregistrement…" : "Encaissé"}
        </Button>
      </div>
      {status ? (
        <p role={status.ok ? "status" : "alert"} className={`mt-2 text-sm ${status.ok ? "text-success" : "text-danger"}`}>
          {status.text}
        </p>
      ) : null}
    </AccordionItem>
  );
}

/** Commissions transport : ce que chaque compagnie doit à AMAZER sur les billets du mois (le client paie la compagnie). */
export default function AdminTransportPage() {
  const [month, setMonth] = useState(currentMonth);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin-transport-commissions", month],
    queryFn: () => getTransportCommissions(month),
    retry: false,
  });
  const errorText = error ? getAdminFinanceDataError(error) || "Chargement impossible." : "";

  return (
    <section className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink-900">
          <Bus className="h-6 w-6 text-brand-600" aria-hidden="true" />
          Commissions transport
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Compagnies en mode « commission » ou « abonnement + commission » : part d&apos;AMAZER sur les billets confirmés dont le voyage
          tombe dans le mois. Le mode et le taux se règlent sur la fiche de la compagnie dans{" "}
          <Link href="/admin/tarifs" className="font-semibold text-brand-700 hover:underline">
            Vendeurs et tarifs
          </Link>
          .
        </p>
      </header>
      <label className="block max-w-xs text-sm font-medium text-ink-800">
        Mois
        <input
          type="month"
          value={month}
          onChange={(event) => event.target.value && setMonth(event.target.value)}
          className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
        />
      </label>

      {isPending ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1].map((key) => (
            <div key={key} className="h-20 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      ) : errorText ? (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-ink-900">
          {errorText}{" "}
          <Button type="button" variant="outline" className="ml-2" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      ) : data && data.rows.length ? (
        <>
          <p className="text-sm text-ink-800">
            {monthLabel(data.month)} : commission totale <strong>{formatXOF(data.total_commission)}</strong> · reste à encaisser{" "}
            <strong>{formatXOF(data.total_to_collect)}</strong>.
          </p>
          <Accordion className="space-y-3">
            {data.rows.map((row) => (
              <CompanyRow key={`${row.vendor_id}-${data.month}`} row={row} month={data.month} />
            ))}
          </Accordion>
        </>
      ) : (
        <div className="rounded-card border border-border bg-card p-5 text-sm text-ink-700">
          <p className="font-semibold text-ink-900">Aucune compagnie à la commission pour le moment.</p>
          <p className="mt-1">
            Pour en passer une à la commission : Vendeurs et tarifs → fiche de la compagnie → « Facturation de la compagnie ».
          </p>
        </div>
      )}
    </section>
  );
}
