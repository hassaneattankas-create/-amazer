"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Wallet } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import { getSellerPlanEarnings } from "@/services/seller-service";

const percent = (rate: number) => `${Number((rate * 100).toFixed(1)).toLocaleString("fr-FR")} %`;
const formatDay = (value: string | null) => (value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "");

/** Boutique : formule (gratuite ou abonnement) et argent des ventes reversé par AMAZER. */
export function ShopPlanCard() {
  const { data, isPending, isError } = useQuery({ queryKey: ["seller-plan-earnings"], queryFn: getSellerPlanEarnings, staleTime: 60_000 });

  if (isPending) return <div className="h-40 animate-pulse rounded-card border border-border bg-surface-1" aria-busy="true" />;
  if (isError || !data || !data.eligible_free_plan) return null;

  const free = data.plan === "free";
  const limit = data.max_visible_products ?? data.free_plan_max_products;
  return (
    <section aria-label="Ma formule et mon argent" className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-card border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <BadgeCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
          {free ? "Formule gratuite" : "Abonnement Boutique"}
        </p>
        {free ? (
          <>
            <p className="mt-2 text-sm text-ink-700">
              <strong className="text-ink-900">
                {data.visible_products} / {limit}
              </strong>{" "}
              produits visibles · AMAZER garde {percent(data.commission_rate)} sur chaque vente.
            </p>
            <p className="mt-1 text-xs text-ink-600">Votre boutique reste en ligne. Vos autres produits sont mis de côté, pas supprimés.</p>
            <Link href="/seller" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
              Prendre l&apos;abonnement : produits illimités, 0 % de commission
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-700">
            Produits illimités, sans commission{data.subscription_paid_until ? ` · jusqu'au ${formatDay(data.subscription_paid_until)}` : ""}. Ensuite, votre
            boutique passe en formule gratuite ({data.free_plan_max_products} produits, {percent(data.free_plan_commission_rate)} par vente) si vous ne renouvelez pas.
          </p>
        )}
      </div>

      <div className="rounded-card border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Wallet className="h-4 w-4 text-brand-600" aria-hidden="true" />
          L&apos;argent de vos ventes
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-ink-600">À recevoir</dt>
            <dd className="font-semibold text-success">{formatXOF(data.to_receive)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-600">Pas encore livré</dt>
            <dd className="font-semibold text-ink-900">{formatXOF(data.awaiting_delivery)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-600">Déjà reçu</dt>
            <dd className="font-semibold text-ink-900">{formatXOF(data.received)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-600">Commission AMAZER</dt>
            <dd className="font-semibold text-ink-900">{formatXOF(data.commission_total)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-600">
          Les clients paient AMAZER ; dès qu&apos;une commande est livrée, AMAZER vous reverse votre part sur votre numéro de reversement (« Profil et
          abonnement »).
        </p>
      </div>
    </section>
  );
}
