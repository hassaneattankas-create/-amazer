"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Store, Truck } from "lucide-react";

import { ConvertedPrice } from "@/components/ConvertedPrice";
import { PRODUCT_GRID_CLASS } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { resolveProductImageUrl } from "@/lib/product-image";
import { getResellerShop, type ResellerPublicItem } from "@/services/reseller-service";
import { useCartStore } from "@/store/cartStore";
import type { Offer } from "@/types/product";

// Offre minimale pour le panier : le prix affiche est celui du revendeur ; le serveur le relit.
function toOffer(item: ResellerPublicItem): Offer {
  return {
    price_id: item.price_id,
    vendor: { id: item.vendor_id, name: "AMAZER", slug: "amazer", is_active: true, is_verified: true },
    currency: "XOF",
    amount: item.price,
    stock_quantity: 99,
    is_active: true,
    ranking: { price_competitiveness: 0, stock_signal: 0, text_relevance: 0, vendor_signal: 0, score_total: 0 },
  };
}

/** Boutique publique d'un revendeur : produits AMAZER, paiement controle et livraison AMAZER. */
export function ResellerShopView({ resellerId }: { resellerId: string }) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState("");
  const { data, isPending, isError } = useQuery({
    queryKey: ["reseller-shop", resellerId],
    queryFn: () => getResellerShop(resellerId),
    enabled: Boolean(resellerId),
    staleTime: 60_000,
  });

  const add = (item: ResellerPublicItem) => {
    addItem({ productId: item.product_id, name: item.product_name, offersSnapshot: [toOffer(item)], quantity: 1, resellerListingId: item.id });
    setAdded(item.id);
    window.setTimeout(() => setAdded(""), 2400);
  };

  if (isError) {
    return (
      <section className="mx-auto w-full max-w-2xl px-gutter py-8 text-center">
        <h1 className="text-xl font-semibold text-ink-900">Boutique introuvable</h1>
        <Button asChild className="mt-4">
          <Link href="/">Découvrir AMAZER</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-14 pt-4">
      <header className="rounded-card border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-ink-900 text-white">
            <Store className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">
              {data ? `La boutique de ${data.reseller_name}` : "Boutique"}
            </h1>
            <p className="text-sm text-ink-600">Sélection de produits AMAZER</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-700">
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
            Paiement contrôlé par AMAZER
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-success" aria-hidden="true" />
            Livraison par les livreurs AMAZER
          </li>
        </ul>
      </header>

      <div className="mt-4">
        {isPending ? (
          <div className={PRODUCT_GRID_CLASS} aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductCardSkeleton key={index} variant="tile" />
            ))}
          </div>
        ) : data && !data.active ? (
          <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">
            Cette boutique est momentanément indisponible.{" "}
            <Link href="/" className="font-medium text-brand-700 hover:underline">
              Découvrir AMAZER
            </Link>
          </p>
        ) : data?.items.length ? (
          <div className={PRODUCT_GRID_CLASS}>
            {data.items.map((item) => (
              <article key={item.id} className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
                <div className="relative aspect-square bg-surface-1">
                  <Image
                    src={resolveProductImageUrl({ raw: item.image_url })}
                    alt={item.product_name}
                    fill
                    sizes="(max-width: 640px) 50vw, 240px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="text-base font-bold text-ink-900">{formatXOF(item.price)}</p>
                  <ConvertedPrice amount={item.price} />
                  <h2 className="line-clamp-2 text-sm text-ink-800">{item.product_name}</h2>
                  <Button type="button" size="sm" className="mt-auto" onClick={() => add(item)}>
                    {added === item.id ? "Ajouté ✓" : "Ajouter au panier"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">
            Cette boutique n&apos;a pas encore de produits.
          </p>
        )}
      </div>

      {added ? (
        <p className="fixed inset-x-0 bottom-4 z-toast mx-auto w-fit rounded-pill bg-ink-900 px-4 py-2 text-sm text-white" role="status">
          Ajouté au panier ·{" "}
          <Link href="/cart" className="font-semibold underline">
            Voir le panier
          </Link>
        </p>
      ) : null}
    </section>
  );
}
