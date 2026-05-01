"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Input } from "@/components/ui/input";
import { getProductRoute } from "@/lib/mobile-routes";
import { resolveProductImageUrl } from "@/lib/product-image";
import { listPromotions } from "@/services/catalog-service";

export default function PromotionsPage() {
  const [query, setQuery] = useState("");
  const { data: promotions = [], isPending } = useQuery({
    queryKey: ["catalog-promotions", query],
    queryFn: () => listPromotions(query),
  });

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Produits en promotion</h1>
        <p className="mt-2 text-sm text-slate-600">Les meilleures offres du moment chez les vendeurs.</p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une promo..."
          className="mt-4"
        />
      </header>

      {isPending ? (
        <ProductCardSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {promotions.map((item) => {
            const imageSrc = resolveProductImageUrl({
              raw: item.main_image_url,
              categorySlug: item.category_slug,
            });
            return (
              <article key={`${item.product_id}-${item.vendor.id}`} className="premium-card border border-orange-200 bg-white p-4">
                <div className="relative h-40 overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={imageSrc}
                    alt={item.product_name}
                    fill
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                    quality={82}
                    className="object-cover"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">{item.brand}</p>
                <h2 className="line-clamp-2 text-base font-semibold text-slate-900">{item.product_name}</h2>
                <p className="mt-1 text-xs text-slate-500">Vendeur: {item.vendor.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-slate-400 line-through">{Math.round(item.original_amount)} XOF</p>
                  <p className="text-lg font-semibold text-[#FF4D00]">{Math.round(item.promo_amount)} XOF</p>
                </div>
                <p className="text-xs text-slate-500">
                  {item.promo_until ? `Valable jusqu'au ${new Date(item.promo_until).toLocaleString("fr-FR")}` : "Promo active"}
                </p>
                <Link
                  href={getProductRoute(item.product_id)}
                  className="primary-glow-btn mt-3 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm text-white"
                >
                  Voir le produit
                </Link>
              </article>
            );
          })}
          {!promotions.length ? (
            <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Aucune promotion active.
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
