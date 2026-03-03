"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, Store, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { PriceAlertButton } from "@/components/PriceAlertButton";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { ReviewSystem } from "@/components/ReviewSystem";
import { VendorOffer } from "@/components/VendorOffer";
import { Button } from "@/components/ui/button";
import { getProductDetailById, getProductRecommendations } from "@/services/product-service";
import { useCartStore } from "@/store/cartStore";

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function CustomPriceTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-[#FF4D00]/35 bg-white px-3 py-2 text-xs text-slate-800 shadow-xl"
    >
      <p className="text-slate-500">{label}</p>
      <AnimatedPrice value={Number(payload[0].value)} className="mt-1 font-semibold text-[#FF4D00]" />
    </motion.div>
  );
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const addItem = useCartStore((state) => state.addItem);
  const [cartMessage, setCartMessage] = useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["product-detail", productId],
    queryFn: () => getProductDetailById(productId),
    staleTime: 15_000,
  });
  const { data: recommendations } = useQuery({
    queryKey: ["product-reco", productId],
    queryFn: () => getProductRecommendations(productId, 4),
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
              {data.product.main_image_url ? (
                <Image
                  src={data.product.main_image_url}
                  alt={data.product.name}
                  width={224}
                  height={224}
                  unoptimized
                  className="h-full w-full object-cover"
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

        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="priceFillCoral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF4D00" stopOpacity={0.33} />
                  <stop offset="100%" stopColor="#FF4D00" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                domain={[minAmount, "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "#FF4D00", strokeOpacity: 0.25 }}
                content={<CustomPriceTooltip />}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#FF4D00"
                strokeWidth={1.5}
                fill="url(#priceFillCoral)"
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
