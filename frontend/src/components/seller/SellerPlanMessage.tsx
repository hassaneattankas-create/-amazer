"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";

import { AccordionItem } from "@/components/ui/accordion";
import { formatXOF } from "@/lib/currency";
import { getSellerPlanEarnings, type SellerPlanEarnings } from "@/services/seller-service";

const formatDay = (value: string | null) => (value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "");
const percent = (rate: number) => `${Number((rate * 100).toFixed(1)).toLocaleString("fr-FR")} %`;

const LABEL: Record<SellerPlanEarnings["kind"], string> = {
  shop: "Boutique",
  restaurant: "Restaurant",
  premium: "Premium",
  pharmacy: "Pharmacie (Premium)",
  fuel_station: "Stations-essence (Premium)",
};

/** Ce qui arrive sans paiement : l'établissement disparaît du public, ses données restent. */
const WITHOUT_PAYMENT: Record<Exclude<SellerPlanEarnings["kind"], "shop">, string> = {
  restaurant: "votre restaurant n'est plus visible des clients et ne reçoit plus de commandes",
  premium: "votre vitrine n'est plus visible des clients et ne reçoit plus de commandes ni de réservations",
  pharmacy: "votre pharmacie et vos gardes ne sont plus visibles des clients",
  fuel_station: "vos stations ne sont plus visibles sur la liste et la carte",
};

export type PlanText = { title: string; lines: string[]; showSubscribe: boolean };

/** Message de chaque formule : ce que le vendeur a maintenant, et ce qui l'attend ensuite. */
export function planText(data: SellerPlanEarnings): PlanText {
  const fee = `${formatXOF(data.monthly_fee)} par mois`;
  const until = formatDay(data.subscription_paid_until);
  const free = `${data.free_plan_max_products} produits visibles, AMAZER garde ${percent(data.free_plan_commission_rate)} de chaque vente`;
  if (data.kind === "shop") {
    if (data.plan === "free") {
      return {
        title: "Formule gratuite",
        lines: [
          `${data.visible_products} / ${data.max_visible_products ?? data.free_plan_max_products} produits visibles. AMAZER garde ${percent(data.commission_rate)} de chaque vente avant de vous reverser votre part.`,
          "Votre boutique reste en ligne. Vos autres produits sont mis de côté, pas supprimés.",
          `Abonnement Boutique : ${fee}, produits illimités et 0 % de commission. Vous pouvez le prendre à tout moment.`,
        ],
        showSubscribe: true,
      };
    }
    if (data.in_trial) {
      return {
        title: `Essai gratuit jusqu'au ${until}`,
        lines: [
          "Pendant l'essai : produits illimités, sans commission.",
          `Ensuite, vous choisissez : continuer gratuitement (${free}) ou prendre l'abonnement Boutique à ${fee} (produits illimités, 0 % de commission).`,
          "Dans les deux cas, votre boutique reste en ligne.",
        ],
        showSubscribe: true,
      };
    }
    return {
      title: `Abonnement Boutique jusqu'au ${until}`,
      lines: [
        `Produits illimités, sans commission (${fee}).`,
        `Sans renouvellement, votre boutique reste en ligne en formule gratuite : ${free}.`,
      ],
      showSubscribe: false,
    };
  }
  const label = LABEL[data.kind];
  const consequence = WITHOUT_PAYMENT[data.kind];
  const stationsNote = data.kind === "fuel_station" ? ["Le prix dépend du nombre de stations de votre marque."] : [];
  if (data.plan === "inactive") {
    return {
      title: `Abonnement ${label} à renouveler`,
      lines: [`Sans abonnement, ${consequence}. Vos données sont gardées.`, `Renouvelez pour ${fee} dans « Profil et abonnement ».`, ...stationsNote],
      showSubscribe: true,
    };
  }
  if (data.in_trial) {
    return {
      title: `Essai gratuit jusqu'au ${until}`,
      lines: [
        "Tout est inclus pendant l'essai.",
        `Ensuite, l'abonnement ${label} coûte ${fee}.`,
        `Sans paiement à la fin de l'essai, ${consequence} jusqu'au paiement. Vos données sont gardées.`,
        ...stationsNote,
      ],
      showSubscribe: true,
    };
  }
  return {
    title: `Abonnement ${label} jusqu'au ${until}`,
    lines: [`${fee}.`, `Renouvelez avant cette date : sans paiement, ${consequence} jusqu'au paiement. Vos données sont gardées.`, ...stationsNote],
    showSubscribe: false,
  };
}

/** Le message seul (titre + lignes), réutilisé dans l'espace vendeur et la page abonnement. */
export function SellerPlanMessage({ data, withLink = true }: { data: SellerPlanEarnings; withLink?: boolean }) {
  const text = planText(data);
  return (
    <div className="space-y-2 text-sm text-ink-700">
      <p className="font-semibold text-ink-900">{text.title}</p>
      <ul className="list-disc space-y-1 pl-5">
        {text.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {withLink && text.showSubscribe ? (
        <Link href="/seller" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
          Voir l&apos;abonnement et payer
        </Link>
      ) : null}
    </div>
  );
}

/** Section « Ma formule » de l'espace vendeur (à placer dans un Accordion). */
export function SellerPlanItem({ headingLevel = 3 }: { headingLevel?: 2 | 3 | 4 }) {
  const { data } = useQuery({ queryKey: ["seller-plan-earnings"], queryFn: getSellerPlanEarnings, staleTime: 60_000 });
  if (!data) return null;
  const text = planText(data);
  return (
    <AccordionItem
      id="plan"
      variant="row"
      headingLevel={headingLevel}
      icon={<BadgeCheck className="h-5 w-5" />}
      title="Ma formule"
      meta={data.plan === "free" ? `Gratuite · ${data.visible_products}/${data.max_visible_products ?? data.free_plan_max_products}` : data.in_trial ? "Essai" : data.plan === "inactive" ? "À renouveler" : "Abonnement"}
      tone={data.plan === "inactive" ? "warning" : "default"}
      description={text.title}
    >
      <SellerPlanMessage data={data} />
    </AccordionItem>
  );
}
