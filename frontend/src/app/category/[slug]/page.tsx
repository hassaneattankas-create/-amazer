"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { resolveCategoryQuery } from "@/lib/categories";
import { searchProducts } from "@/services/product-service";

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data, isPending } = useQuery({
    queryKey: ["category-products", slug],
    staleTime: 120_000,
    refetchOnWindowFocus: false,
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
  });

  const title = useMemo(() => slug.replace("-", " "), [slug]);
  const items = useMemo(() => data?.items ?? [], [data?.items]);

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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 6} />
          ))}
        </div>
      )}
    </section>
  );
}
