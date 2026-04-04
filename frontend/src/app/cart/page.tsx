"use client";

import { motion } from "framer-motion";
import { Download, Share2, Sparkles, Store, Zap } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import { getOrderPayRoute, getOrderSuccessRoute } from "@/lib/mobile-routes";
import { DEFAULT_SHIPPING_COST, optimizeCart } from "@/lib/optimize-cart";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { checkout } from "@/services/order-service";
import { useCartStore } from "@/store/cartStore";
import { OptimizeCartResult } from "@/types/cart";

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const removeItem = useCartStore((state) => state.removeItem);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const addSavingsRecord = useCartStore((state) => state.addSavingsRecord);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizeCartResult | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [paymentMode, setPaymentMode] = useState<"nita" | "amana">("nita");
  const [deliveryType, setDeliveryType] = useState<"standard" | "express_niamey">("standard");
  const [transactionCode, setTransactionCode] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const { data: financeSettings } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });

  const startOptimization = () => {
    if (!items.length) {
      return;
    }

    setResult(null);
    setIsOptimizing(true);
    window.setTimeout(() => {
      const optimized = optimizeCart(items, {
        commissionRate: financeSettings?.commission_rate,
        serviceFee: financeSettings?.service_fee,
        defaultShippingFee: financeSettings?.default_delivery_fee,
      });
      setResult(optimized);
      addSavingsRecord(optimized.savings);
      setIsOptimizing(false);
    }, 1200);
  };

  const downloadReceipt = () => {
    if (!result) {
      return;
    }

    const content = [
      "AMAZER - Recu de paiement",
      `Date: ${new Date().toLocaleString("fr-NE")}`,
      `Mode: ${paymentMode.toUpperCase()}`,
      `Transaction: ${transactionCode || "N/A"}`,
      `Livraison: ${deliveryType === "express_niamey" ? "Express Niamey" : "Standard"}`,
      `Total estime: ${formatXOF(result.splitTotal)}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `amazer-recu-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const placeOrder = async () => {
    if (!result || isSubmittingOrder) {
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const order = await checkout({
        items: result.optimizedPlan.map((entry) => ({
          product_id: entry.productId,
          vendor_id: entry.vendorId,
          quantity: entry.quantity,
          unit_price: entry.unitPrice,
        })),
        payment_mode: paymentMode,
        delivery_type: deliveryType,
        transaction_code: transactionCode || undefined,
        currency: "XOF",
      });
      if (order.payment_status === "paid") {
        router.push(getOrderSuccessRoute(order.id));
      } else {
        router.push(getOrderPayRoute(order.id));
      }
      return;
    } catch {
      setShareMessage("Echec creation commande. Verifie ta connexion.");
    } finally {
      setIsSubmittingOrder(false);
      window.setTimeout(() => setShareMessage(""), 2400);
    }
  };

  const shareOptimizedCart = async () => {
    if (!result) {
      return;
    }

    const text = result.savings
      ? `Mon panier AMAZER optimise economise ${formatXOF(result.savings)}.`
      : "Mon panier AMAZER est optimise au meilleur prix disponible.";

    const payload = {
      title: "Panier optimise AMAZER",
      text,
      url: typeof window !== "undefined" ? window.location.href : "",
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        setShareMessage("Partage envoye.");
      } else {
        await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
        setShareMessage("Lien copie dans le presse-papiers.");
      }
    } catch {
      setShareMessage("Partage annule.");
    } finally {
      window.setTimeout(() => setShareMessage(""), 2200);
    }
  };

  if (!hasHydrated) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <div className="premium-card h-40 animate-pulse border border-slate-200 bg-white" />
        <div className="premium-card h-72 animate-pulse border border-slate-200 bg-white" />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-gradient-to-br from-white to-orange-50 p-6">
        <h1 className="luxury-title text-2xl font-semibold sm:text-3xl">Panier Intelligent</h1>
        <p className="mt-2 text-sm text-slate-600">
          Compare les vendeurs et optimise automatiquement ta commande.
        </p>
      </header>

      <article className="premium-card space-y-4 border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
        {items.length === 0 ? (
          <p className="text-sm text-slate-300">Ton panier est vide.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <div>
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-xs text-slate-300">{item.offersSnapshot.length} offre(s) connues</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    -
                  </Button>
                  <span className="min-w-8 text-center text-sm text-white">{item.quantity}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => removeItem(item.productId)}
                    className="border border-rose-400/40 bg-rose-400/15 text-rose-100 hover:bg-rose-400/25"
                  >
                    Retirer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-300">
          Frais de livraison par vendeur: {formatXOF(financeSettings?.default_delivery_fee ?? DEFAULT_SHIPPING_COST)} (Niamey).
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={items.length === 0 || isOptimizing}
            onClick={startOptimization}
            className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            Optimiser mon Panier
          </Button>
          <Button
            type="button"
            disabled={items.length === 0}
            onClick={clearCart}
            className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            Vider le panier
          </Button>
          <Button
            type="button"
            disabled={!result}
            onClick={shareOptimizedCart}
            className="border border-[#FF4D00]/50 bg-[#FF4D00]/15 text-orange-100 hover:bg-[#FF4D00]/25"
          >
            <Share2 className="h-4 w-4" />
            Partager mon panier optimise
          </Button>
        </div>
        {shareMessage ? <p className="text-xs text-orange-200">{shareMessage}</p> : null}

        {isOptimizing ? (
          <div className="rounded-xl border border-[#FF4D00]/35 bg-[#FF4D00]/14 p-3">
            <p className="text-sm text-orange-100">Calcul du meilleur prix...</p>
            <div className="mt-2 h-2 overflow-hidden rounded bg-white/15">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-orange-300 to-[#FF4D00]"
              />
            </div>
          </div>
        ) : null}
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Mode de paiement</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choisis ton mode. Le paiement se confirme ensuite avec une reference courte.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPaymentMode("nita")}
            className={`rounded-xl border p-4 text-left ${
              paymentMode === "nita"
                ? "border-yellow-400 bg-gradient-to-br from-yellow-100 to-green-100 shadow-[0_0_20px_rgba(234,179,8,0.35)]"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-semibold text-slate-900">Nita Transfert</p>
            <p className="text-xs text-slate-600">Palette Jaune/Vert locale.</p>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMode("amana")}
            className={`rounded-xl border p-4 text-left ${
              paymentMode === "amana"
                ? "border-orange-400 bg-gradient-to-br from-orange-100 to-amber-50 shadow-[0_0_20px_rgba(251,146,60,0.35)]"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-semibold text-slate-900">Amana Transfert</p>
            <p className="text-xs text-slate-600">Validation manuelle/semi-automatique.</p>
          </button>
        </div>
        <div className="mt-4 max-w-md">
          <Input
            value={transactionCode}
            onChange={(event) => setTransactionCode(event.target.value)}
            placeholder="Code transaction (optionnel)"
            className="h-11 border-slate-200"
          />
        </div>
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-900">Livraison</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setDeliveryType("standard")}
              className={
                deliveryType === "standard"
                  ? "border border-[#FF4D00]/40 bg-[#FF4D00]/10 text-[#FF4D00]"
                  : "border border-slate-200 bg-white text-slate-700"
              }
            >
              Standard
            </Button>
            <Button
              type="button"
              onClick={() => setDeliveryType("express_niamey")}
              className={
                deliveryType === "express_niamey"
                  ? "primary-glow-btn border border-[#FF4D00]/40 bg-[#FF4D00]/10 text-[#FF4D00]"
                  : "border border-slate-200 bg-white text-slate-700"
              }
            >
              <Zap className="h-4 w-4" />
              Livraison Express Niamey
            </Button>
          </div>
        </div>
      </article>

      {result ? (
        <article
          className={`rounded-3xl border bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl ${
            result.savings > 0
              ? "border-emerald-400/70 shadow-[0_0_30px_rgba(16,185,129,0.45)]"
              : "border-white/15"
          }`}
        >
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-orange-300" />
            Resultat optimisation
          </h2>

          {result.status === "unavailable_item" ? (
            <p className="mt-3 text-sm text-rose-200">{result.errorMessage}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-100">
              {result.savings > 0
                ? "Felicitations ! En separant votre commande, vous economisez."
                : "Aucune economie supplementaire detectee."}
            </p>
          )}
          {result.savings > 0 ? (
            <AnimatedPrice value={result.savings} className="mt-2 text-2xl font-semibold text-emerald-200" />
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-slate-300">Total split vendors</p>
              <AnimatedPrice value={result.splitTotal} className="mt-1 text-lg font-semibold text-orange-300" />
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-slate-300">Total vendeur unique</p>
              <p className="mt-1 text-lg font-semibold">
                {result.bestSingleVendorTotal === null
                  ? "Non disponible"
                  : <AnimatedPrice value={result.bestSingleVendorTotal} />}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/50 bg-emerald-500/15 p-3">
              <p className="text-xs text-emerald-100">Economies</p>
              <AnimatedPrice value={result.savings} className="mt-1 text-lg font-semibold text-emerald-200" />
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-slate-300">Sous-total articles</p>
              <AnimatedPrice value={result.subtotal} className="mt-1 text-sm font-semibold text-white" />
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-slate-300">Livraison</p>
              <AnimatedPrice value={result.shippingFee} className="mt-1 text-sm font-semibold text-white" />
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-slate-300">Commission AMAZER</p>
              <AnimatedPrice value={result.commissionFee} className="mt-1 text-sm font-semibold text-orange-200" />
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-slate-300">Frais service</p>
              <AnimatedPrice value={result.serviceFee} className="mt-1 text-sm font-semibold text-orange-200" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {result.optimizedPlan.map((entry) => (
              <div
                key={`${entry.productId}-${entry.vendorId}`}
                className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 p-3 text-sm"
              >
                <div>
                  <p>{entry.productName}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-slate-200">
                    <Store className="h-3.5 w-3.5 text-orange-300" />
                    {entry.vendorName}
                  </p>
                </div>
                <AnimatedPrice value={entry.subtotal} className="font-medium text-orange-200" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void placeOrder()}
              disabled={isSubmittingOrder}
              className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
            >
              {isSubmittingOrder ? "Validation..." : "Commander"}
            </Button>
            <Button
              type="button"
              onClick={downloadReceipt}
              className="border border-white/20 bg-white/10 text-white"
            >
              <Download className="h-4 w-4" />
              Recu provisoire
            </Button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
