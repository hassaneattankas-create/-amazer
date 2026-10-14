"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { formatXOF } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { decideResellerPayment, listResellerEarnings, listResellerPayments } from "@/services/finance-service";

/** Gains des revendeurs (revente sans stock) : a verser par Nita / Amana apres livraison. */
export default function AdminResellersPage() {
  const { data = [], isPending, error } = useQuery({ queryKey: ["admin-reseller-earnings"], queryFn: listResellerEarnings, retry: false });
  const errorText = error ? getAdminFinanceDataError(error) || "Chargement impossible." : "";
  const totalDue = data.reduce((sum, row) => sum + row.earned, 0);
  const queryClient = useQueryClient();
  const { data: payments = [] } = useQuery({ queryKey: ["admin-reseller-payments"], queryFn: listResellerPayments, retry: false });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => decideResellerPayment(id, decision),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-reseller-payments"] }),
  });

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Revendeurs</h1>
        <p className="mt-1 text-sm text-ink-600">
          Abonnements à valider et gains nets (après commission AMAZER) des revendeurs. Total à verser : {formatXOF(totalDue)}.
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

      <h2 className="text-lg font-semibold text-ink-900">Gains à verser</h2>
      {isPending ? (
        <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : data.length ? (
        <div className="overflow-x-auto rounded-card border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-1 text-left text-ink-600">
              <tr>
                <th className="px-3 py-2 font-medium">Revendeur</th>
                <th className="px-3 py-2 font-medium">Gagné</th>
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
                  <td className="px-3 py-2 font-semibold text-success">{formatXOF(row.earned)}</td>
                  <td className="px-3 py-2 text-ink-700">{formatXOF(row.pending)}</td>
                  <td className="px-3 py-2 text-ink-700">{row.orders_delivered}</td>
                  <td className="px-3 py-2">
                    {row.whatsapp_phone ? (
                      <WhatsAppButton
                        phone={row.whatsapp_phone}
                        variant="link"
                        label="WhatsApp"
                        message={`Bonjour ${row.full_name}, votre gain AMAZER de ${formatXOF(row.earned)} est prêt à être versé.`}
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
