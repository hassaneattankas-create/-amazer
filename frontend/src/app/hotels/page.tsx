"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { StorefrontShowcaseCard } from "@/components/storefront/StorefrontShowcaseCard";
import { Input } from "@/components/ui/input";
import { listStorefronts } from "@/services/catalog-service";

export default function HotelsPage() {
  const [query, setQuery] = useState("");
  const { data: premiumStores = [], isPending } = useQuery({
    queryKey: ["catalog-storefronts-hotels", query],
    queryFn: () =>
      listStorefronts({
        query,
        storefrontTier: "premium",
      }),
  });
  const visiblePremiumStores = useMemo(() => {
    const copy = [...premiumStores];
    copy.sort((a, b) => Number(b.is_verified) - Number(a.is_verified));
    return copy;
  }, [premiumStores]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-white/20 bg-white/70 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="luxury-title text-3xl font-semibold">Premium</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Grandes entreprises premium: boutique + restaurant + mini-site complet + services exclusifs.
            </p>
          </div>
          <Link href="/boutiques" className="text-sm font-medium text-[#FF4D00]">
            Retour aux boutiques
          </Link>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une entreprise premium..."
          className="mt-5"
        />
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ProductCardSkeleton key={`hotel-skeleton-${index}`} />
          ))}
        </div>
      ) : visiblePremiumStores.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visiblePremiumStores.map((store) => (
            <StorefrontShowcaseCard key={store.id} store={store} ctaLabel="Voir le mini-site premium" />
          ))}
        </div>
      ) : (
        <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Aucune entreprise premium ne correspond a cette recherche.
        </article>
      )}
    </section>
  );
}
