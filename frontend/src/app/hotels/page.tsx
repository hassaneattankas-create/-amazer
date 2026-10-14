"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, BedDouble, Building2, Bus, CalendarClock, LayoutGrid, Search, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { StorefrontShowcaseCard } from "@/components/storefront/StorefrontShowcaseCard";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listStorefronts } from "@/services/catalog-service";

type PremiumFilter = "all" | "hotel" | "transport" | "restaurant" | "enterprise" | "shop";

// Comme Booking (hotels), Busbud (transport) ou les vitrines « Plus » : un filtre par metier.
const FILTERS: { key: PremiumFilter; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "Tout", icon: LayoutGrid },
  { key: "hotel", label: "Hôtels", icon: BedDouble },
  { key: "transport", label: "Transport", icon: Bus },
  { key: "restaurant", label: "Restaurants", icon: UtensilsCrossed },
  { key: "enterprise", label: "Entreprises", icon: Building2 },
  { key: "shop", label: "Boutiques", icon: Store },
];

const BENEFITS = [
  { icon: BadgeCheck, text: "Établissements vérifiés par AMAZER" },
  { icon: CalendarClock, text: "Réservation en ligne : chambres, trajets, tables" },
  { icon: Store, text: "Site vitrine complet, photos et services" },
] as const;

const CTA_LABEL: Record<string, string> = {
  hotel: "Réserver",
  transport: "Voir les trajets",
  restaurant: "Voir le menu",
};

export default function PremiumPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PremiumFilter>("all");
  const debouncedQuery = useDebouncedValue(query, 250);

  const { data: stores = [], isPending, isError, refetch } = useQuery({
    queryKey: ["catalog-storefronts-premium", debouncedQuery],
    queryFn: () => listStorefronts({ query: debouncedQuery, storefrontTier: "premium" }),
    staleTime: 60_000,
  });

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: stores.length };
    for (const store of stores) {
      const key = store.activity_type ?? "shop";
      result[key] = (result[key] ?? 0) + 1;
    }
    return result;
  }, [stores]);

  const visible = useMemo(
    () =>
      stores
        .filter((store) => filter === "all" || (store.activity_type ?? "shop") === filter)
        .sort((a, b) => Number(b.is_verified) - Number(a.is_verified) || b.product_count - a.product_count),
    [stores, filter]
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-6 text-white sm:px-8 sm:py-8">
        <h1 className="text-display-sm font-semibold tracking-display">Premium</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/80">Hôtels, transport, restaurants et entreprises de confiance.</p>
        <div className="relative mt-4">
          <label htmlFor="premium-search" className="sr-only">
            Rechercher un établissement premium
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input
            id="premium-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hôtel, compagnie de bus, restaurant…"
            className="h-12 w-full rounded-pill bg-card pl-12 pr-4 text-base text-ink-900 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        </div>
        <ul className="mt-4 grid gap-2 text-xs text-white/80 sm:grid-cols-3 sm:text-sm">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <li key={benefit.text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
                {benefit.text}
              </li>
            );
          })}
        </ul>
      </header>

      <div className="-mx-gutter mt-4 overflow-x-auto px-gutter" role="tablist" aria-label="Type d'établissement">
        <div className="flex gap-2">
          {FILTERS.map((item) => {
            const Icon = item.icon;
            const active = filter === item.key;
            const count = counts[item.key] ?? 0;
            if (item.key !== "all" && count === 0 && !active) return null;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.key)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors duration-fast ${
                  active ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
                {isPending ? null : <span className={active ? "text-white/70" : "text-ink-500"}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={`premium-skeleton-${index}`} />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-card border border-border bg-card p-6 text-center">
            <p className="text-sm text-ink-700">Impossible de charger les établissements. Vérifiez votre connexion.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
              Réessayer
            </Button>
          </div>
        ) : visible.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((store) => (
              <StorefrontShowcaseCard
                key={store.id}
                store={store}
                ctaLabel={CTA_LABEL[store.activity_type ?? ""] ?? "Voir le site"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-card p-6 text-center">
            <p className="font-semibold text-ink-900">Aucun établissement trouvé</p>
            <p className="mt-1 text-sm text-ink-600">Essayez un autre mot ou un autre type.</p>
          </div>
        )}
      </div>

      <aside className="mt-10 flex flex-col items-start gap-3 rounded-card border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink-900">Vous gérez un hôtel, une compagnie de transport ou une entreprise ?</p>
          <p className="text-sm text-ink-600">Passez en Premium : site vitrine, réservations en ligne et badge vérifié.</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/vendre">Passer en Premium</Link>
        </Button>
      </aside>
    </section>
  );
}
