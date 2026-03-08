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
  const { data: hotels = [], isPending } = useQuery({
    queryKey: ["catalog-storefronts-hotels", query],
    queryFn: () =>
      listStorefronts({
        query,
        activityType: "hotel",
      }),
  });
  const visibleHotels = useMemo(() => hotels.filter((hotel) => hotel.is_verified), [hotels]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-white/20 bg-white/70 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="luxury-title text-3xl font-semibold">Hotels de Luxe</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Comparez les etablissements premium, leurs services signatures et leurs chambres a partir de prix en XOF.
            </p>
          </div>
          <Link href="/boutiques" className="text-sm font-medium text-[#FF4D00]">
            Retour aux boutiques
          </Link>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un hotel, un quartier ou un service..."
          className="mt-5"
        />
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ProductCardSkeleton key={`hotel-skeleton-${index}`} />
          ))}
        </div>
      ) : visibleHotels.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleHotels.map((hotel) => (
            <StorefrontShowcaseCard key={hotel.id} store={hotel} ctaLabel="Voir les chambres" />
          ))}
        </div>
      ) : (
        <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Aucun hotel ne correspond a cette recherche.
        </article>
      )}
    </section>
  );
}
