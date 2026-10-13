"use client";

import Link from "next/link";
import {
  BadgeCheck,
  LayoutGrid,
  Laptop,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { PRODUCT_GRID_CLASS, ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProductSearch } from "@/hooks/use-product-search";

const DEBOUNCE_MS = 250;
const HOME_STATE_DRAFT_KEY = "amazer_home_state_draft";
const PAGE_SIZE = 24;
const MAX_ITEMS = 96;

const SHELF_TABS = [
  { slug: "all", label: "Tout", icon: LayoutGrid },
  { slug: "alimentation", label: "Alimentation", icon: ShoppingBasket },
  { slug: "restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { slug: "accessoires", label: "Accessoires", icon: ShoppingBag },
  { slug: "technologie", label: "Technologie", icon: Laptop },
] as const;

type ShelfSlug = (typeof SHELF_TABS)[number]["slug"];

// Uniquement des promesses tenues par la plateforme aujourd'hui.
const TRUST_POINTS = [
  { icon: BadgeCheck, title: "Boutiques vérifiées", text: "Badge attribué par AMAZER" },
  { icon: ShieldCheck, title: "Paiement contrôlé", text: "Confirmé avant toute préparation" },
  { icon: Truck, title: "Livraison à Niamey", text: "Standard ou express" },
] as const;

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [activeShelf, setActiveShelf] = useState<ShelfSlug>("all");
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const debouncedBarcode = useDebouncedValue(barcode, DEBOUNCE_MS);
  // La pagination est rattachee a la recherche : une nouvelle recherche repart de la premiere page.
  const searchKey = `${debouncedQuery}|${debouncedBarcode}`;
  const [pagination, setPagination] = useState({ key: searchKey, limit: PAGE_SIZE });
  const limit = pagination.key === searchKey ? pagination.limit : PAGE_SIZE;

  const hasActiveFilter = debouncedQuery.trim().length >= 2 || debouncedBarcode.trim().length >= 3;

  const { data, isPending, isFetching, isError } = useProductSearch({
    query: debouncedBarcode ? "" : debouncedQuery,
    barcode: debouncedBarcode,
    limit,
  });

  const products = useMemo(() => data?.items ?? [], [data?.items]);
  const displayResults = useMemo(
    () => (activeShelf === "all" ? products : products.filter((entry) => entry.category?.slug === activeShelf)),
    [activeShelf, products]
  );
  const canLoadMore = (data?.meta.returned ?? 0) >= limit && limit < MAX_ITEMS;

  const showSkeletons = isPending || (isFetching && displayResults.length === 0);
  const isEmptyState = !isPending && !isError && displayResults.length === 0;

  const onBarcodeDetected = (value: string) => {
    setBarcode(value);
    setQuery(value);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(HOME_STATE_DRAFT_KEY, JSON.stringify({ query, barcode, activeShelf }));
    } catch {
      // Stockage indisponible (navigation privee) : sans consequence.
    }
  }, [activeShelf, barcode, query]);

  const resetSearch = () => {
    setQuery("");
    setBarcode("");
    setActiveShelf("all");
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-16 pt-4">
      <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Tout ce qui se vend près de chez vous</h1>

      <div id="search" className="relative mt-3">
        <label htmlFor="home-search" className="sr-only">
          Rechercher un produit, une marque ou une catégorie
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <input
          id="home-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (barcode) setBarcode("");
          }}
          placeholder="Rechercher un produit, une marque…"
          autoComplete="off"
          className="h-14 w-full rounded-pill border-2 border-ink-200 bg-background pl-12 pr-28 text-base text-ink-900 placeholder:text-ink-500 focus-visible:border-brand-500 focus-visible:outline-none"
        />
        <BarcodeScannerDrawer onDetected={onBarcodeDetected} />
      </div>

      <nav aria-label="Catégories" className="-mx-gutter mt-4 overflow-x-auto px-gutter">
        <ul className="flex gap-2">
          {SHELF_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeShelf === tab.slug;
            return (
              <li key={tab.slug} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveShelf(tab.slug)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors duration-fast ${
                    active
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-border bg-card text-ink-700 hover:border-ink-400"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {!hasActiveFilter ? (
        <ul className="mt-4 grid grid-cols-3 gap-2 rounded-card border border-border bg-card p-3 sm:gap-4 sm:p-4">
          {TRUST_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li key={point.title} className="flex flex-col items-center gap-1 text-center sm:flex-row sm:text-left">
                <Icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                <span>
                  <span className="block text-xs font-semibold text-ink-900 sm:text-sm">{point.title}</span>
                  <span className="hidden text-xs text-ink-600 sm:block">{point.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">
          {hasActiveFilter ? `Résultats pour « ${debouncedBarcode || debouncedQuery} »` : "Nouveautés"}
        </h2>
        {!showSkeletons && !isError ? (
          <p className="shrink-0 text-sm text-ink-600" aria-live="polite">
            {displayResults.length} article{displayResults.length > 1 ? "s" : ""}
            {isFetching && !isPending ? " · mise à jour…" : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        {showSkeletons ? (
          <div className={PRODUCT_GRID_CLASS} aria-busy="true" aria-label="Chargement des produits">
            {Array.from({ length: 10 }).map((_, index) => (
              <ProductCardSkeleton key={`skeleton-${index}`} variant="tile" />
            ))}
          </div>
        ) : null}

        {!showSkeletons && displayResults.length > 0 ? (
          <div className={PRODUCT_GRID_CLASS}>
            {displayResults.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        ) : null}

        {!showSkeletons && isError ? (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <p className="text-sm text-ink-700">Impossible de charger les produits. Vérifiez votre connexion.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Réessayer
            </Button>
          </div>
        ) : null}

        {!showSkeletons && isEmptyState ? (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <SearchX className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-ink-900">Aucun produit trouvé</p>
            <p className="mt-1 text-sm text-ink-600">Essayez un autre mot ou une autre catégorie.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={resetSearch}>
              Réinitialiser la recherche
            </Button>
          </div>
        ) : null}

        {!showSkeletons && canLoadMore && activeShelf === "all" ? (
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-w-48"
              disabled={isFetching}
              onClick={() => setPagination({ key: searchKey, limit: Math.min(limit + PAGE_SIZE, MAX_ITEMS) })}
            >
              {isFetching ? "Chargement…" : "Voir plus de produits"}
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="mt-12 flex flex-col items-start gap-3 rounded-card bg-ink-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-8 w-8 shrink-0 text-brand-400" aria-hidden="true" />
          <div>
            <p className="font-semibold">Vous avez un commerce ?</p>
            <p className="text-sm text-white/80">Ouvrez votre boutique AMAZER et vendez à toute la ville.</p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/vendre">Devenir vendeur</Link>
        </Button>
      </aside>
    </section>
  );
}
