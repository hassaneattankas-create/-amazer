"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { resolveCategoryQuery } from "@/lib/categories";
import { getProductRoute } from "@/lib/mobile-routes";
import { searchProducts } from "@/services/product-service";
import { trackAdClick } from "@/services/content-service";

function shuffleItems<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function CategoryPageContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const { data, isPending } = useQuery({
    queryKey: ["category-products", slug],
    queryFn: async () => {
      const strict = await searchProducts({
        categorySlug: slug,
        sort: "relevance",
        limit: 24,
      });
      if (strict.items.length > 0) {
        return strict;
      }
      return searchProducts({
        query: resolveCategoryQuery(slug),
        sort: "relevance",
        limit: 24,
      });
    },
    enabled: Boolean(slug),
  });

  const title = useMemo(() => slug.replace("-", " "), [slug]);
  const items = useMemo(() => {
    const base = data?.items ?? [];
    const boosted = base.filter((entry) => entry.is_boosted);
    const regular = base.filter((entry) => !entry.is_boosted);
    if (boosted.length <= 3) {
      return [...boosted, ...regular];
    }
    const rotated = shuffleItems(boosted);
    return [...rotated.slice(0, 3), ...regular, ...rotated.slice(3)];
  }, [data?.items]);
  const featured = useMemo(() => shuffleItems(items.filter((entry) => entry.is_boosted)).slice(0, 8), [items]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <Button asChild variant="ghost" className="-ml-3 mb-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
        <h1 className="luxury-title text-3xl font-semibold capitalize">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Produits filtres dynamiquement pour la rubrique {title}.
        </p>
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={`category-skeleton-${index}`} />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {featured.length ? (
            <article className="premium-card border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Featured Carousel</h2>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {featured.map((product) => (
                  <Link
                    key={product.id}
                    href={getProductRoute(product.id)}
                    onClick={() => void trackAdClick(product.id, `category-${slug}`)}
                    className="min-w-56 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-[0_0_16px_rgba(245,158,11,0.28)]"
                  >
                    <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Sponsorise
                    </span>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.brand}</p>
                  </Link>
                ))}
              </div>
            </article>
          ) : null}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6" />}>
      <CategoryPageContent />
    </Suspense>
  );
}
