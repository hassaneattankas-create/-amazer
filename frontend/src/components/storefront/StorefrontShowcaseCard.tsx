"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, BedDouble, Bus, ChevronRight, Fuel, MapPin, Pill, Store, UtensilsCrossed } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { getShopRoute } from "@/lib/mobile-routes";
import type { VendorStorefront } from "@/types/catalog";

const activityMeta = {
  shop: { label: "Boutique", icon: Store },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed },
  hotel: { label: "Premium", icon: BedDouble },
  enterprise: { label: "Premium", icon: Store },
  transport: { label: "Transport", icon: Bus },
  pharmacy: { label: "Pharmacie", icon: Pill },
  station: { label: "Station-essence", icon: Fuel },
} as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** Resume d'activite : seuls les compteurs non nuls sont affiches. */
function activitySummary(store: VendorStorefront): string {
  const parts: string[] = [];
  if (store.product_count) parts.push(`${store.product_count} produit${store.product_count > 1 ? "s" : ""}`);
  if (store.service_count) parts.push(`${store.service_count} service${store.service_count > 1 ? "s" : ""}`);
  if (store.room_type_count) {
    const unit = store.offers_transport ? "trajet" : "chambre";
    parts.push(`${store.room_type_count} ${unit}${store.room_type_count > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
}

export function StorefrontShowcaseCard({
  store,
  ctaLabel = "Voir la boutique",
}: {
  store: VendorStorefront;
  ctaLabel?: string;
}) {
  const activityKey: keyof typeof activityMeta =
    store.service_kind === "pharmacy"
      ? "pharmacy"
      : store.service_kind === "fuel_station"
        ? "station"
        : store.offers_transport
          ? "transport"
          : store.activity_type === "restaurant" ||
    store.activity_type === "hotel" ||
    store.activity_type === "enterprise" ||
    store.activity_type === "transport"
      ? store.activity_type
      : "shop";
  const meta = activityMeta[activityKey];
  const ActivityIcon = meta.icon;
  const name = store.business_name || store.name;
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const coverUrl = coverFailed ? null : resolveImageUrl(store.cover_image_url, 800);
  const logoUrl = logoFailed ? null : resolveImageUrl(store.logo_url, 200);
  const summary = activitySummary(store);

  return (
    <Link
      href={getShopRoute(store.id)}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-card transition-shadow duration-base ease-out-quint hover:shadow-raised focus-visible:shadow-focus"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-surface-3">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={75}
            className="object-cover transition-transform duration-slow ease-out-quint group-hover:scale-105"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="select-none text-5xl font-bold text-ink-300">{getInitials(name)}</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-pill bg-card/95 px-2.5 py-1 text-xs font-semibold text-ink-800">
          {meta.label}
        </span>
        {store.badge_label ? (
          <span className="absolute right-3 top-3 rounded-pill bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
            {store.badge_label}
          </span>
        ) : null}
      </div>

      <div className="relative flex flex-1 flex-col gap-2 px-4 pb-4 pt-8">
        <div className="absolute -top-7 left-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-card border-4 border-card bg-surface-1 shadow-resting">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`Logo ${name}`}
              width={56}
              height={56}
              sizes="56px"
              quality={80}
              className="h-full w-full object-cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <ActivityIcon className="h-6 w-6 text-ink-500" aria-hidden="true" />
          )}
        </div>

        <h2 className="flex items-center gap-1 text-base font-semibold text-ink-900 group-hover:text-brand-700">
          <span className="truncate">{name}</span>
          {store.is_verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-label="Boutique vérifiée" /> : null}
        </h2>
        <p className="flex items-center gap-1 text-xs text-ink-600">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {store.city || "Niamey"}
          {summary ? <span aria-hidden="true">·</span> : null}
          {summary ? <span>{summary}</span> : null}
        </p>
        {store.description ? <p className="line-clamp-2 text-sm text-ink-700">{store.description}</p> : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          {store.starting_price ? (
            <p className="text-sm text-ink-700">
              À partir de <span className="font-bold text-ink-900">{formatXOF(store.starting_price)}</span>
            </p>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
            {ctaLabel}
            <ChevronRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
