"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { getPublicFinanceSettings } from "@/services/finance-service";
import type { FinanceSettings } from "@/types/finance";

type Plan = {
  key: "shop" | "restaurant" | "premium";
  name: string;
  icon: LucideIcon;
  audience: string;
  price: (pricing: FinanceSettings) => number;
  features: (pricing: FinanceSettings) => string[];
  highlighted?: boolean;
};

// Grille de formules a la Shopify : une offre claire par metier, prix reels de la plateforme.
const PLANS: Plan[] = [
  {
    key: "shop",
    name: "Boutique",
    icon: Store,
    audience: "Commerces, revendeurs, artisans",
    price: (p) => p.seller_subscription_fee_shop,
    features: (p) => [
      `Jusqu'à ${p.max_products_basic_tier} produits`,
      "Boutique en ligne et messagerie clients",
      "Paiement contrôlé par AMAZER",
      "Livraison par les livreurs AMAZER",
    ],
  },
  {
    key: "restaurant",
    name: "Restaurant",
    icon: UtensilsCrossed,
    audience: "Restaurants, fast-food, traiteurs",
    price: (p) => p.seller_subscription_fee_restaurant,
    features: () => ["Menu en ligne avec photos", "Plat du jour mis en avant", "Commandes et réservations de tables"],
  },
  {
    key: "premium",
    name: "Premium",
    icon: Crown,
    audience: "Hôtels, transport, grandes entreprises",
    price: (p) => p.seller_subscription_fee_premium,
    highlighted: true,
    features: () => [
      "Produits illimités",
      "Site vitrine complet et badge vérifié",
      "Réservations : chambres, trajets, services",
      "Mise en avant dans l'espace Premium",
    ],
  },
];

const STEPS = ["Créez votre boutique : elle est en ligne tout de suite", "Publiez vos produits et vendez", "Payez l'abonnement après l'essai gratuit"];

export default function VendrePage() {
  const { data: pricing, isPending, isError } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });
  const discount = pricing?.seller_launch_discount_percent ?? 0;
  const trialDays = pricing?.seller_trial_days ?? 0;

  return (
    <section className="mx-auto w-full max-w-6xl px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-8 text-center text-white sm:px-8">
        <h1 className="text-display-sm font-semibold tracking-display">Vendez sur AMAZER</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">Ouvrez votre boutique en ligne et touchez plus de clients.</p>
        <ol className="mx-auto mt-5 grid max-w-3xl gap-2 text-left text-sm sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-2 rounded-field bg-white/10 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-brand-600 text-xs font-bold">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        {trialDays > 0 || discount > 0 ? (
          <p className="mx-auto mt-4 inline-flex rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-semibold">
            Offre de lancement :{trialDays > 0 ? ` ${trialDays} jours d'essai gratuit` : ""}
            {trialDays > 0 && discount > 0 ? " ·" : ""}
            {discount > 0 ? ` -${discount}% sur l'abonnement` : ""}
          </p>
        ) : null}
      </header>

      <h2 className="mt-8 text-lg font-semibold text-ink-900">Choisissez votre formule</h2>
      {isPending ? (
        <div className="mt-3 grid gap-4 md:grid-cols-3" aria-busy="true">
          {PLANS.map((plan) => (
            <div key={plan.key} className="h-80 animate-pulse rounded-card bg-surface-3" />
          ))}
        </div>
      ) : isError || !pricing ? (
        <p className="mt-3 text-sm text-ink-700">Tarifs indisponibles pour le moment. Réessayez dans un instant.</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <article
                key={plan.key}
                className={`flex flex-col rounded-card border bg-card p-5 ${
                  plan.highlighted ? "border-brand-500 shadow-raised" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
                    <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
                    {plan.name}
                  </h3>
                  {plan.highlighted ? (
                    <span className="rounded-pill bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">Le plus complet</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink-600">{plan.audience}</p>
                <p className="mt-4">
                  <span className="text-3xl font-bold text-ink-900">{formatXOF(plan.price(pricing))}</span>
                  <span className="text-sm text-ink-600"> / mois</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-800">
                  {plan.features(pricing).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" variant={plan.highlighted ? "default" : "outline"} className="mt-5 w-full">
                  <Link href={`/register?next=/seller&seller=1&type=${plan.key === "premium" ? "enterprise" : plan.key}`}>
                    Choisir {plan.name}
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <aside className="mt-6 flex flex-col items-start gap-3 rounded-card border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink-900">Pas de stock ? Revendez sans boutique.</p>
          <p className="text-sm text-ink-600">Choisissez des produits AMAZER, fixez votre prix, partagez votre lien et gardez la marge.</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/revendre">Revendre sans stock</Link>
        </Button>
      </aside>

      {pricing ? (
        <article className="mt-6 rounded-card border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">Frais transparents</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-600">Commission par vente</dt>
              <dd className="font-semibold text-ink-900">
                {pricing.launch_mode_zero_commission ? "0 % (lancement)" : `${Number((pricing.commission_rate * 100).toFixed(1)).toLocaleString("fr-FR")} %`}
              </dd>
            </div>
            <div>
              <dt className="text-ink-600">Frais de service par commande</dt>
              <dd className="font-semibold text-ink-900">{formatXOF(pricing.service_fee)}</dd>
            </div>
            <div>
              <dt className="text-ink-600">Livraison (payée par le client)</dt>
              <dd className="font-semibold text-ink-900">dès {formatXOF(pricing.default_delivery_fee)}</dd>
            </div>
          </dl>
        </article>
      ) : null}
    </section>
  );
}
