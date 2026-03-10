"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, SearchX, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Drawer } from "vaul";
import { useQuery } from "@tanstack/react-query";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { HeroSection } from "@/components/HeroSection";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { StorefrontShowcaseCard } from "@/components/storefront/StorefrontShowcaseCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatMoney } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { getHomeContent, trackAdClick } from "@/services/content-service";
import { getPublicContactInfo } from "@/services/finance-service";
import { listStorefronts } from "@/services/catalog-service";
import { useProductSearch } from "@/hooks/use-product-search";
import { useAuthStore } from "@/store/auth-store";
import { HomeContentProduct } from "@/types/content";
import { ProductSearchItem } from "@/types/product";

const DEBOUNCE_MS = 250;
const HOME_STATE_DRAFT_KEY = "amazer_home_state_draft";

const SHELF_TABS = [
  { slug: "all", emoji: "*", label: "Tout" },
  { slug: "alimentation", emoji: "AG", label: "Alimentation" },
  { slug: "restaurant", emoji: "RE", label: "Restaurant" },
  { slug: "accessoires", emoji: "AC", label: "Accessoires" },
  { slug: "technologie", emoji: "TE", label: "Technologie" },
] as const;

type ShelfSlug = (typeof SHELF_TABS)[number]["slug"];

function loadHomeStateDraft(): { query: string; barcode: string; activeShelf: ShelfSlug } {
  const fallback: { query: string; barcode: string; activeShelf: ShelfSlug } = {
    query: "",
    barcode: "",
    activeShelf: "all",
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(HOME_STATE_DRAFT_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<typeof fallback>;
    const activeShelf = SHELF_TABS.some((entry) => entry.slug === parsed.activeShelf)
      ? (parsed.activeShelf as ShelfSlug)
      : "all";
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      barcode: typeof parsed.barcode === "string" ? parsed.barcode : "",
      activeShelf,
    };
  } catch {
    return fallback;
  }
}

function shuffleItems<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function withBoostRotation<T extends { is_boosted: boolean }>(items: T[]): T[] {
  const boosted = items.filter((entry) => entry.is_boosted);
  const regular = items.filter((entry) => !entry.is_boosted);
  if (!boosted.length) {
    return items;
  }
  if (boosted.length <= 3) {
    return [...boosted, ...regular];
  }
  const rotated = shuffleItems(boosted);
  return [...rotated.slice(0, 3), ...regular, ...rotated.slice(3)];
}

export default function HomePage() {
  const [homeInit] = useState(loadHomeStateDraft);
  const [query, setQuery] = useState(homeInit.query);
  const [barcode, setBarcode] = useState(homeInit.barcode);
  const [activeShelf, setActiveShelf] = useState<ShelfSlug>(homeInit.activeShelf);
  const preferredCurrency = useAuthStore((state) => state.preferredCurrency);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const debouncedBarcode = useDebouncedValue(barcode, DEBOUNCE_MS);

  const hasActiveFilter = debouncedQuery.trim().length >= 2 || debouncedBarcode.trim().length >= 3;
  const { data: homeContent } = useQuery({
    queryKey: ["home-content"],
    queryFn: getHomeContent,
    staleTime: 15_000,
  });
  const { data: contactInfo } = useQuery({
    queryKey: ["public-contact-info"],
    queryFn: getPublicContactInfo,
    staleTime: 60_000,
  });
  const { data: storefronts = [] } = useQuery({
    queryKey: ["home-storefronts"],
    queryFn: () => listStorefronts({ storefrontTier: "premium" }),
    staleTime: 30_000,
  });
  const { data, isPending, isFetching, isError, error } = useProductSearch({
    query: debouncedBarcode ? "" : debouncedQuery,
    barcode: debouncedBarcode,
  });

  const products = useMemo(() => data?.items ?? [], [data?.items]);
  const shelfFiltered = useMemo(() => {
    if (activeShelf === "all") {
      return products;
    }
    return products.filter((entry) => entry.category?.slug === activeShelf);
  }, [activeShelf, products]);
  const boostedResults = useMemo(() => withBoostRotation(shelfFiltered), [shelfFiltered]);

  const featuredOffers = useMemo(() => {
    const cards: Array<{ id: string; name: string; brand: string; amount: number; slug: string }> = [];
    const pushUnique = (item: HomeContentProduct, slug: string) => {
      if (cards.some((entry) => entry.id === item.id)) {
        return;
      }
      cards.push({ id: item.id, name: item.name, brand: item.brand, amount: item.amount, slug });
    };
    for (const section of homeContent?.sections ?? []) {
      for (const item of section.products) {
        if (item.is_boosted) {
          pushUnique(item, section.slug);
        }
      }
    }
    return shuffleItems(cards).slice(0, 12);
  }, [homeContent?.sections]);

  const featuredHotels = useMemo(
    () =>
      storefronts
        .filter((store) => store.activity_type === "hotel" && store.is_verified)
        .slice(0, 3),
    [storefronts]
  );
  const featuredBoutiques = useMemo(
    () =>
      storefronts
        .filter(
          (store) =>
            (store.activity_type === "shop" || store.activity_type === "enterprise") &&
            store.is_verified
        )
        .slice(0, 6),
    [storefronts]
  );

  const showSkeletons = isPending || (isFetching && boostedResults.length === 0);
  const isEmptyState = hasActiveFilter && !isPending && !isError && boostedResults.length === 0;

  const statusLabel = useMemo(() => {
    if (!hasActiveFilter) return "Top produits du marche Niger.";
    if (isPending) return "Recherche en cours...";
    if (isError) return `Erreur: ${(error as Error).message}`;
    if (!boostedResults.length) return "Aucun produit trouve.";
    return `${boostedResults.length} produit(s) trouves`;
  }, [boostedResults.length, error, hasActiveFilter, isError, isPending]);

  const onBarcodeDetected = (value: string) => {
    setBarcode(value);
    setQuery(value);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        HOME_STATE_DRAFT_KEY,
        JSON.stringify({ query, barcode, activeShelf })
      );
    }
  }, [activeShelf, barcode, query]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
      <HeroSection />

      <article className="premium-card mt-4 border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SHELF_TABS.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              onClick={() => setActiveShelf(tab.slug)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                activeShelf === tab.slug
                  ? "border-[#FF4D00]/50 bg-[#FF4D00]/10 text-[#FF4D00]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#FF4D00]/30"
              }`}
            >
              <span className="mr-1">{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </article>

      {featuredOffers.length ? (
        <article className="premium-card mt-4 overflow-hidden border border-slate-200 bg-white p-4">
          <h2 className="luxury-title text-lg font-semibold text-slate-900">Featured Carousel</h2>
          <p className="mt-1 text-xs text-slate-500">Offres vendeurs en Multi-Boost</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {featuredOffers.map((item) => (
              <Link
                key={item.id}
                href={`/product/${item.id}`}
                onClick={() => void trackAdClick(item.id, item.slug)}
                className="min-w-56 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-3 shadow-[0_0_18px_rgba(245,158,11,0.28)]"
              >
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Sponsorise
                </span>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{item.brand}</p>
                <p className="mt-2 text-base font-semibold text-[#FF4D00]">
                  {formatMoney(item.amount, preferredCurrency)}
                </p>
              </Link>
            ))}
          </div>
        </article>
      ) : null}

      {!hasActiveFilter && featuredHotels.length ? (
        <article className="premium-card mt-5 border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="luxury-title text-lg font-semibold text-slate-900">Premium & Residences</h2>
              <p className="mt-1 text-xs text-slate-500">
                Suites premium, spa, piscine et services signatures.
              </p>
            </div>
            <Link href="/hotels" className="text-sm font-medium text-[#FF4D00]">
              Voir tout
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {featuredHotels.map((store) => (
              <StorefrontShowcaseCard key={store.id} store={store} ctaLabel="Voir le premium" />
            ))}
          </div>
        </article>
      ) : null}

      {!hasActiveFilter && featuredBoutiques.length ? (
        <article className="premium-card mt-5 border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="luxury-title text-lg font-semibold text-slate-900">Boutiques & Enseignes</h2>
              <p className="mt-1 text-xs text-slate-500">
                Mini-sites premium pour artisanat, tech et gourmet.
              </p>
            </div>
            <Link href="/boutiques" className="text-sm font-medium text-[#FF4D00]">
              Voir tout
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredBoutiques.map((store) => (
              <StorefrontShowcaseCard key={store.id} store={store} />
            ))}
          </div>
        </article>
      ) : null}

      {homeContent?.top_banner_url && !hasActiveFilter ? (
        <Link
          href="/search"
          className="premium-card mt-5 block overflow-hidden border border-[#FF4D00]/40 bg-white shadow-[0_0_20px_rgba(255,77,0,0.22)]"
        >
          <div className="relative h-36 w-full sm:h-48">
            <Image
              src={resolveImageUrl(homeContent.top_banner_url) || homeContent.top_banner_url}
              alt="Banniere publicitaire AMAZER"
              fill
              unoptimized
              loading="lazy"
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </Link>
      ) : null}

      <div id="search" className="premium-card mt-5 border border-slate-200 bg-white p-5">
        <div className="group relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#FF4D00]" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (barcode) {
                setBarcode("");
              }
            }}
            placeholder="Rechercher un produit, une marque, une categorie..."
            className="h-14 rounded-xl border-slate-200 bg-white pl-12 pr-28 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#FF4D00]/55 group-hover:shadow-[0_0_24px_rgba(255,77,0,0.25)]"
          />
          <BarcodeScannerDrawer onDetected={onBarcodeDetected} />
        </div>
        <div className="mt-3 flex justify-end">
          <Drawer.Root>
            <Drawer.Trigger asChild>
              <Button
                type="button"
                size="sm"
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <SlidersHorizontal className="h-4 w-4 text-[#FF4D00]" />
                Reglages scanner
              </Button>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/30" />
              <Drawer.Content className="fixed bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-xl">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
                <p className="mt-4 text-sm font-semibold text-slate-900">Scanner mobile</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                  <li>Utilise la camera arriere pour les code-barres longs.</li>
                  <li>Un scan reussi declenche une vibration legere.</li>
                  <li>La recherche barcode est lancee automatiquement.</li>
                </ul>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>
      </div>

      {activeShelf === "restaurant" ? (
        <article className="premium-card mt-5 border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-5">
          <h2 className="luxury-title text-xl font-semibold text-slate-900">Restaurant Appetissant</h2>
          <p className="mt-1 text-sm text-slate-600">Selection chaude du jour pour livraison a Niamey.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(homeContent?.sections ?? [])
              .flatMap((section) =>
                section.restaurants.map((entry) => ({ ...entry, sectionSlug: section.slug }))
              )
              .slice(0, 6)
              .map((restaurant) => (
                <Link
                  key={restaurant.id}
                  href="/restaurant"
                  className="rounded-xl border border-orange-200 bg-white p-4 shadow-[0_0_16px_rgba(251,146,60,0.2)]"
                >
                  <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    Plat du Jour
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{restaurant.name}</p>
                </Link>
              ))}
          </div>
        </article>
      ) : null}

      <div className="mt-8">
        <p className="text-sm text-slate-600">
          {statusLabel}
          {isFetching && !isPending ? " (mise a jour...)" : ""}
        </p>
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {showSkeletons ? (
            <motion.div
              key="skeleton-grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))}
            </motion.div>
          ) : null}

          {!showSkeletons && boostedResults.length > 0 ? (
            <motion.div
              key="results-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 22 }}
              className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {boostedResults.map((product: ProductSearchItem, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 230, damping: 18, delay: index * 0.04 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          ) : null}

          {!showSkeletons && isEmptyState ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xl"
            >
              <SearchX className="mx-auto h-10 w-10 text-[#FF4D00]" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900">Aucun resultat</h2>
              <p className="mt-2 text-sm text-slate-500">
                Aucun produit ne correspond a cette recherche.
              </p>
              <Button
                type="button"
                onClick={() => {
                  setQuery("");
                  setBarcode("");
                }}
                className="primary-glow-btn mt-6 bg-[#FF4D00] text-white hover:bg-[#e74700]"
              >
                Reinitialiser la recherche
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {!hasActiveFilter && homeContent?.sections?.length ? (
        <div className="mt-10 space-y-7">
          {homeContent.sections.map((section) => {
            const sectionProducts = withBoostRotation(section.products);
            return (
              <section key={section.id} className="space-y-3">
                <h2 className="luxury-title text-2xl font-semibold text-slate-900">{section.title}</h2>

                {sectionProducts.length ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {sectionProducts.map((item) => (
                      <article
                        key={item.id}
                        className={`premium-card overflow-hidden border bg-white p-4 ${
                          item.is_boosted
                            ? "border-amber-400/60 shadow-[0_0_24px_rgba(245,158,11,0.35)]"
                            : "border-slate-200"
                        }`}
                      >
                        <p className="text-xs uppercase tracking-wide text-slate-500">{item.brand}</p>
                        {(item.is_boosted || item.is_sponsored) && (
                          <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Sponsorise
                          </span>
                        )}
                        <h3 className="mt-2 line-clamp-2 text-base font-semibold text-slate-900">{item.name}</h3>
                        <p className="mt-2 text-lg font-semibold text-[#FF4D00]">
                          {formatMoney(item.amount, preferredCurrency)}
                        </p>
                        <Button
                          asChild
                          className="primary-glow-btn mt-3 w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
                        >
                          <Link
                            href={`/product/${item.id}`}
                            onClick={() => {
                              if (item.is_boosted || item.is_sponsored) {
                                void trackAdClick(item.id, section.slug);
                              }
                            }}
                          >
                            Voir le detail
                          </Link>
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : null}

                {section.restaurants.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {section.restaurants.map((restaurant) => (
                      <Link
                        key={restaurant.id}
                        href="/restaurant"
                        className="premium-card border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4 text-sm font-medium text-slate-800"
                      >
                        <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                          Plat du Jour
                        </span>
                        <p className="mt-2">{restaurant.name}</p>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}

      {contactInfo && (contactInfo.support_email || contactInfo.support_phone || contactInfo.support_whatsapp) ? (
        <article className="premium-card mt-10 border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">Contact AMAZER</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {contactInfo.support_email ? <p>Email: {contactInfo.support_email}</p> : null}
            {contactInfo.support_phone ? <p>Telephone: {contactInfo.support_phone}</p> : null}
            {contactInfo.support_whatsapp ? <p>WhatsApp: {contactInfo.support_whatsapp}</p> : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}
