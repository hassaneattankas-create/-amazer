"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Rocket, Store } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { createSellerLead } from "@/services/seller-lead-service";

export default function VendrePage() {
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    shop_name: "",
    district: "",
    contact: "",
    product_type: "",
  });

  const { data: pricing, isPending } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });

  const mutation = useMutation({
    mutationFn: createSellerLead,
    onSuccess: () => {
      setStatus("Demande envoyee. Notre equipe te contactera.");
      setForm({ shop_name: "", district: "", contact: "", product_type: "" });
    },
    onError: () => setStatus("Erreur envoi formulaire."),
  });

  if (isPending || !pricing) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-gradient-to-br from-white to-orange-50 p-6">
        <h1 className="luxury-title inline-flex items-center gap-2 text-3xl font-semibold">
          <Store className="h-6 w-6 text-[#FF4D00]" />
          Devenir Vendeur sur AMAZER
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Plus de visibilite a Niamey, ventes optimisees et paiements Nita/Amana.
        </p>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Tarifs actuels</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Commission par vente: {(pricing.commission_rate * 100).toFixed(1)}%</li>
          <li>Frais de service: {formatXOF(pricing.service_fee)} / transaction</li>
          <li>Frais livraison par defaut Niamey: {formatXOF(pricing.default_delivery_fee)}</li>
          <li>Abonnement vendeur: {formatXOF(pricing.seller_subscription_fee)} / mois</li>
        </ul>
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Inscription vendeur</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            value={form.shop_name}
            onChange={(event) => setForm((prev) => ({ ...prev, shop_name: event.target.value }))}
            placeholder="Nom boutique"
          />
          <Input
            value={form.district}
            onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))}
            placeholder="Quartier"
          />
          <Input
            value={form.contact}
            onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))}
            placeholder="Contact"
          />
          <Input
            value={form.product_type}
            onChange={(event) => setForm((prev) => ({ ...prev, product_type: event.target.value }))}
            placeholder="Type de produits"
          />
        </div>
        <Button
          type="button"
          onClick={() => mutation.mutate(form)}
          className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
        >
          <Rocket className="h-4 w-4" />
          Envoyer ma candidature
        </Button>
        {status ? <p className="mt-2 text-sm text-slate-700">{status}</p> : null}
      </article>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/register">Creer mon compte vendeur</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/seller">J&apos;ai deja un compte vendeur</Link>
        </Button>
      </div>
    </section>
  );
}
