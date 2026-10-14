"use client";

import Link from "next/link";
import {
  Armchair,
  BadgeCheck,
  BedDouble,
  LayoutGrid,
  Laptop,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  SprayCan,
  Store,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { FeaturedShopsRail, PromotionsRail } from "@/components/home/HomeRails";
import { PRODUCT_GRID_CLASS, ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { SearchToolbar, type PriceFilter } from "@/components/search/SearchToolbar";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProductSearch } from "@/hooks/use-product-search";
import { useT } from "@/lib/i18n";
import { listCatalogCategories, listPromotions, listStorefronts } from "@/services/catalog-service";
import type { SearchSort } from "@/types/product";

const DEBOUNCE_MS = 250;
const HOME_STATE_DRAFT_KEY = "amazer_home_state_draft";
const PAGE_SIZE = 24;
const MAX_ITEMS = 96;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  alimentation: ShoppingBasket,
  accessoires: ShoppingBag,
  electronique: Smartphone,
  technologie: Laptop,
  hygiene: SprayCan,
  maison: Armchair,
};

// Uniquement des promesses tenues par la plateforme aujourd'hui.
const TRUST_POINTS = [
  { icon: BadgeCheck, title: "Boutiques vérifiées" },
  { icon: ShieldCheck, title: "Paiement contrôlé" },
  { icon: Truck, title: "Livraison" },
] as const;

// Tuile de rayon (icone + libelle), comme les grandes marketplaces.
const tileClass = (active: boolean) =>
  `flex w-20 flex-col items-center gap-1.5 p-1 text-center text-xs font-medium transition-colors duration-fast sm:w-24 ${
    active ? "text-brand-700" : "text-ink-700 hover:text-ink-900"
  }`;
const tileIconClass = (active: boolean) =>
  `flex h-14 w-14 items-center justify-center rounded-card border transition-colors duration-fast sm:h-16 sm:w-16 ${
    active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border bg-card text-ink-700"
  }`;

export default function HomePage() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<SearchSort | undefined>(undefined);
  const [price, setPrice] = useState<PriceFilter>({});
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const debouncedBarcode = useDebouncedValue(barcode, DEBOUNCE_MS);

  const hasTextQuery = debouncedQuery.trim().length >= 2 || debouncedBarcode.trim().length >= 3;
  const effectiveSort: SearchSort = sort ?? (hasTextQuery ? "relevance" : "newest");

  // La pagination est rattachee a la recherche et aux filtres : tout changement repart de la premiere page.
  const searchKey = [debouncedQuery, debouncedBarcode, category, effectiveSort, price.min, price.max, includeOutOfStock].join("|");
  const [pagination, setPagination] = useState({ key: searchKey, limit: PAGE_SIZE });
  const limit = pagination.key === searchKey ? pagination.limit : PAGE_SIZE;

  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: listCatalogCategories,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: promotions = [] } = useQuery({
    queryKey: ["home-promotions"],
    queryFn: () => listPromotions(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: shops = [] } = useQuery({
    queryKey: ["home-featured-shops"],
    queryFn: () => listStorefronts({ limit: 24 }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data, isPending, isFetching, isError } = useProductSearch({
    query: debouncedBarcode ? "" : debouncedQuery,
    barcode: debouncedBarcode,
    limit,
    categorySlug: category || undefined,
    sort: effectiveSort,
    minPrice: price.min,
    maxPrice: price.max,
    inStockOnly: !includeOutOfStock,
  });

  const products = data?.items ?? [];
  const canLoadMore = (data?.meta.returned ?? 0) >= limit && limit < MAX_ITEMS;
  const showSkeletons = isPending || (isFetching && products.length === 0);
  const isEmptyState = !isPending && !isError && products.length === 0;
  const hasAnyFilter = hasTextQuery || Boolean(category) || Boolean(price.min || price.max) || includeOutOfStock;

  const onBarcodeDetected = (value: string) => {
    setBarcode(value);
    setQuery(value);
  };

  // Recherche partageable : ?q= est lu a l'ouverture et tenu a jour pendant la saisie.
  useEffect(() => {
    // Lu apres le premier rendu (le HTML serveur ne connait pas l'URL) : pas d'ecart d'hydratation.
    const initial = new URLSearchParams(window.location.search).get("q");
    if (!initial) return undefined;
    const timer = window.setTimeout(() => setQuery(initial), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    const value = debouncedQuery.trim();
    if ((url.searchParams.get("q") ?? "") === value) return;
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [debouncedQuery]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HOME_STATE_DRAFT_KEY, JSON.stringify({ query, barcode, category }));
    } catch {
      // Stockage indisponible (navigation privee) : sans consequence.
    }
  }, [barcode, category, query]);

  const resetAll = () => {
    setQuery("");
    setBarcode("");
    setCategory("");
    setPrice({});
    setIncludeOutOfStock(false);
    setSort(undefined);
  };

  const heading = hasTextQuery
    ? t("Résultats pour « {q} »", { q: debouncedBarcode || debouncedQuery })
    : category
      ? t(categories.find((item) => item.slug === category)?.name ?? "Catégorie")
      : t("Nouveautés");

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-16 pt-4">
      <div className="rounded-card bg-ink-900 px-4 py-6 sm:px-8 sm:py-10">
        <h1 className="text-display-sm font-semibold tracking-display text-white">
          {t("Achetez et vendez en toute confiance")}
        </h1>
        <div id="search" className="relative mt-4">
          <label htmlFor="home-search" className="sr-only">
            {t("Rechercher un produit, une marque ou une catégorie")}
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
            placeholder={t("Rechercher un produit, une marque…")}
            autoComplete="off"
            className="h-14 w-full rounded-pill border-2 border-transparent bg-card pl-12 pr-28 text-base text-ink-900 placeholder:text-ink-500 focus-visible:border-brand-500 focus-visible:outline-none"
          />
          <BarcodeScannerDrawer onDetected={onBarcodeDetected} triggerLabel={t("Scan")} />
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/80 sm:text-sm">
          {TRUST_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li key={point.title} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
                {t(point.title)}
              </li>
            );
          })}
        </ul>
      </div>

      <nav aria-label={t("Catégories")} className="-mx-gutter mt-4 overflow-x-auto px-gutter">
        <ul className="flex gap-1 sm:gap-2">
          <li className="shrink-0">
            <button type="button" aria-pressed={!category} onClick={() => setCategory("")} className={tileClass(!category)}>
              <span className={tileIconClass(!category)}>
                <LayoutGrid className="h-6 w-6" aria-hidden="true" />
              </span>
              {t("Tout")}
            </button>
          </li>
          {categories.map((item) => {
            const Icon = CATEGORY_ICONS[item.slug] ?? LayoutGrid;
            const active = category === item.slug;
            return (
              <li key={item.slug} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(active ? "" : item.slug)}
                  className={tileClass(active)}
                >
                  <span className={tileIconClass(active)}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  {t(item.name)}
                </button>
              </li>
            );
          })}
          <li className="shrink-0">
            <Link href="/restaurant" className={tileClass(false)}>
              <span className={tileIconClass(false)}>
                <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
              </span>
              {t("Restaurants")}
            </Link>
          </li>
          <li className="shrink-0">
            <Link href="/hotels" className={tileClass(false)}>
              <span className={tileIconClass(false)}>
                <BedDouble className="h-6 w-6" aria-hidden="true" />
              </span>
              {t("Premium")}
            </Link>
          </li>
        </ul>
      </nav>

      {!hasAnyFilter ? (
        <>
          <PromotionsRail items={promotions} />
          <FeaturedShopsRail shops={shops} />
        </>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold text-ink-900">{heading}</h2>
      <SearchToolbar
        resultCount={showSkeletons ? null : products.length}
        isUpdating={isFetching && !isPending}
        hasTextQuery={hasTextQuery}
        sort={effectiveSort}
        onSortChange={setSort}
        price={price}
        onPriceChange={setPrice}
        includeOutOfStock={includeOutOfStock}
        onIncludeOutOfStockChange={setIncludeOutOfStock}
      />

      <div className="mt-4">
        {showSkeletons ? (
          <div className={PRODUCT_GRID_CLASS} aria-busy="true" aria-label={t("Chargement des produits")}>
            {Array.from({ length: 10 }).map((_, index) => (
              <ProductCardSkeleton key={`skeleton-${index}`} variant="tile" />
            ))}
          </div>
        ) : null}

        {!showSkeletons && products.length > 0 ? (
          <div className={PRODUCT_GRID_CLASS}>
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        ) : null}

        {!showSkeletons && isError ? (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <p className="text-sm text-ink-700">{t("Impossible de charger les produits. Vérifiez votre connexion.")}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              {t("Réessayer")}
            </Button>
          </div>
        ) : null}

        {!showSkeletons && isEmptyState ? (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <SearchX className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-ink-900">{t("Aucun produit trouvé")}</p>
            <p className="mt-1 text-sm text-ink-600">
              {t("Essayez un autre mot, une autre catégorie ou élargissez les filtres.")}
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={resetAll}>
              {t("Tout réinitialiser")}
            </Button>
          </div>
        ) : null}

        {!showSkeletons && canLoadMore ? (
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-w-48"
              disabled={isFetching}
              onClick={() => setPagination({ key: searchKey, limit: Math.min(limit + PAGE_SIZE, MAX_ITEMS) })}
            >
              {isFetching ? t("Chargement…") : t("Voir plus de produits")}
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="mt-12 flex flex-col items-start gap-3 rounded-card bg-ink-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-8 w-8 shrink-0 text-brand-400" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("Vous avez un commerce ?")}</p>
            <p className="text-sm text-white/80">{t("Ouvrez votre boutique AMAZER et vendez partout.")}</p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/vendre">{t("Devenir vendeur")}</Link>
        </Button>
      </aside>
    </section>
  );
}
