"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Store, Tag } from "lucide-react";

import { useConvertedPrice } from "@/hooks/use-converted-price";
import { formatXOF } from "@/lib/currency";
import { useT } from "@/lib/i18n";
import { getProductRoute, getShopRoute } from "@/lib/mobile-routes";
import { resolveImageUrl } from "@/lib/image";
import { resolveProductImageUrl } from "@/lib/product-image";
import type { PromotionItem, VendorStorefront } from "@/types/catalog";

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <Link href={href} className="inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-brand-700 hover:underline">
        {linkLabel}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

const railClass = "-mx-gutter mt-2 flex snap-x gap-3 overflow-x-auto px-gutter pb-1";

/** Rangee « Bonnes affaires » : produits en promotion, defilement horizontal. */
export function PromotionsRail({ items }: { items: PromotionItem[] }) {
  const t = useT();
  const convert = useConvertedPrice();
  if (!items.length) return null;
  return (
    <section className="mt-6" aria-label={t("Bonnes affaires")}>
      <SectionHeader title={t("Bonnes affaires")} href="/promotions" linkLabel={t("Voir tout")} />
      <ul className={railClass}>
        {items.slice(0, 12).map((promo) => {
          const image = resolveProductImageUrl({ raw: promo.main_image_url, categorySlug: promo.category_slug });
          const discount =
            promo.original_amount > promo.promo_amount
              ? Math.round(((promo.original_amount - promo.promo_amount) / promo.original_amount) * 100)
              : 0;
          const converted = convert(promo.promo_amount);
          return (
            <li key={promo.product_id} className="w-36 shrink-0 snap-start sm:w-44">
              <Link
                href={getProductRoute(promo.product_id)}
                className="group block overflow-hidden rounded-card border border-border bg-card"
              >
                <div className="relative aspect-square bg-surface-1">
                  {image ? (
                    <Image src={image} alt={promo.product_name} fill sizes="176px" unoptimized className="object-cover" />
                  ) : (
                    <Tag className="absolute inset-0 m-auto h-8 w-8 text-ink-400" aria-hidden="true" />
                  )}
                  {discount > 0 ? (
                    <span className="absolute left-2 top-2 rounded-pill bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                      -{discount}%
                    </span>
                  ) : null}
                </div>
                <div className="p-2">
                  <p className="text-sm font-bold text-ink-900">{formatXOF(promo.promo_amount)}</p>
                  {converted ? <p className="text-xs text-ink-600">{converted}</p> : null}
                  <p className="line-clamp-2 text-xs text-ink-700 group-hover:text-brand-700">{promo.product_name}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Rangee « Boutiques a la une » : boutiques verifiees ou premium, les plus fournies d'abord. */
export function FeaturedShopsRail({ shops }: { shops: VendorStorefront[] }) {
  const t = useT();
  const featured = shops
    .filter((shop) => !shop.service_kind && (shop.is_verified || shop.storefront_tier === "premium"))
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 12);
  if (!featured.length) return null;
  return (
    <section className="mt-6" aria-label={t("Boutiques à la une")}>
      <SectionHeader title={t("Boutiques à la une")} href="/boutiques" linkLabel={t("Voir tout")} />
      <ul className={railClass}>
        {featured.map((shop) => {
          const logo = resolveImageUrl(shop.logo_url);
          return (
            <li key={shop.id} className="w-44 shrink-0 snap-start sm:w-52">
              <Link
                href={getShopRoute(shop.id)}
                className="flex h-full items-center gap-3 rounded-card border border-border bg-card p-3 hover:border-ink-400"
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-pill bg-surface-1">
                  {logo ? (
                    <Image src={logo} alt="" fill sizes="48px" unoptimized className="object-cover" />
                  ) : (
                    <Store className="absolute inset-0 m-auto h-5 w-5 text-ink-400" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold text-ink-900">
                    <span className="truncate">{shop.business_name || shop.name}</span>
                    {shop.is_verified ? (
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-label={t("Boutique vérifiée")} />
                    ) : null}
                  </span>
                  {shop.product_count > 0 ? (
                    <span className="block text-xs text-ink-600">
                      {t(shop.product_count > 1 ? "{n} articles" : "{n} article", { n: shop.product_count })}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
