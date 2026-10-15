"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { formatXOF } from "@/lib/currency";
import { listAffiliateEarnings } from "@/services/finance-service";

/** Commissions d'affiliation : a verser apres livraison (Nita / Amana). */
export default function AdminAffiliatesPage() {
  const { data = [], isPending, error } = useQuery({
    queryKey: ["admin-affiliate-earnings"],
    queryFn: listAffiliateEarnings,
    retry: false,
  });
  const errorText = error ? getAdminFinanceDataError(error) || "Chargement impossible." : "";
  const totalDue = data.reduce((sum, row) => sum + row.earned, 0);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Affiliés</h1>
        <p className="mt-1 text-sm text-ink-600">Commissions sur les ventes apportées. Total à verser : {formatXOF(totalDue)}.</p>
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
      {isPending ? (
        <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : data.length ? (
        <div className="overflow-x-auto rounded-card border border-border bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-surface-1 text-left text-ink-600">
              <tr>
                <th className="px-3 py-2 font-medium">Affilié</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Visites</th>
                <th className="px-3 py-2 font-medium">À verser</th>
                <th className="px-3 py-2 font-medium">En attente</th>
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
                  <td className="px-3 py-2 font-mono">{row.code}</td>
                  <td className="px-3 py-2 text-ink-700">{row.clicks}</td>
                  <td className="px-3 py-2 font-semibold text-success">{formatXOF(row.earned)}</td>
                  <td className="px-3 py-2 text-ink-700">{formatXOF(row.pending)}</td>
                  <td className="px-3 py-2">
                    {row.whatsapp_phone ? (
                      <WhatsAppButton
                        phone={row.whatsapp_phone}
                        variant="link"
                        label="WhatsApp"
                        message={`Bonjour ${row.full_name}, votre commission AMAZER de ${formatXOF(row.earned)} est prête à être versée.`}
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
        <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">
          Aucune commission d&apos;affiliation pour le moment.
        </p>
      ) : null}
    </section>
  );
}
