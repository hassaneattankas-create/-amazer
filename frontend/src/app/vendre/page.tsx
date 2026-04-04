"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Rocket, Store } from "lucide-react";

import { PremiumSellerPitch } from "@/components/PremiumSellerPitch";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { getPublicFinanceSettings } from "@/services/finance-service";

export default function VendrePage() {
  const { data: pricing } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-gradient-to-br from-white to-orange-50 p-6">
        <h1 className="luxury-title inline-flex items-center gap-2 text-3xl font-semibold">
          <Store className="h-6 w-6 text-[#FF4D00]" />
          Devenir vendeur AMAZER
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Cette rubrique est reservee aux vendeurs (boutique, restaurant ou premium entreprise).
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
          <li>Creer ou connecter votre compte client</li>
          <li>Choisir votre profil (boutique, restaurant ou premium entreprise)</li>
          <li>Publier vos offres depuis l&apos;espace vendeur</li>
        </ol>
        <Button
          asChild
          className="primary-glow-btn mt-5 bg-[#FF4D00] text-white hover:bg-[#e74700]"
        >
          <Link href="/register?next=/seller&seller=1">
            <Rocket className="h-4 w-4" />
            Ouvrir mon espace vendeur
          </Link>
        </Button>
      </header>

      <PremiumSellerPitch variant="featured" />

      {pricing ? (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Tarifs plateforme en vigueur
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Commission active: {(pricing.commission_rate * 100).toFixed(1)}%</li>
            <li>Frais de plateforme: {formatXOF(pricing.service_fee)} / commande</li>
            <li>Livraison urbaine: {formatXOF(pricing.urban_delivery_fee)}</li>
            <li>
              Livraison peripherique: {formatXOF(pricing.peripheral_delivery_fee)}
            </li>
          </ul>
        </article>
      ) : null}
    </section>
  );
}
