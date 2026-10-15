"use client";

import { Download, ShoppingCart, Store, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConvertedPrice } from "@/components/ConvertedPrice";
import { AnimatedPrice } from "@/components/AnimatedPrice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActiveAffiliateCode } from "@/lib/affiliate";
import { formatXOF } from "@/lib/currency";
import { getOrderPayRoute, getOrderReceiptRoute, getOrderSuccessRoute } from "@/lib/mobile-routes";
import { DEFAULT_SHIPPING_COST, optimizeCart } from "@/lib/optimize-cart";
import { getPublicDistrictFees, getPublicFinanceSettings } from "@/services/finance-service";
import { notifyLocalOrderEvent } from "@/services/notification-service";
import { checkout, getReceiptLink } from "@/services/order-service";
import { useCartStore } from "@/store/cartStore";
import { OptimizeCartResult } from "@/types/cart";

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const removeItem = useCartStore((state) => state.removeItem);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const [shareMessage, setShareMessage] = useState("");
  const [paymentMode, setPaymentMode] = useState<"nita" | "amana">("nita");
  const [deliveryType, setDeliveryType] = useState<"standard" | "express_niamey">("standard");
  const [transactionCode, setTransactionCode] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  // Sans adresse ni telephone, le livreur ne peut pas livrer : on les exige avant la commande.
  const deliveryReady = deliveryAddress.trim().length >= 3 && deliveryPhone.replace(/\D/g, "").length >= 8;
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const { data: financeSettings } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: districtFees = [] } = useQuery({
    queryKey: ["public-district-fees"],
    queryFn: getPublicDistrictFees,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const [district, setDistrict] = useState("");
  const districtFee = districtFees.find((row) => row.district_name === district)?.delivery_fee;

  // Meme regle que le serveur : le tarif du quartier remplace le tarif standard.
  const selectedShippingFee =
    deliveryType === "express_niamey"
      ? (financeSettings?.urban_delivery_fee ?? financeSettings?.default_delivery_fee ?? DEFAULT_SHIPPING_COST)
      : (districtFee ?? financeSettings?.default_delivery_fee ?? DEFAULT_SHIPPING_COST);

  // Total calcule directement sur les offres choisies par le client.
  const result: OptimizeCartResult | null = useMemo(
    () =>
      items.length
        ? optimizeCart(items, {
            commissionRate: financeSettings?.commission_rate,
            serviceFee: financeSettings?.service_fee,
            defaultShippingFee: selectedShippingFee,
          })
        : null,
    [items, financeSettings?.commission_rate, financeSettings?.service_fee, selectedShippingFee]
  );

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
          reseller_listing_id: entry.resellerListingId,
        })),
        payment_mode: paymentMode,
        delivery_type: deliveryType,
        transaction_code: transactionCode || undefined,
        currency: "XOF",
        district: deliveryType === "standard" && district ? district : undefined,
        delivery_address: deliveryAddress.trim(),
        delivery_phone: deliveryPhone.trim(),
        affiliate_code: getActiveAffiliateCode(),
      });
      let receiptHref: string | undefined;
      try {
        const receipt = await getReceiptLink(order.id);
        receiptHref = getOrderReceiptRoute(receipt.order_id, receipt.token);
      } catch {
        // Fallback: on conserve le flux de paiement/succes si le lien recu n est pas encore pret.
      }
      notifyLocalOrderEvent({
        title: "Commande envoyee",
        body: `Ta commande ${order.tracking_code ?? order.id.slice(0, 8)} est en statut ${order.status}.`,
        tag: `customer-order-${order.id}`,
        href: receiptHref ?? getOrderSuccessRoute(order.id),
      });
      if (order.payment_status === "paid") {
        router.push(getOrderSuccessRoute(order.id));
      } else {
        router.push(getOrderPayRoute(order.id));
      }
      return;
    } catch {
      setShareMessage("Échec création commande. Vérifie ta connexion.");
    } finally {
      setIsSubmittingOrder(false);
      window.setTimeout(() => setShareMessage(""), 2400);
    }
  };

  if (!hasHydrated) {
    return (
      <section className="mx-auto grid w-full max-w-7xl gap-6 px-gutter pb-14 pt-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-card bg-surface-3 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-card bg-surface-3" />
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl px-gutter pb-14 pt-8">
        <div className="rounded-card border border-border bg-card p-10 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-ink-400" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-ink-900">Votre panier est vide</h1>
          <p className="mt-1 text-sm text-ink-600">Parcourez les boutiques de Niamey et ajoutez vos premiers articles.</p>
          <Button asChild className="mt-6">
            <Link href="/">Découvrir les produits</Link>
          </Button>
        </div>
      </section>
    );
  }

  const choiceClass = (selected: boolean) =>
    `rounded-field border-2 p-4 text-left transition-colors duration-fast ${
      selected ? "border-ink-900 bg-surface-1" : "border-border bg-card hover:border-ink-400"
    }`;

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-14 pt-4">
      <h1 className="text-2xl font-semibold text-ink-900">
        Panier <span className="text-base font-normal text-ink-600">({items.length} article{items.length > 1 ? "s" : ""})</span>
      </h1>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className="rounded-card border border-border bg-card">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.productId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{item.name}</p>
                    {item.offersSnapshot[0] ? (
                      <p className="text-xs text-ink-600">
                        {item.offersSnapshot[0].vendor.name} · {formatXOF(item.offersSnapshot[0].amount)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center rounded-pill border border-border" role="group" aria-label={`Quantité de ${item.name}`}>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        className="h-10 w-10 rounded-pill text-lg text-ink-800 hover:bg-surface-1"
                        aria-label="Diminuer la quantité"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold text-ink-900" aria-live="polite">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        className="h-10 w-10 rounded-pill text-lg text-ink-800 hover:bg-surface-1"
                        aria-label="Augmenter la quantité"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="min-h-10 text-sm font-medium text-ink-600 hover:text-danger hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-end border-t border-border px-4 py-2">
              <button type="button" onClick={clearCart} className="min-h-10 text-sm text-ink-600 hover:text-danger hover:underline">
                Vider le panier
              </button>
            </div>
          </article>

          <article className="rounded-card border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-ink-900">Livraison</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" aria-pressed={deliveryType === "standard"} onClick={() => setDeliveryType("standard")} className={choiceClass(deliveryType === "standard")}>
                <p className="font-semibold text-ink-900">Standard</p>
                <p className="text-xs text-ink-600">Livraison à Niamey sous quelques heures</p>
              </button>
              <button
                type="button"
                aria-pressed={deliveryType === "express_niamey"}
                onClick={() => setDeliveryType("express_niamey")}
                className={choiceClass(deliveryType === "express_niamey")}
              >
                <p className="inline-flex items-center gap-1 font-semibold text-ink-900">
                  <Zap className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Express Niamey
                </p>
                <p className="text-xs text-ink-600">Livraison prioritaire en ville</p>
              </button>
            </div>
            {deliveryType === "standard" && districtFees.length ? (
              <div className="mt-4">
                <label htmlFor="delivery-district" className="text-sm font-medium text-ink-800">
                  Quartier de livraison
                </label>
                <select
                  id="delivery-district"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  className="mt-1 h-11 w-full rounded-field border border-input bg-background px-3 text-sm text-ink-900"
                >
                  <option value="">Autre quartier (tarif standard)</option>
                  {districtFees.map((row) => (
                    <option key={row.district_name} value={row.district_name}>
                      {row.district_name} — {formatXOF(row.delivery_fee)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="delivery-address" className="text-sm font-medium text-ink-800">
                  Adresse de livraison
                </label>
                <Input
                  id="delivery-address"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Quartier, rue, repère (ex. près de la pharmacie)"
                  autoComplete="street-address"
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <label htmlFor="delivery-phone" className="text-sm font-medium text-ink-800">
                  Téléphone pour le livreur
                </label>
                <Input
                  id="delivery-phone"
                  value={deliveryPhone}
                  onChange={(event) => setDeliveryPhone(event.target.value)}
                  placeholder="+227 90 00 00 00"
                  inputMode="tel"
                  autoComplete="tel"
                  className="mt-1 h-11"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-600">
              Frais de livraison : {formatXOF(selectedShippingFee)} par boutique, payés par le client.
            </p>
          </article>

          <article className="rounded-card border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-ink-900">Paiement</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" aria-pressed={paymentMode === "nita"} onClick={() => setPaymentMode("nita")} className={choiceClass(paymentMode === "nita")}>
                <p className="font-semibold text-ink-900">Nita Transfert</p>
                <p className="text-xs text-ink-600">Transfert au numéro AMAZER, vérifié par l&apos;équipe</p>
              </button>
              <button type="button" aria-pressed={paymentMode === "amana"} onClick={() => setPaymentMode("amana")} className={choiceClass(paymentMode === "amana")}>
                <p className="font-semibold text-ink-900">Amana Transfert</p>
                <p className="text-xs text-ink-600">Validation dans l&apos;application AmanaTa</p>
              </button>
            </div>
            <div className="mt-4 max-w-md">
              <label htmlFor="transaction-code" className="text-sm font-medium text-ink-800">
                Référence de transaction <span className="font-normal text-ink-600">(si vous avez déjà payé)</span>
              </label>
              <Input
                id="transaction-code"
                value={transactionCode}
                onChange={(event) => setTransactionCode(event.target.value)}
                placeholder="Facultatif"
                className="mt-1 h-11"
              />
            </div>
          </article>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <article className="rounded-card border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-ink-900">Récapitulatif</h2>

            {!result ? null : result.status === "unavailable_item" ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {result.errorMessage}
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {result.optimizedPlan.map((entry) => (
                    <li key={`${entry.productId}-${entry.vendorId}`} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-ink-800">{entry.productName}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                          <Store className="h-3 w-3" aria-hidden="true" />
                          {entry.vendorName}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium text-ink-900">{formatXOF(entry.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between text-ink-700">
                    <dt>Sous-total</dt>
                    <dd>{formatXOF(result.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between text-ink-700">
                    <dt>Livraison</dt>
                    <dd>{formatXOF(result.shippingFee)}</dd>
                  </div>
                  {result.commissionFee > 0 ? (
                    <div className="flex justify-between text-ink-700">
                      <dt>Commission AMAZER</dt>
                      <dd>{formatXOF(result.commissionFee)}</dd>
                    </div>
                  ) : null}
                  {result.serviceFee > 0 ? (
                    <div className="flex justify-between text-ink-700">
                      <dt>Frais de service</dt>
                      <dd>{formatXOF(result.serviceFee)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-ink-900">
                    <dt>Total</dt>
                    <dd>
                      <AnimatedPrice value={result.splitTotal} />
                    </dd>
                  </div>
                  <div className="text-right">
                    <ConvertedPrice amount={result.splitTotal} />
                  </div>
                </dl>
                <Button
                  type="button"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => void placeOrder()}
                  disabled={isSubmittingOrder || !deliveryReady}
                >
                  {isSubmittingOrder ? "Validation…" : "Commander"}
                </Button>
                {!deliveryReady ? (
                  <p className="mt-2 text-center text-xs text-ink-600">Indiquez l&apos;adresse et le téléphone de livraison.</p>
                ) : null}
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                  <button type="button" onClick={downloadReceipt} className="inline-flex min-h-10 items-center gap-1 text-ink-600 hover:text-ink-900 hover:underline">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Reçu provisoire
                  </button>
                </div>
              </>
            )}
            {shareMessage ? (
              <p className="mt-2 text-xs text-ink-600" role="status">
                {shareMessage}
              </p>
            ) : null}
          </article>
        </aside>
      </div>
    </section>
  );
}
