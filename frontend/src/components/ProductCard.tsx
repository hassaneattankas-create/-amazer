"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Package, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getProductRoute } from "@/lib/mobile-routes";
import { AnimatedPrice } from "@/components/AnimatedPrice";
import { productFallbackImage, resolveProductImageUrl } from "@/lib/product-image";
import { trackAdClick } from "@/services/content-service";
import { ProductSearchItem } from "@/types/product";

type ProductCardProps = {
  product: ProductSearchItem;
  /** First screen cards: prefetch image for faster LCP */
  priority?: boolean;
};

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const {
    name,
    brand,
    description,
    main_image_url,
    is_sponsored,
    is_boosted,
    best_offer: { amount, stock_quantity, vendor },
  } = product;

  const adBadge = is_boosted ? "Sponsorise" : is_sponsored ? "Sponsoris\u00e9" : null;
  const fallbackImage = product.images?.length ? product.images[0].image_url : null;
  const resolvedImageUrl = useMemo(
    () =>
      resolveProductImageUrl({
        raw: main_image_url ?? fallbackImage,
        categorySlug: product.category?.slug,
      }),
    [fallbackImage, main_image_url, product.category?.slug]
  );
  const fallbackImageUrl = productFallbackImage(product.category?.slug);
  const displayImageUrl = imageError ? fallbackImageUrl : resolvedImageUrl;

  const onOpenDetail = () => {
    if (is_boosted || is_sponsored) {
      void trackAdClick(product.id);
    }
  };

  return (
    <motion.article
      whileHover={{ y: -8, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className={`premium-card hover-lift-glow overflow-hidden border bg-white/70 ${
        is_boosted
          ? "border-amber-300/70 shadow-[0_20px_50px_rgba(255,77,0,0.24)]"
          : "border-white/20"
      }`}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {displayImageUrl ? (
          <Image
            src={displayImageUrl}
            alt={name}
            width={560}
            height={420}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 384px"
            quality={82}
            unoptimized
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Package className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{brand}</p>
          {adBadge ? (
            <p className="mt-1 inline-flex rounded-full border border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700">
              {adBadge}
            </p>
          ) : null}
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900">{name}</h3>
          {description ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{description}</p> : null}
        </div>

        <div className="flex items-center justify-between text-sm">
          <AnimatedPrice value={amount} className="font-semibold text-[#FF4D00]" />
          <p className={stock_quantity > 0 ? "text-emerald-600" : "text-rose-500"}>
            {stock_quantity > 0 ? `Stock: ${stock_quantity}` : "Rupture"}
          </p>
        </div>

        <p className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Store className="h-3.5 w-3.5 text-[#FF4D00]" />
          {vendor.name}
          {vendor.is_verified ? (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              Verifie
            </span>
          ) : null}
        </p>

        <Button
          asChild
          size="sm"
          className="primary-glow-btn shine-btn w-full"
        >
          <Link href={getProductRoute(product.id)} onClick={onOpenDetail}>
            Voir le detail
          </Link>
        </Button>
      </div>
    </motion.article>
  );
}
