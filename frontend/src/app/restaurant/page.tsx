"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { StorefrontShowcaseCard } from "@/components/storefront/StorefrontShowcaseCard";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getApiErrorMessage } from "@/lib/api-error";
import { listStorefronts } from "@/services/catalog-service";

export default function RestaurantPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const { data: restaurants = [], isPending, isError, error } = useQuery({
    queryKey: ["catalog-storefronts-restaurants", debouncedQuery],
    queryFn: () => listStorefronts({ query: debouncedQuery, activityType: "restaurant" }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const visibleRestaurants = useMemo(() => {
    const copy = [...restaurants];
    copy.sort((a, b) => Number(b.is_verified) - Number(a.is_verified));
    return copy;
  }, [restaurants]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-white/20 bg-white/70 p-6">
        <h1 className="luxury-title text-3xl font-semibold">Restaurants</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Commandez en ligne, payez par Nita ou Amana, livraison moto-coursier a Niamey.
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un restaurant..."
          className="mt-5"
        />
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ProductCardSkeleton key={`restaurant-skeleton-${index}`} />
          ))}
        </div>
      ) : isError ? (
        <article className="premium-card border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {getApiErrorMessage(error, "Impossible de charger les restaurants.")}
        </article>
      ) : visibleRestaurants.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleRestaurants.map((store) => (
            <StorefrontShowcaseCard key={store.id} store={store} ctaLabel="Voir le menu & Commander" />
          ))}
        </div>
      ) : (
        <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Aucun restaurant disponible pour le moment.
        </article>
      )}
    </section>
  );
}
