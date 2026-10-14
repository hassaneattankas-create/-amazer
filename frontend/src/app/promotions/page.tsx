"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Tag } from "lucide-react";

import { ConvertedPrice } from "@/components/ConvertedPrice";
import { PRODUCT_GRID_CLASS } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatXOF } from "@/lib/currency";
import { getProductRoute } from "@/lib/mobile-routes";
import { resolveProductImageUrl } from "@/lib/product-image";
import { listPromotions } from "@/services/catalog-service";

function timeLeft(until: string | null): string | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Encore ${days} jour${days > 1 ? "s" : ""}`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `Plus que ${hours} h`;
}

/** Bonnes affaires a la maniere des ventes flash : plus grosses remises d'abord, fin de l'offre visible. */
export default function PromotionsPage() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const { data: promotions = [], isPending, isError, refetch } = useQuery({
    queryKey: ["catalog-promotions", debounced],
    queryFn: () => listPromotions(debounced),
    staleTime: 60_000,
  });

  const sorted = useMemo(
    () =>
      [...promotions]
        .map((item) => ({
          item,
          discount:
            item.original_amount > item.promo_amount
              ? Math.round(((item.original_amount - item.promo_amount) / item.original_amount) * 100)
              : 0,
        }))
        .sort((a, b) => b.discount - a.discount),
    [promotions]
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-6 text-white sm:px-8">
        <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-display">
          <Tag className="h-6 w-6 text-brand-400" aria-hidden="true" />
          Bonnes affaires
        </h1>
        <p className="mt-1 text-sm text-white/80">Les plus grosses remises des boutiques, mises à jour en continu.</p>
        <div className="relative mt-4">
          <label htmlFor="promo-search" className="sr-only">
            Rechercher une promotion
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input
            id="promo-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une promotion…"
            className="h-12 w-full rounded-pill bg-card pl-12 pr-4 text-base text-ink-900 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        </div>
      </header>

      <div className="mt-4">
        {isPending ? (
          <div className={PRODUCT_GRID_CLASS} aria-busy="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <ProductCardSkeleton key={index} variant="tile" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-card border border-border bg-card p-6 text-center">
            <p className="text-sm text-ink-700">Impossible de charger les promotions. Vérifiez votre connexion.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
              Réessayer
            </Button>
          </div>
        ) : sorted.length ? (
          <>
            <p className="mb-3 text-sm text-ink-600">
              {sorted.length} offre{sorted.length > 1 ? "s" : ""}
            </p>
            <div className={PRODUCT_GRID_CLASS}>
              {sorted.map(({ item, discount }) => {
                const left = timeLeft(item.promo_until);
                return (
                  <Link
                    key={`${item.product_id}-${item.vendor.id}`}
                    href={getProductRoute(item.product_id)}
                    className="group flex flex-col overflow-hidden rounded-card border border-border bg-card hover:border-ink-400"
                  >
                    <div className="relative aspect-square bg-surface-1">
                      <Image
                        src={resolveProductImageUrl({ raw: item.main_image_url, categorySlug: item.category_slug })}
                        alt={item.product_name}
                        fill
                        sizes="(max-width: 640px) 50vw, 240px"
                        unoptimized
                        className="object-cover"
                      />
                      {discount > 0 ? (
                        <span className="absolute left-2 top-2 rounded-pill bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                          -{discount}%
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-3">
                      <p className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-ink-900">{formatXOF(item.promo_amount)}</span>
                        <span className="text-xs text-ink-500 line-through">{formatXOF(item.original_amount)}</span>
                      </p>
                      <ConvertedPrice amount={item.promo_amount} />
                      <h2 className="line-clamp-2 text-sm text-ink-800 group-hover:text-brand-700">{item.product_name}</h2>
                      <p className="mt-auto truncate pt-1 text-xs text-ink-600">{item.vendor.name}</p>
                      {left ? <p className="text-xs font-medium text-brand-700">{left}</p> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <Tag className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-ink-900">
              {debounced ? "Aucune promotion ne correspond" : "Pas de promotion en ce moment"}
            </p>
            <p className="mt-1 text-sm text-ink-600">Revenez bientôt : les boutiques en publient chaque semaine.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">Voir les nouveautés</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
