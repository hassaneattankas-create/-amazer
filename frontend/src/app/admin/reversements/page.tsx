"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { listVendorPayouts, recordVendorPayout, type AdminVendorPayout } from "@/services/finance-service";

const STATE_LABELS = {
  due: { label: "À reverser", className: "bg-success/10 text-success" },
  waiting: { label: "Pas encore livrée", className: "bg-surface-2 text-ink-700" },
  paid: { label: "Reversée", className: "bg-surface-2 text-ink-600" },
  blocked: { label: "Litige ou remboursement", className: "bg-danger/10 text-danger" },
} as const;

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—");
const percent = (rate: number) => `${Number((rate * 100).toFixed(1)).toLocaleString("fr-FR")} %`;

/** Une boutique (section dépliable) : ce qu'AMAZER lui doit, le détail et le bouton « Reversé ». */
function VendorSection({ row, busy, onPay }: { row: AdminVendorPayout; busy: boolean; onPay: (row: AdminVendorPayout) => void }) {
  return (
    <AccordionItem
      id={row.vendor_id}
      headingLevel={2}
      title={row.name}
      description={`Numéro de reversement : ${row.payout_phone || "non renseigné (à lui demander)"}`}
      meta={row.to_pay > 0 ? `À reverser ${formatXOF(row.to_pay)}` : "Rien à reverser"}
      tone={row.to_pay > 0 ? "warning" : "default"}
    >
      <div className="space-y-3 text-sm">
        <p className="text-ink-700">
          À reverser : <strong className="text-success">{formatXOF(row.to_pay)}</strong> ({row.orders_to_pay} commande{row.orders_to_pay > 1 ? "s" : ""}
          {row.to_pay_commission > 0 ? `, commission ${formatXOF(row.to_pay_commission)} déduite` : ""}) · Pas encore livré : {formatXOF(row.awaiting_delivery)} ·
          Déjà reversé : {formatXOF(row.paid)} · Commission AMAZER au total : {formatXOF(row.commission_total)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {row.to_pay > 0 ? (
            <Button size="sm" disabled={busy} onClick={() => onPay(row)}>
              Reversé
            </Button>
          ) : null}
          {row.payout_phone ? (
            <WhatsAppButton
              phone={row.payout_phone}
              variant="link"
              label="WhatsApp"
              message={`Bonjour ${row.name}, AMAZER vous reverse ${formatXOF(row.to_pay)} pour vos ventes livrées.`}
            />
          ) : null}
        </div>
        {row.lines.length ? (
          <ul className="divide-y divide-border rounded-field border border-border">
            {row.lines.map((line) => {
              const badge = STATE_LABELS[line.state];
              return (
                <li key={line.order_id} className="flex flex-wrap items-center gap-2 p-2 text-xs">
                  <span className="font-medium text-ink-900">{line.tracking_code ?? line.order_id.slice(0, 8)}</span>
                  <span className="text-ink-600">{formatDate(line.created_at)}</span>
                  <span className={`rounded-pill px-2 py-0.5 font-medium ${badge.className}`}>{badge.label}</span>
                  <span className="ml-auto text-ink-800">
                    {formatXOF(line.amount)}
                    {line.commission > 0 ? ` − ${percent(line.commission_rate)} (${formatXOF(line.commission)})` : ""} = <strong>{formatXOF(line.net)}</strong>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </AccordionItem>
  );
}

/** Reversements aux boutiques : l'argent des commandes de boutiques arrive sur le compte AMAZER. */
export default function AdminVendorPayoutsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const { data = [], isPending, error, refetch } = useQuery({ queryKey: ["admin-vendor-payouts"], queryFn: listVendorPayouts, retry: false });
  const errorText = error ? getAdminFinanceDataError(error) || "Chargement impossible." : "";
  const totalDue = data.reduce((sum, row) => sum + row.to_pay, 0);
  const commission = data.reduce((sum, row) => sum + row.commission_total, 0);

  const pay = useMutation({
    mutationFn: ({ row, reference }: { row: AdminVendorPayout; reference: string }) => recordVendorPayout(row.vendor_id, reference),
    onSuccess: (row) => {
      setStatus(`Reversement enregistré pour ${row.name}. La boutique est prévenue.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-vendor-payouts"] });
    },
    onError: (err) => setStatus(getApiErrorMessage(err, "Reversement non enregistré.")),
  });
  const askPay = (row: AdminVendorPayout) => {
    const ok = window.confirm(`Avez-vous envoyé ${formatXOF(row.to_pay)} à ${row.name}${row.payout_phone ? ` (${row.payout_phone})` : ""} ?`);
    if (!ok) return;
    const reference = window.prompt("Référence de la transaction (facultatif) :", "") ?? "";
    pay.mutate({ row, reference: reference.trim() });
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Reversements aux boutiques</h1>
        <p className="mt-1 text-sm text-ink-600">
          Les clients des boutiques paient sur le compte AMAZER. Quand une commande est livrée et payée, sa part revient à la boutique, moins la commission
          de la formule gratuite. Envoyez l&apos;argent (Nita, Amana, Wave, Airtel Money), puis cliquez « Reversé ».
        </p>
        <p className="mt-2 text-sm font-semibold text-ink-900">
          À reverser : {formatXOF(totalDue)} · Commission AMAZER gagnée : {formatXOF(commission)}
        </p>
      </header>
      {status ? (
        <p className="rounded-field bg-surface-1 p-3 text-sm text-ink-800" role="status">
          {status}
        </p>
      ) : null}
      {isPending ? (
        <div className="h-32 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : errorText ? (
        <div className="space-y-2">
          <p className="text-sm text-danger" role="alert">
            {errorText}{" "}
            {errorText.includes("PIN") ? (
              <Link href="/admin/users" className="font-semibold underline">
                Valider le PIN
              </Link>
            ) : null}
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      ) : data.length ? (
        <Accordion>
          {data.map((row) => (
            <VendorSection key={row.vendor_id} row={row} busy={pay.isPending} onPay={askPay} />
          ))}
        </Accordion>
      ) : (
        <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">
          Aucune vente de boutique à suivre pour le moment. Les commandes passées à partir d&apos;aujourd&apos;hui apparaîtront ici.
        </p>
      )}
    </section>
  );
}
