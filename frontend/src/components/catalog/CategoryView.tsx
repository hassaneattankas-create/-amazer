"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, SearchX } from "lucide-react";

import { PRODUCT_GRID_CLASS, ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { SearchToolbar, type PriceFilter } from "@/components/search/SearchToolbar";
import { Button } from "@/components/ui/button";
import { useProductSearch } from "@/hooks/use-product-search";
import { useT } from "@/lib/i18n";
import { getCategoryRoute } from "@/lib/mobile-routes";
import { listCatalogCategories } from "@/services/catalog-service";
import type { SearchSort } from "@/types/product";

const PAGE_SIZE = 24;

/** Page rayon a la maniere d'Amazon : fil d'Ariane, nombre d'articles, tri, filtres, autres rayons. */
export function CategoryView({ slug }: { slug: string }) {
  const t = useT();
  const [sort, setSort] = useState<SearchSort>("newest");
  const [price, setPrice] = useState<PriceFilter>({});
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: listCatalogCategories,
    staleTime: 10 * 60_000,
  });
  const category = categories.find((item) => item.slug === slug);
  const title = t(category?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "));

  const { data, isPending, isFetching, isError } = useProductSearch({
    query: "",
    barcode: "",
    limit,
    categorySlug: slug,
    sort,
    minPrice: price.min,
    maxPrice: price.max,
    inStockOnly: !includeOutOfStock,
  });
  const products = data?.items ?? [];
  const showSkeletons = isPending || (isFetching && products.length === 0);

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-14 pt-4">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-ink-600">
        <Link href="/" className="hover:text-ink-900 hover:underline">
          {t("Accueil")}
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-ink-900">{title}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-semibold text-ink-900">{title}</h1>

      <nav aria-label={t("Catégories")} className="-mx-gutter mt-3 overflow-x-auto px-gutter">
        <ul className="flex gap-2">
          {categories.map((item) => (
            <li key={item.slug} className="shrink-0">
              <Link
                href={getCategoryRoute(item.slug)}
                aria-current={item.slug === slug ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium ${
                  item.slug === slug ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
                }`}
              >
                {t(item.name)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4">
        <SearchToolbar
          resultCount={showSkeletons ? null : products.length}
          isUpdating={isFetching && !isPending}
          hasTextQuery={false}
          sort={sort}
          onSortChange={setSort}
          price={price}
          onPriceChange={setPrice}
          includeOutOfStock={includeOutOfStock}
          onIncludeOutOfStockChange={setIncludeOutOfStock}
        />
      </div>

      <div className="mt-4">
        {showSkeletons ? (
          <div className={PRODUCT_GRID_CLASS} aria-busy="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <ProductCardSkeleton key={index} variant="tile" />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-700">
            {t("Impossible de charger les produits. Vérifiez votre connexion.")}
          </p>
        ) : products.length ? (
          <>
            <div className={PRODUCT_GRID_CLASS}>
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 4} />
              ))}
            </div>
            {(data?.meta.returned ?? 0) >= limit ? (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="outline" disabled={isFetching} onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                  {isFetching ? t("Chargement…") : t("Voir plus de produits")}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <SearchX className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
            <p className="mt-3 font-semibold text-ink-900">{t("Aucun produit trouvé")}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">{t("Accueil")}</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
