"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Store, TrendingUp } from "lucide-react";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { PriceAlertButton } from "@/components/PriceAlertButton";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { ReviewSystem } from "@/components/ReviewSystem";
import { VendorOffer } from "@/components/VendorOffer";
import { Button } from "@/components/ui/button";
import { resolveProductImageUrl } from "@/lib/product-image";
import { getProductDetailById, getProductRecommendations } from "@/services/product-service";
import { useCartStore } from "@/store/cartStore";

const ProductPriceHistoryChart = dynamic(
  () => import("@/components/product/ProductPriceHistoryChart").then((mod) => mod.ProductPriceHistoryChart),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6">
        <ProductCardSkeleton />
      </div>
    ),
  }
);

function ProductDetailPageContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id") ?? "";
  const addItem = useCartStore((state) => state.addItem);
  const [cartMessage, setCartMessage] = useState("");
  const [imageError, setImageError] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ["product-detail", productId],
    queryFn: () => getProductDetailById(productId),
    staleTime: 15_000,
    enabled: Boolean(productId),
  });
  const { data: recommendations } = useQuery({
    queryKey: ["product-reco", productId],
    queryFn: () => getProductRecommendations(productId, 4),
    enabled: Boolean(productId),
  });
  const priceHistory = useMemo(() => data?.price_history ?? [], [data?.price_history]);

  const minAmount = useMemo(() => {
    if (!priceHistory.length) {
      return 0;
    }
    return Math.floor(Math.min(...priceHistory.map((point) => point.amount)) - 2);
  }, [priceHistory]);

  const chartData = useMemo(
    () =>
      priceHistory.map((point) => ({
        ...point,
        date: new Date(point.changed_at).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
      })),
    [priceHistory]
  );
  const detailImageFallback = data?.product.images?.length ? data.product.images[0].image_url : null;
  const detailImageUrl = useMemo(
    () =>
      resolveProductImageUrl({
        raw: data?.product.main_image_url ?? detailImageFallback,
        categorySlug: data?.product.category?.slug,
      }),
    [data?.product.category?.slug, data?.product.main_image_url, detailImageFallback]
  );

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProductCardSkeleton />
          </div>
          <ProductCardSkeleton />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6">
        <div className="premium-card border border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-slate-900">Produit introuvable</p>
          <p className="mt-2 text-sm text-slate-500">Impossible de charger cette fiche produit.</p>
          <Button asChild className="primary-glow-btn mt-5 bg-[#FF4D00] text-white hover:bg-[#e74700]">
            <Link href="/">Retour a l&apos;accueil</Link>
          </Button>
        </div>
      </section>
    );
  }

  const addToSmartCart = () => {
    addItem({
      productId: data.product.id,
      name: data.product.name,
      offersSnapshot: data.offers,
      quantity: 1,
    });
    setCartMessage("Produit ajoute au panier intelligent.");
    window.setTimeout(() => setCartMessage(""), 2400);
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-8 px-4 pb-14 sm:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="premium-card lg:col-span-2 border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-5">
            <div className="h-28 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {detailImageUrl && !imageError ? (
                <Image
                  src={detailImageUrl}
                  alt={data.product.name}
                  width={224}
                  height={224}
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

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.15em] text-[#FF4D00]">{data.product.brand}</p>
              <h1 className="luxury-title mt-1 text-2xl font-semibold sm:text-3xl">
                {data.product.name}
              </h1>
              {data.product.description ? (
                <p className="mt-3 text-sm text-slate-600">{data.product.description}</p>
              ) : null}
            </div>
          </div>
        </article>

        <article className="premium-card border border-slate-200 bg-white p-6">
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Store className="h-4 w-4 text-[#FF4D00]" />
            Meilleure offre
          </p>
          <AnimatedPrice value={data.offers[0].amount} className="mt-4 text-3xl font-semibold text-[#FF4D00]" />
          <p className="mt-2 text-sm text-slate-500">{data.offers[0].vendor.name}</p>
          <p className="mt-1 text-xs text-slate-500">Stock: {data.offers[0].stock_quantity}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PriceAlertButton productId={data.product.id} currentPrice={data.offers[0].amount} />
            <Button
              type="button"
              onClick={addToSmartCart}
              className="primary-glow-btn border border-[#FF4D00]/30 bg-[#FF4D00]/10 text-[#FF4D00] hover:bg-[#FF4D00]/15"
            >
              Ajouter au panier intelligent
            </Button>
          </div>
          {cartMessage ? <p className="mt-2 text-xs text-emerald-600">{cartMessage}</p> : null}
        </article>
      </div>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold luxury-title">
          <TrendingUp className="h-5 w-5 text-[#FF4D00]" />
          Evolution des prix
        </h2>
        <p className="mt-1 text-sm text-slate-500">Courbe des variations par date.</p>

        <ProductPriceHistoryChart chartData={chartData} minAmount={minAmount} />
      </article>

      <article className="premium-card space-y-4 border border-slate-200 bg-white p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold luxury-title">
          <Store className="h-5 w-5 text-[#FF4D00]" />
          Offres vendeurs
        </h2>
        <p className="text-sm text-slate-500">Classement par prix croissant.</p>

        <div className="space-y-3">
          {data.offers.map((offer) => (
            <VendorOffer key={offer.price_id} offer={offer} />
          ))}
        </div>
      </article>

      <ReviewSystem productId={productId} />

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Souvent achetes ensemble</h2>
        <p className="mt-1 text-sm text-slate-500">Recommandations IA basees sur la categorie.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(recommendations?.items ?? []).map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </article>
    </section>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6" />}>
      <ProductDetailPageContent />
    </Suspense>
  );
}
