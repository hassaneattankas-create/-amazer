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
    <section className="mx-auto w-full max-w-7xl space-y-6 px-gutter pb-14 pt-4">
      <header className="rounded-card border border-border bg-card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">Restaurants</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Commandez en ligne, livré par moto à Niamey.
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Rechercher un restaurant"
          placeholder="Rechercher un restaurant…"
          className="mt-5"
        />
      </header>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <ProductCardSkeleton key={`restaurant-skeleton-${index}`} />
          ))}
        </div>
      ) : isError ? (
        <article className="rounded-card border border-border bg-card p-6 text-sm text-danger">
          {getApiErrorMessage(error, "Impossible de charger les restaurants.")}
        </article>
      ) : visibleRestaurants.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleRestaurants.map((store) => (
            <StorefrontShowcaseCard key={store.id} store={store} ctaLabel="Voir le menu" />
          ))}
        </div>
      ) : (
        <article className="rounded-card border border-border bg-card p-6 text-sm text-ink-600">
          Aucun restaurant disponible pour le moment.
        </article>
      )}
    </section>
  );
}
