"use client";

import Image from "next/image";
import Link from "next/link";
import { BedDouble, ShieldCheck, Store, UtensilsCrossed } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { getShopRoute } from "@/lib/mobile-routes";
import type { VendorStorefront } from "@/types/catalog";

const activityMeta = {
  shop: { label: "Boutique", icon: Store },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed },
  hotel: { label: "Premium", icon: BedDouble },
  enterprise: { label: "Premium", icon: Store },
} as const;

export function StorefrontShowcaseCard({
  store,
  ctaLabel = "Ouvrir",
}: {
  store: VendorStorefront;
  ctaLabel?: string;
}) {
  const activityKey =
    store.activity_type === "restaurant" ||
    store.activity_type === "hotel" ||
    store.activity_type === "enterprise"
      ? store.activity_type
      : "shop";
  const meta = activityMeta[activityKey];
  const ActivityIcon = meta.icon;
  const imageUrl = resolveImageUrl(store.cover_image_url) || store.cover_image_url;

  return (
    <article className="premium-card hover-lift-glow overflow-hidden border border-white/20 bg-white/70 shadow-[0_24px_60px_rgba(255,77,0,0.24)]">
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-800 to-[#1f2937]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={store.business_name || store.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
            quality={82}
            className="object-cover opacity-90"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/25 to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
            {meta.label}
          </span>
          {store.badge_label ? (
            <span className="rounded-full border border-amber-300/70 bg-amber-100/95 px-3 py-1 text-[11px] font-semibold text-amber-800">
              {store.badge_label}
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
              {store.logo_url ? (
                <Image
                  src={resolveImageUrl(store.logo_url) || store.logo_url}
                  alt={`${store.business_name || store.name} logo`}
                  width={44}
                  height={44}
                  sizes="44px"
                  quality={85}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <ActivityIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{store.business_name || store.name}</h2>
                {store.is_verified ? <ShieldCheck className="h-4 w-4 text-emerald-300" /> : null}
              </div>
              <p className="text-xs text-white/75">{store.city || "Niamey"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {store.description ? (
          <p className="line-clamp-3 text-sm leading-6 text-slate-600">{store.description}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {store.highlight_items.slice(0, 4).map((highlight) => (
            <span
              key={`${store.id}-${highlight}`}
              className="rounded-full border border-[#FF4D00]/20 bg-[#FF4D00]/8 px-2.5 py-1 text-[11px] font-medium text-[#d45510]"
            >
              {highlight}
            </span>
          ))}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            {store.starting_price ? (
              <p className="text-xl font-semibold text-[#FF4D00]">
                {formatXOF(store.starting_price)}
                {store.price_suffix ? (
                  <span className="ml-1 text-xs font-medium text-slate-500">/{store.price_suffix}</span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm font-medium text-slate-500">Mini-site pret a explorer</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {store.product_count} produits / {store.service_count} services / {store.room_type_count} chambres
            </p>
          </div>
          <Link
            href={getShopRoute(store.id)}
            className="primary-glow-btn inline-flex shrink-0 items-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
