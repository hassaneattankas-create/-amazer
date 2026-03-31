"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { StorefrontShowcaseCard } from "@/components/storefront/StorefrontShowcaseCard";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import { listStorefronts } from "@/services/catalog-service";

export default function BoutiquesPage() {
  const [query, setQuery] = useState("");
  const { data: stores = [], isPending, isError, error } = useQuery({
    queryKey: ["catalog-storefronts-boutiques", query],
    queryFn: () =>
      listStorefronts({
        query,
        activityType: "shop",
      }),
  });
  const visibleStores = useMemo(() => {
    const copy = [...stores];
    copy.sort((a, b) => {
      const byProducts = b.product_count - a.product_count;
      if (byProducts !== 0) {
        return byProducts;
      }
      const byStartingPrice = Number(Boolean(b.starting_price)) - Number(Boolean(a.starting_price));
      if (byStartingPrice !== 0) {
        return byStartingPrice;
      }
      const byVerification = Number(b.is_verified) - Number(a.is_verified);
      if (byVerification !== 0) {
        return byVerification;
      }
      return (a.business_name || a.name).localeCompare(b.business_name || b.name);
    });
    return copy;
  }, [stores]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-white/20 bg-white/70 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="luxury-title text-3xl font-semibold">Boutiques</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Explorez les boutiques actives, avec priorite aux enseignes qui ont deja du stock visible.
            </p>
          </div>
          <Link href="/hotels" className="text-sm font-medium text-[#FF4D00]">
            Voir aussi les premium
          </Link>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une boutique."
          className="mt-5"
        />
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={`store-skeleton-${index}`} />
          ))}
        </div>
      ) : isError ? (
        <article className="premium-card border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {getApiErrorMessage(error, "Impossible de charger les boutiques pour le moment.")}
        </article>
      ) : visibleStores.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleStores.map((store) => (
            <StorefrontShowcaseCard key={store.id} store={store} ctaLabel="Entrer" />
          ))}
        </div>
      ) : (
        <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Aucune boutique ne correspond a cette recherche.
        </article>
      )}
    </section>
  );
}
