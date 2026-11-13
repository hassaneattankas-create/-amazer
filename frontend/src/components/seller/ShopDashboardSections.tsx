"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, BarChart3, Wallet } from "lucide-react";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { formatXOF } from "@/lib/currency";
import { getSellerPlanEarnings, type SellerPlanEarnings } from "@/services/seller-service";

const percent = (rate: number) => `${Number((rate * 100).toFixed(1)).toLocaleString("fr-FR")} %`;
const formatDay = (value: string | null) => (value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "");
const icon = "h-5 w-5";

function PlanDetails({ data }: { data: SellerPlanEarnings }) {
  if (data.plan !== "free") {
    return (
      <p className="text-sm text-ink-700">
        Produits illimités, sans commission{data.subscription_paid_until ? ` · jusqu'au ${formatDay(data.subscription_paid_until)}` : ""}. Si vous ne
        renouvelez pas, votre boutique reste en ligne en formule gratuite ({data.free_plan_max_products} produits visibles,{" "}
        {percent(data.free_plan_commission_rate)} par vente).
      </p>
    );
  }
  const limit = data.max_visible_products ?? data.free_plan_max_products;
  return (
    <div className="space-y-2 text-sm text-ink-700">
      <p>
        <strong className="text-ink-900">
          {data.visible_products} / {limit}
        </strong>{" "}
        produits visibles · AMAZER garde {percent(data.commission_rate)} sur chaque vente.
      </p>
      <p className="text-xs text-ink-600">Votre boutique reste en ligne. Vos autres produits sont mis de côté, pas supprimés.</p>
      <Link href="/seller" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
        Prendre l&apos;abonnement : produits illimités, 0 % de commission
      </Link>
    </div>
  );
}

function EarningsDetails({ data }: { data: SellerPlanEarnings }) {
  const cells: [string, number, string][] = [
    ["À recevoir", data.to_receive, "text-success"],
    ["Pas encore livré", data.awaiting_delivery, "text-ink-900"],
    ["Déjà reçu", data.received, "text-ink-900"],
    ["Commission AMAZER", data.commission_total, "text-ink-900"],
  ];
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {cells.map(([label, value, tone]) => (
          <div key={label}>
            <dt className="text-xs text-ink-600">{label}</dt>
            <dd className={`font-semibold ${tone}`}>{formatXOF(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-600">
        Les clients paient AMAZER ; dès qu&apos;une commande est livrée, AMAZER vous reverse votre part sur votre numéro de reversement (« Profil et
        abonnement »).
      </p>
    </div>
  );
}

/**
 * Accueil d'une boutique, en sections dépliables : chiffres (ouverts), formule, argent des ventes.
 * `kpis` : le bloc de chiffres existant, rangé dans la première section.
 */
export function ShopDashboardSections({ kpis }: { kpis: ReactNode }) {
  const { data } = useQuery({ queryKey: ["seller-plan-earnings"], queryFn: getSellerPlanEarnings, staleTime: 60_000 });
  const showPlan = Boolean(data?.eligible_free_plan);
  return (
    <Accordion defaultOpen="kpis">
      <AccordionItem id="kpis" headingLevel={2} icon={<BarChart3 className={icon} />} title="Mes chiffres">
        {kpis}
      </AccordionItem>
      {showPlan && data ? (
        <>
          <AccordionItem
            id="plan"
            headingLevel={2}
            icon={<BadgeCheck className={icon} />}
            title="Ma formule"
            meta={data.plan === "free" ? `Gratuite · ${data.visible_products}/${data.max_visible_products ?? data.free_plan_max_products}` : "Abonnement"}
          >
            <PlanDetails data={data} />
          </AccordionItem>
          <AccordionItem
            id="money"
            headingLevel={2}
            icon={<Wallet className={icon} />}
            title="L'argent de mes ventes"
            meta={data.to_receive > 0 ? `À recevoir ${formatXOF(data.to_receive)}` : undefined}
          >
            <EarningsDetails data={data} />
          </AccordionItem>
        </>
      ) : null}
    </Accordion>
  );
}
