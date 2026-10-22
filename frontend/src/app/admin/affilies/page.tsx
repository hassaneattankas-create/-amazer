"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AffiliateCard } from "@/components/admin/affiliates/AffiliateCard";
import { AffiliatePayoutsPanel } from "@/components/admin/affiliates/AffiliatePayoutsPanel";
import { formatDate } from "@/components/admin/affiliates/labels";
import { Button } from "@/components/ui/button";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { formatXOF } from "@/lib/currency";
import { listAffiliateEarnings, updateAffiliate } from "@/services/finance-service";

type Tab = "payouts" | "affiliates" | "applications";

/** Affiliation et ambassadeurs : paiements a faire, gains a verifier (fraude), candidatures. Taux dans Tarifs. */
export default function AdminAffiliatesPage() {
  const [tab, setTab] = useState<Tab>("payouts");
  const queryClient = useQueryClient();
  const { data = [], isPending, error } = useQuery({
    queryKey: ["admin-affiliate-earnings"],
    queryFn: listAffiliateEarnings,
    retry: false,
  });
  const decide = useMutation({
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) =>
      updateAffiliate(userId, { tier: accept ? "ambassador" : "affiliate" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-earnings"] }),
  });
  const errorText = error ? getAdminFinanceDataError(error) || "Chargement impossible." : "";
  const toReview = data.reduce((sum, row) => sum + row.review, 0);
  const available = data.reduce((sum, row) => sum + row.available + row.requested, 0);
  const applications = data.filter((row) => row.ambassador_applied_at && row.tier !== "ambassador");
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "payouts", label: "Paiements à faire" },
    { key: "affiliates", label: `Affiliés (${data.length})` },
    { key: "applications", label: `Candidatures (${applications.length})` },
  ];

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Affiliés et ambassadeurs</h1>
        <p className="mt-1 text-sm text-ink-600">
          Dû (disponible ou demandé) : <strong>{formatXOF(available)}</strong> · à vérifier : <strong>{formatXOF(toReview)}</strong>.
          Taux et règles de sécurité :{" "}
          <Link href="/admin/tarifs?vue=reglages" className="font-semibold text-brand-700 hover:underline">
            Tarifs
          </Link>
          .
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

      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? "page" : undefined}
            className={`min-h-11 rounded-pill px-4 text-sm font-semibold ${tab === item.key ? "bg-ink-900 text-white" : "border border-border text-ink-800 hover:bg-surface-1"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "payouts" ? <AffiliatePayoutsPanel /> : null}

      {tab === "affiliates" ? (
        isPending ? (
          <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
        ) : data.length ? (
          <div className="space-y-3">
            {data.map((row) => (
              <AffiliateCard key={row.user_id} row={row} />
            ))}
          </div>
        ) : !errorText ? (
          <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">Aucun affilié actif pour le moment.</p>
        ) : null
      ) : null}

      {tab === "applications" ? (
        applications.length ? (
          <div className="space-y-3">
            {applications.map((row) => (
              <article key={row.user_id} className="space-y-2 rounded-card border border-border bg-card p-4">
                <p className="font-semibold text-ink-900">
                  {row.full_name} <span className="text-sm font-normal text-ink-600">· candidature du {formatDate(row.ambassador_applied_at)}</span>
                </p>
                <p className="text-sm text-ink-700">
                  {row.referred} inscrits via son lien · {formatXOF(row.earned)} de gains · {row.flagged_referrals} inscription(s) suspecte(s)
                </p>
                {row.ambassador_application ? (
                  <blockquote className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">{row.ambassador_application}</blockquote>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ userId: row.user_id, accept: true })}>
                    Nommer ambassadeur
                  </Button>
                  <Button type="button" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ userId: row.user_id, accept: false })}>
                    Refuser
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">
            Aucune candidature. Conseil : nommez d&apos;abord vos meilleurs affiliés (ceux qui ont déjà amené des boutiques payantes).
          </p>
        )
      ) : null}
    </section>
  );
}
