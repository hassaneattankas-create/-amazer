"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Package, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnimatedPrice } from "@/components/AnimatedPrice";
import { trackAdClick } from "@/services/content-service";
import { ProductSearchItem } from "@/types/product";

type ProductCardProps = {
  product: ProductSearchItem;
};

export function ProductCard({ product }: ProductCardProps) {
  const {
    name,
    brand,
    description,
    main_image_url,
    is_sponsored,
    is_boosted,
    best_offer: { amount, stock_quantity, vendor },
  } = product;

  const adBadge = is_boosted ? "Sponsorise" : is_sponsored ? "Annonce" : null;

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
        {main_image_url ? (
          <Image
            src={main_image_url}
            alt={name}
            width={640}
            height={480}
            unoptimized
            loading="lazy"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="h-full w-full object-cover"
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
        </p>

        <Button
          asChild
          size="sm"
          className="primary-glow-btn shine-btn w-full"
        >
          <Link href={`/product/${product.id}`} onClick={onOpenDetail}>
            Voir le detail
          </Link>
        </Button>
      </div>
    </motion.article>
  );
}
