"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Wallet } from "lucide-react";

import { SellerPlanItem } from "@/components/seller/SellerPlanMessage";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { formatXOF } from "@/lib/currency";
import { getSellerPlanEarnings, type SellerPlanEarnings } from "@/services/seller-service";

const icon = "h-5 w-5";

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
 * Accueil d'une boutique (dans la section « Accueil »), en sous-sections dépliables : chiffres (ouverts), formule, argent des ventes.
 * `kpis` : le bloc de chiffres existant, rangé dans la première section.
 */
export function ShopDashboardSections({ kpis }: { kpis: ReactNode }) {
  const { data } = useQuery({ queryKey: ["seller-plan-earnings"], queryFn: getSellerPlanEarnings, staleTime: 60_000 });
  const showPlan = Boolean(data?.eligible_free_plan);
  return (
    <Accordion defaultOpen="kpis">
      <AccordionItem id="kpis" variant="row" headingLevel={3} icon={<BarChart3 className={icon} />} title="Mes chiffres">
        {kpis}
      </AccordionItem>
      {showPlan && data ? (
        <>
          <SellerPlanItem />
          <AccordionItem
            id="money"
            variant="row"
            headingLevel={3}
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
