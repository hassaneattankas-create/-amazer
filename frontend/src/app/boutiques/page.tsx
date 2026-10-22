"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { StorefrontShowcaseCard } from "@/components/storefront/StorefrontShowcaseCard";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getApiErrorMessage } from "@/lib/api-error";
import { listStorefronts } from "@/services/catalog-service";

export default function BoutiquesPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: stores = [], isPending, isError, error } = useQuery({
    queryKey: ["catalog-storefronts-boutiques", debouncedQuery],
    // Toutes les boutiques qui vendent des produits (commerces et entreprises), pas seulement le type « shop ».
    queryFn: () => listStorefronts({ query: debouncedQuery }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const visibleStores = useMemo(() => {
    const copy = stores.filter(
      (store) =>
        !["restaurant", "hotel", "transport"].includes(store.activity_type ?? "") &&
        !store.service_kind &&
        (!verifiedOnly || store.is_verified)
    );
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
  }, [stores, verifiedOnly]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-gutter pb-14 pt-4">
      <header className="rounded-card border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">Boutiques</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-600">
              Toutes les boutiques AMAZER, les plus fournies d&apos;abord.
            </p>
          </div>
          <Link href="/hotels" className="text-sm font-medium text-brand-700 hover:underline">
            Voir aussi les premium
          </Link>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Rechercher une boutique"
          placeholder="Rechercher une boutique…"
          className="mt-5"
        />
        <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => setVerifiedOnly(event.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          Boutiques vérifiées uniquement
        </label>
      </header>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={`store-skeleton-${index}`} />
          ))}
        </div>
      ) : isError ? (
        <article className="rounded-card border border-border bg-card p-6 text-sm text-danger">
          {getApiErrorMessage(error, "Impossible de charger les boutiques pour le moment.")}
        </article>
      ) : visibleStores.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleStores.map((store) => (
            <StorefrontShowcaseCard key={store.id} store={store} ctaLabel="Voir la boutique" />
          ))}
        </div>
      ) : (
        <article className="rounded-card border border-border bg-card p-6 text-sm text-ink-600">
          Aucune boutique ne correspond à cette recherche.
        </article>
      )}
    </section>
  );
}
