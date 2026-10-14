"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight, Package, Phone, ShieldCheck, Store, Truck } from "lucide-react";

import { PRODUCT_GRID_CLASS, ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { ReviewSystem } from "@/components/ReviewSystem";
import { VendorOffer } from "@/components/VendorOffer";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { getCategoryRoute, getShopRoute } from "@/lib/mobile-routes";
import { resolveProductImageUrl } from "@/lib/product-image";
import { getProductDetailById, getProductRecommendations } from "@/services/product-service";
import { useCartStore } from "@/store/cartStore";
import { WhatsAppButton } from "@/components/contact/WhatsAppButton";

const ProductPriceHistoryChart = dynamic(
  () => import("@/components/product/ProductPriceHistoryChart").then((mod) => mod.ProductPriceHistoryChart),
  { ssr: false, loading: () => <div className="mt-4 h-48 animate-pulse rounded-field bg-surface-2" /> }
);

const sectionClass = "rounded-card border border-border bg-card";
const summaryClass =
  "flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-ink-900";

export function ProductDetailView({ productId }: { productId: string }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const [cartMessage, setCartMessage] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [imageError, setImageError] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ["product-detail", productId],
    queryFn: () => getProductDetailById(productId),
    enabled: Boolean(productId),
    staleTime: 15_000,
  });
  const { data: recommendations } = useQuery({
    queryKey: ["product-reco", productId],
    queryFn: () => getProductRecommendations(productId, 5),
    enabled: Boolean(productId),
  });

  const gallery = useMemo(() => {
    if (!data) return [] as string[];
    const raw = [data.product.main_image_url, ...(data.product.images ?? []).map((image) => image.image_url)];
    const resolved = raw
      .map((url) => resolveProductImageUrl({ raw: url ?? null, categorySlug: data.product.category?.slug }))
      .filter((url): url is string => Boolean(url));
    return Array.from(new Set(resolved));
  }, [data]);

  const chartData = useMemo(
    () =>
      (data?.price_history ?? []).map((point) => ({
        ...point,
        date: new Date(point.changed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      })),
    [data?.price_history]
  );
  const minAmount = chartData.length ? Math.floor(Math.min(...chartData.map((point) => point.amount)) - 2) : 0;

  if (isPending) {
    return (
      <section className="mx-auto grid w-full max-w-7xl gap-6 px-gutter py-6 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-card bg-surface-2" aria-hidden="true" />
        <ProductCardSkeleton />
      </section>
    );
  }

  if (isError || !data || !data.offers.length) {
    return (
      <section className="mx-auto w-full max-w-3xl px-gutter py-10">
        <div className={`${sectionClass} p-8 text-center`}>
          <Package className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-ink-900">Produit introuvable</h1>
          <p className="mt-1 text-sm text-ink-600">Ce produit n&apos;est plus disponible ou le lien est incorrect.</p>
          <Button asChild className="mt-5">
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </section>
    );
  }

  const { product, offers } = data;
  const best = offers[0];
  const inStock = best.stock_quantity > 0;
  const originalPrice = typeof product.specs?.original_price === "number" ? (product.specs.original_price as number) : null;
  const isOnPromo = originalPrice !== null && originalPrice > best.amount;
  const currentImage = gallery[activeImage] ?? null;

  const addToCart = () => {
    addItem({ productId: product.id, name: product.name, offersSnapshot: [best], quantity: 1 });
    setCartMessage("Ajouté au panier.");
    window.setTimeout(() => setCartMessage(""), 2400);
  };
  const buyNow = () => {
    addItem({ productId: product.id, name: product.name, offersSnapshot: [best], quantity: 1 });
    router.push("/cart");
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-32 pt-4 md:pb-16">
      <nav aria-label="Fil d'Ariane" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-600">
        <Link href="/" className="hover:text-brand-700 hover:underline">
          Accueil
        </Link>
        {product.category ? (
          <>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <Link href={getCategoryRoute(product.category.slug)} className="hover:text-brand-700 hover:underline">
              {product.category.name}
            </Link>
          </>
        ) : null}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="line-clamp-1 text-ink-800">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-surface-1">
            {currentImage && !imageError ? (
              <Image
                src={currentImage}
                alt={product.name}
                width={900}
                height={900}
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                quality={85}
                unoptimized
                className="h-full w-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-400" aria-hidden="true">
                <Package className="h-16 w-16" />
              </div>
            )}
          </div>
          {gallery.length > 1 ? (
            <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Photos du produit">
              {gallery.map((url, index) => (
                <li key={url} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveImage(index);
                      setImageError(false);
                    }}
                    aria-label={`Photo ${index + 1}`}
                    aria-current={index === activeImage ? "true" : undefined}
                    className={`h-16 w-16 overflow-hidden rounded-field border-2 bg-surface-1 ${
                      index === activeImage ? "border-brand-600" : "border-border hover:border-ink-400"
                    }`}
                  >
                    <Image src={url} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            {product.brand ? <p className="text-sm uppercase tracking-label text-ink-600">{product.brand}</p> : null}
            <h1 className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">{product.name}</h1>
          </div>

          <div>
            <p className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-ink-900">{formatXOF(best.amount)}</span>
              {isOnPromo && originalPrice ? (
                <span className="text-base text-ink-500 line-through">{formatXOF(originalPrice)}</span>
              ) : null}
            </p>
            <p className={`mt-1 text-sm font-medium ${inStock ? "text-success" : "text-danger"}`}>
              {inStock ? (best.stock_quantity <= 3 ? `Plus que ${best.stock_quantity} en stock` : "En stock") : "Rupture de stock"}
            </p>
          </div>

          <div className={`${sectionClass} p-4`}>
            <p className="text-sm text-ink-600">Vendu par</p>
            <p className="mt-0.5 flex items-center gap-1 font-semibold text-ink-900">
              <Store className="h-4 w-4 text-ink-500" aria-hidden="true" />
              {best.vendor.name}
              {best.vendor.is_verified ? (
                <BadgeCheck className="h-4 w-4 text-success" aria-label="Boutique vérifiée" />
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href={getShopRoute(best.vendor.id)} className="font-medium text-brand-700 hover:underline">
                Voir la boutique
              </Link>
              <Link
                href={`/messages?vendor=${encodeURIComponent(best.vendor.id)}&name=${encodeURIComponent(best.vendor.name)}`}
                className="font-medium text-brand-700 hover:underline"
              >
                Écrire à la boutique
              </Link>
            </div>
            {best.vendor.whatsapp_contact ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm text-ink-600">Une question sur ce produit ? Contactez le vendeur.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={`tel:${best.vendor.whatsapp_contact.replace(/\s/g, "")}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Appeler
                  </a>
                  <WhatsAppButton
                    phone={best.vendor.whatsapp_contact}
                    variant="outline"
                    label="WhatsApp"
                    message={`Bonjour, j'ai vu votre produit sur AMAZER : ${product.name}`}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" size="lg" onClick={addToCart} disabled={!inStock}>
              Ajouter au panier
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={buyNow} disabled={!inStock}>
              Acheter maintenant
            </Button>
          </div>
          {cartMessage ? (
            <p className="-mt-2 text-sm text-success" role="status">
              {cartMessage}{" "}
              <Link href="/cart" className="font-medium underline">
                Voir le panier
              </Link>
            </p>
          ) : null}

          <ul className="space-y-2 text-sm text-ink-700">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              Paiement contrôlé par AMAZER avant toute préparation
            </li>
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              Livraison à Niamey, frais affichés avant la commande
            </li>
            <li className="text-xs text-ink-600">
              Protégé seulement si vous payez sur AMAZER et êtes livré par un livreur AMAZER.{" "}
              <Link href="/legal/terms" className="font-medium underline">
                Conditions
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {product.description ? (
          <details open className={sectionClass}>
            <summary className={summaryClass}>Description</summary>
            <p className="whitespace-pre-line px-4 pb-4 text-sm text-ink-700">{product.description}</p>
          </details>
        ) : null}

        {offers.length > 1 ? (
          <details open className={sectionClass}>
            <summary className={summaryClass}>
              {offers.length} offres pour ce produit
              <span className="text-sm font-normal text-ink-600">du moins cher au plus cher</span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              {offers.map((offer) => (
                <VendorOffer key={offer.price_id} offer={offer} />
              ))}
            </div>
          </details>
        ) : null}

        {chartData.length > 1 ? (
          <details className={sectionClass}>
            <summary className={summaryClass}>Évolution du prix</summary>
            <div className="px-4 pb-4">
              <ProductPriceHistoryChart chartData={chartData} minAmount={minAmount} />
            </div>
          </details>
        ) : null}
      </div>

      <div className="mt-8">
        <ReviewSystem productId={productId} />
      </div>

      {/* Barre d'achat toujours visible sur mobile (standard des grandes places de marche). */}
      <div
        className="fixed inset-x-0 bottom-0 z-sticky flex items-center gap-3 border-t border-border bg-card px-gutter pt-3 shadow-floating md:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-ink-900">{formatXOF(best.amount)}</p>
          <p className={`text-xs ${inStock ? "text-success" : "text-danger"}`}>{inStock ? "En stock" : "Rupture de stock"}</p>
        </div>
        <Button type="button" size="lg" onClick={addToCart} disabled={!inStock} className="shrink-0">
          {cartMessage ? "Ajouté ✓" : "Ajouter au panier"}
        </Button>
      </div>

      {recommendations?.items?.length ? (
        <section aria-labelledby="similar-title" className="mt-10">
          <h2 id="similar-title" className="text-lg font-semibold text-ink-900">
            Produits similaires
          </h2>
          <div className={`mt-3 ${PRODUCT_GRID_CLASS}`}>
            {recommendations.items.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
