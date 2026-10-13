"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Package } from "lucide-react";
import { useMemo, useState } from "react";

import { formatXOF } from "@/lib/currency";
import { getProductRoute } from "@/lib/mobile-routes";
import { productFallbackImage, resolveProductImageUrl } from "@/lib/product-image";
import { ProductSearchItem } from "@/types/product";

type ProductCardProps = {
  product: ProductSearchItem;
  /** Cartes du premier ecran : image prechargee pour un meilleur LCP. */
  priority?: boolean;
};

/**
 * Carte produit compacte (standard des grandes places de marche) : toute la carte
 * est cliquable ; la hierarchie est image > prix > nom > boutique.
 */
export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const {
    name,
    brand,
    main_image_url,
    best_offer: { amount, stock_quantity, vendor },
    specs,
  } = product;

  const promoPrice = typeof specs?.promo_price === "number" ? (specs.promo_price as number) : null;
  const originalPrice = typeof specs?.original_price === "number" ? (specs.original_price as number) : null;
  const isOnPromo = promoPrice !== null && originalPrice !== null && originalPrice > amount;
  const discountPercent = isOnPromo && originalPrice ? Math.round((1 - amount / originalPrice) * 100) : 0;
  const inStock = stock_quantity > 0;

  const fallbackImage = product.images?.length ? product.images[0].image_url : null;
  const resolvedImageUrl = useMemo(
    () => resolveProductImageUrl({ raw: main_image_url ?? fallbackImage, categorySlug: product.category?.slug }),
    [fallbackImage, main_image_url, product.category?.slug]
  );
  const displayImageUrl = imageError ? productFallbackImage(product.category?.slug) : resolvedImageUrl;

  return (
    <Link
      href={getProductRoute(product.id)}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-card transition-shadow duration-base ease-out-quint hover:shadow-raised focus-visible:shadow-focus"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-1">
        {displayImageUrl ? (
          <Image
            src={displayImageUrl}
            alt={name}
            width={400}
            height={400}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            quality={75}
            unoptimized
            className="h-full w-full object-cover transition-transform duration-slow ease-out-quint group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-400" aria-hidden="true">
            <Package className="h-10 w-10" />
          </div>
        )}
        {isOnPromo ? (
          <span className="absolute left-2 top-2 rounded-pill bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
            -{discountPercent}%
          </span>
        ) : null}
        {!inStock ? (
          <span className="absolute inset-x-0 bottom-0 bg-ink-900/70 py-1 text-center text-xs font-medium text-white">
            Rupture de stock
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="flex items-baseline gap-2">
          <span className="text-base font-bold text-ink-900">{formatXOF(amount)}</span>
          {isOnPromo && originalPrice ? (
            <span className="text-xs text-ink-500 line-through">{formatXOF(originalPrice)}</span>
          ) : null}
        </p>
        <h3 className="line-clamp-2 text-sm text-ink-800 group-hover:text-brand-700">{name}</h3>
        {brand ? <p className="truncate text-xs uppercase tracking-label text-ink-500">{brand}</p> : null}
        <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-ink-600">
          <span className="truncate">{vendor.name}</span>
          {vendor.is_verified ? (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Boutique vérifiée" />
          ) : null}
        </p>
      </div>
    </Link>
  );
}

/** Grille des listes de produits : 2 colonnes sur mobile, jusqu'a 5 sur grand ecran. */
export const PRODUCT_GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";
