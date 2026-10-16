"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Images, MapPin, Package, Phone, Search, ShieldCheck, Store } from "lucide-react";

import { PRODUCT_GRID_CLASS } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { getProductRoute } from "@/lib/mobile-routes";
import { resolveImageUrl } from "@/lib/image";
import { TransportBookingFlow } from "@/components/storefront/TransportBookingFlow";
import { HotelBookingFlow } from "@/components/storefront/HotelBookingFlow";
import { Stars, VendorReviews } from "@/components/storefront/VendorReviews";
import { trackStorefrontContact, trackStorefrontView } from "@/lib/storefront-stats";
import { RestaurantMenu } from "@/components/storefront/RestaurantMenu";
import { computeRestaurantOrderSummary } from "@/lib/restaurant-order-pricing";
import { getRestaurantOrderPayRoute, getRestaurantOrderReceiptRoute, getShopRoute } from "@/lib/mobile-routes";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { notifyLocalOrderEvent } from "@/services/notification-service";
import { createRestaurantOrder, createRestaurantReservation, getRestaurantReceiptLink } from "@/services/restaurant-service";
import { getProductDetailById } from "@/services/product-service";
import { getSellerStorefront } from "@/services/seller-service";
import { useCartStore } from "@/store/cartStore";
import type { SellerStorefront, SellerStorefrontProduct } from "@/types/seller";
import type { RestaurantMenuItem, RestaurantMenuOption } from "@/types/restaurant";
import { WhatsAppButton } from "@/components/contact/WhatsAppButton";

const activityLabels = {
  shop: "Boutique",
  restaurant: "Restaurant",
  hotel: "Hôtel",
  enterprise: "Entreprise",
  transport: "Transport",
} as const;

function PayoutNotice({
  payoutPhone,
  method,
  amount,
}: {
  payoutPhone: string | null | undefined;
  method: "nita" | "amana";
  amount?: number;
}) {
  if (!payoutPhone) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Le vendeur n&apos;a pas encore renseigné son numéro de versement. Contacte-le avant de payer.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-800">
      <p className="font-semibold text-slate-900">Comment payer</p>
      <p className="mt-1">
        1. Envoie {amount && amount > 0 ? <span className="font-semibold">{formatXOF(amount)}</span> : "le montant"} via{" "}
        <span className="font-semibold uppercase">{method}</span> au numero{" "}
        <span className="font-semibold text-brand-600">{payoutPhone}</span>.
      </p>
      <p className="mt-1">2. Reviens ici et valide ci-dessous (la référence est facultative).</p>
    </div>
  );
}

type SelectedMenuItem = {
  menu_item_id: string;
  vendor_id: string;
  name: string;
  quantity: number;
  base_price: number;
  selected_options: RestaurantMenuOption[];
  customer_note: string;
};

/** Vitrine publique d'une boutique (partagee par /shop/[vendorId] et /shop?vendorId= de l'app mobile). */
export function ShopView({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const addItem = useCartStore((state) => state.addItem);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedMenuItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMode, setPaymentMode] = useState<"nita" | "amana">("nita");
  const [reservationForm, setReservationForm] = useState({
    customer_name: "",
    customer_phone: "",
    reservation_at: "",
    guest_count: "2",
    note: "",
    deposit_payment_method: "nita" as "nita" | "amana",
    transaction_reference: "",
  });

  useEffect(() => {
    trackStorefrontView(vendorId);
  }, [vendorId]);
  const { data, isPending, isError } = useQuery({
    queryKey: ["seller-storefront", vendorId],
    queryFn: () => getSellerStorefront(vendorId),
    enabled: Boolean(vendorId),
  });
  const { data: financeSettings } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const addProductMutation = useMutation({
    mutationFn: (productId: string) => getProductDetailById(productId),
  });

  const reservationMutation = useMutation({
    mutationFn: () =>
      createRestaurantReservation(vendorId, {
        vendor_id: vendorId,
        customer_name: reservationForm.customer_name,
        customer_phone: reservationForm.customer_phone,
        reservation_at: reservationForm.reservation_at,
        guest_count: Number(reservationForm.guest_count || 2),
        note: reservationForm.note || undefined,
        deposit_payment_method: reservationForm.deposit_payment_method,
        transaction_reference: reservationForm.transaction_reference || undefined,
      }),
    onSuccess: () => {
      setStatus("Reservation de table envoyee au restaurateur.");
      setReservationForm({
        customer_name: "",
        customer_phone: "",
        reservation_at: "",
        guest_count: "2",
        note: "",
        deposit_payment_method: "nita",
        transaction_reference: "",
      });
      queryClient.invalidateQueries({ queryKey: ["seller-storefront", vendorId] });
    },
    onError: (error) =>
      setStatus(getApiErrorMessage(error, "Impossible d'envoyer la reservation de table.")),
  });

  const orderMutation = useMutation({
    mutationFn: createRestaurantOrder,
    onSuccess: async (order) => {
      setOrderStatus(`Commande créée chez ${order.vendor_name}.`);
      setSelectedItems([]);
      notifyLocalOrderEvent({
        title: "Commande restaurant",
        body:
          order.payment_status === "paid"
            ? "Paiement déjà confirme avec code transaction."
            : "Finalise le paiement sur la page securisee.",
        tag: `restaurant-order-${order.id}`,
        href:
          order.payment_status === "paid"
            ? "/restaurant"
            : getRestaurantOrderPayRoute(order.id),
      });
      if (order.payment_status === "pending") {
        router.push(getRestaurantOrderPayRoute(order.id));
      } else {
        const receipt = await getRestaurantReceiptLink(order.id);
        router.push(getRestaurantOrderReceiptRoute(order.id, receipt.token));
      }
    },
    onError: (error) =>
      setOrderStatus(
        getApiErrorMessage(error, "Échec envoi commande. Vérifie les champs et reconnecte-toi.")
      ),
  });

  const handleAddProduct = (productId: string, redirectToCart = false) => {
    if (!productId) {
      setCartMessage("Produit indisponible pour le panier.");
      window.setTimeout(() => setCartMessage(""), 2400);
      return;
    }
    addProductMutation.mutate(productId, {
      onSuccess: (data) => {
        // Le client achete chez cette boutique, pas chez une autre moins chere.
        const chosen = data.offers.find((offer) => offer.vendor.id === vendorId) ?? data.offers[0];
        addItem({
          productId: data.product.id,
          name: data.product.name,
          offersSnapshot: chosen ? [chosen] : [],
          quantity: 1,
        });
        if (redirectToCart) {
          router.push("/cart");
          return;
        }
        setCartMessage("Produit ajoute au panier.");
        window.setTimeout(() => setCartMessage(""), 2400);
      },
      onError: () => {
        setCartMessage("Impossible d'ajouter au panier.");
        window.setTimeout(() => setCartMessage(""), 2400);
      },
    });
  };

  const addDish = (dish: RestaurantMenuItem) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.menu_item_id === dish.id);
      if (existing) {
        return prev.map((item) =>
          item.menu_item_id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          menu_item_id: dish.id,
          vendor_id: dish.vendor_id,
          name: dish.name,
          quantity: 1,
          base_price: dish.base_price,
          selected_options: [],
          customer_note: "",
        },
      ];
    });
  };

  const toggleOption = (menuItemId: string, option: RestaurantMenuOption) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.menu_item_id !== menuItemId) return item;
        const exists = item.selected_options.some((entry) => entry.name === option.name);
        return {
          ...item,
          selected_options: exists
            ? item.selected_options.filter((entry) => entry.name !== option.name)
            : [...item.selected_options, option],
        };
      })
    );
  };

  const changeQuantity = (menuItemId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((item) => (item.menu_item_id === menuItemId ? { ...item, quantity: Math.min(20, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const setItemNote = (menuItemId: string, customerNote: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.menu_item_id === menuItemId ? { ...item, customer_note: customerNote } : item))
    );
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!data || !data.products.length) return [];
    if (!normalizedQuery) return data.products;
    return data.products.filter((item) => `${item.name} ${item.brand}`.toLowerCase().includes(normalizedQuery));
  }, [data, normalizedQuery]);
  const filteredMenu = useMemo(() => {
    if (!data || !data.restaurant_menu.length) return [];
    if (!normalizedQuery) return data.restaurant_menu;
    return data.restaurant_menu.filter((item) =>
      `${item.name} ${item.description || ""} ${(item.tags || []).join(" ")}`.toLowerCase().includes(normalizedQuery)
    );
  }, [data, normalizedQuery]);
  const filteredRooms = useMemo(() => {
    if (!data || !data.room_types.length) return [];
    if (!normalizedQuery) return data.room_types;
    return data.room_types.filter((item) =>
      `${item.name} ${item.description || ""} ${(item.amenities || []).join(" ")}`.toLowerCase().includes(normalizedQuery)
    );
  }, [data, normalizedQuery]);

  const isTransport = Boolean(data?.offers_transport) || data?.activity_type === "transport";
  const isPremiumStore =
    data?.storefront_tier === "premium" || data?.activity_type === "hotel" || data?.activity_type === "enterprise";
  // Premium: le proprietaire choisit d'activer la boutique et/ou le restaurant (cases a cocher).
  // Comptes non-premium: pilote par activity_type (comportement inchange).
  const showShopSection = isPremiumStore ? Boolean(data?.offers_shop) : true;
  const showRestaurantSection =
    !isTransport &&
    (isPremiumStore ? Boolean(data?.offers_restaurant) : data?.activity_type === "restaurant");
  const restaurantOpen = data?.restaurant_is_open ?? true;
  const canOrder = showRestaurantSection && filteredMenu.length > 0 && restaurantOpen;
  const total = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const optionsTotal = item.selected_options.reduce((acc, option) => acc + option.price, 0);
        return sum + (item.base_price + optionsTotal) * item.quantity;
      }, 0),
    [selectedItems]
  );
  const restaurantPricing = useMemo(
    () =>
      computeRestaurantOrderSummary(
        total,
        financeSettings?.default_delivery_fee ?? 1500,
        data?.effective_commission_rate ?? financeSettings?.commission_rate ?? 0.05,
        data?.effective_service_fee ?? financeSettings?.service_fee ?? 200
      ),
    [
      data?.effective_commission_rate,
      data?.effective_service_fee,
      financeSettings?.commission_rate,
      financeSettings?.default_delivery_fee,
      financeSettings?.service_fee,
      total,
    ]
  );

  const requireSession = () => {
    if (currentUser) {
      return true;
    }
    window.location.assign(`/login?next=${encodeURIComponent(getShopRoute(vendorId))}`);
    return false;
  };

  const submitOrder = () => {
    if (!selectedItems.length) {
      setOrderStatus("Ajoute au moins un plat avant de commander.");
      return;
    }
    if (!requireSession()) {
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      setOrderStatus("Renseigne ton nom, ton téléphone et l'adresse de livraison.");
      return;
    }
    orderMutation.mutate({
      vendor_id: vendorId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      delivery_address: deliveryAddress.trim(),
      payment_mode: paymentMode,
      items: selectedItems.map((item) => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        selected_options: item.selected_options,
        customer_note: item.customer_note.trim() || undefined,
      })),
    });
  };

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <div className="h-48 animate-pulse rounded-card bg-surface-2 sm:h-64" aria-hidden="true" />
        <div className={PRODUCT_GRID_CLASS} aria-busy="true" aria-label="Chargement de la boutique">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={`shop-skeleton-${index}`} variant="tile" />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-700">Boutique introuvable</h1>
          <p className="mt-2 text-sm text-rose-700">
            Cette boutique n&apos;est pas disponible ou a ete desactivee.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <StorefrontHero data={data} />

      <article className="premium-card border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Rechercher chez ${data.business_name}…`}
            className="h-11 rounded-xl border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </article>

      {data.service_offerings.length ? (
        <article className="premium-card border border-slate-200 bg-white p-5">
          <h2 className="luxury-title text-xl font-semibold">Services</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.service_offerings.map((service) => (
              <div key={`${service.title}-${service.display_mode}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{service.title}</h3>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    {service.display_mode === "consult_only" ? "Consultation" : service.display_mode}
                  </span>
                </div>
                {service.description ? <p className="mt-2 text-sm text-slate-600">{service.description}</p> : null}
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {showRestaurantSection ? (
        <>
          <RestaurantMenu
            menu={filteredMenu}
            selectedItems={selectedItems}
            isOpen={restaurantOpen}
            openLabel={data.restaurant_open_label ?? "Ouvert"}
            onAddDish={addDish}
            onToggleOption={toggleOption}
          />
          {data.accepts_table_reservations ? (
            <article className="premium-card border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5">
              <h2 className="luxury-title text-xl font-semibold">Reservation de table</h2>
              {data.deposit_amount && data.deposit_amount > 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Frais de reservation de {formatXOF(data.deposit_amount)} via{" "}
                  {data.deposit_payment_method?.toUpperCase() || "Nita/Amana"} : paiement
                  obligatoire pour valider la reservation.
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Nom"
                  value={reservationForm.customer_name}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, customer_name: event.target.value }))
                  }
                />
                <Input
                  placeholder="Telephone"
                  value={reservationForm.customer_phone}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, customer_phone: event.target.value }))
                  }
                />
                <Input
                  type="datetime-local"
                  value={reservationForm.reservation_at}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, reservation_at: event.target.value }))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  value={reservationForm.guest_count}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, guest_count: event.target.value }))
                  }
                  placeholder="Nombre de personnes"
                />
                <textarea
                  value={reservationForm.note}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, note: event.target.value }))}
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Demande speciale"
                />
                {data.deposit_amount && data.deposit_amount > 0 ? (
                  <>
                    <div className="md:col-span-2">
                      <PayoutNotice
                        payoutPhone={data.payout_phone}
                        method={reservationForm.deposit_payment_method}
                        amount={data.deposit_amount}
                      />
                    </div>
                    <select
                      aria-label="Mode de paiement"
                      value={reservationForm.deposit_payment_method}
                      onChange={(event) =>
                        setReservationForm((prev) => ({
                          ...prev,
                          deposit_payment_method: event.target.value as "nita" | "amana",
                        }))
                      }
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm"
                    >
                      <option value="nita">Nita</option>
                      <option value="amana">Amana</option>
                    </select>
                    <Input
                      placeholder="Référence de paiement"
                      value={reservationForm.transaction_reference}
                      onChange={(event) =>
                        setReservationForm((prev) => ({
                          ...prev,
                          transaction_reference: event.target.value,
                        }))
                      }
                    />
                  </>
                ) : null}
              </div>
              <Button
                className="primary-glow-btn mt-4 bg-brand-600 text-white hover:bg-brand-700"
                onClick={() => {
                  if (!requireSession()) return;
                  reservationMutation.mutate();
                }}
              >
                {data.deposit_amount && data.deposit_amount > 0 ? "J'ai paye - reserver" : "Reserver"}
              </Button>
            </article>
          ) : null}
          {canOrder ? (
            <RestaurantOrderPanel
              selectedItems={selectedItems}
              total={total}
              deliveryFee={restaurantPricing.deliveryFee}
              platformCommission={restaurantPricing.platformCommission}
              platformServiceFee={restaurantPricing.platformServiceFee}
              grandTotal={restaurantPricing.totalAmount}
              customerName={customerName}
              customerPhone={customerPhone}
              deliveryAddress={deliveryAddress}
              paymentMode={paymentMode}
              isSubmitting={orderMutation.isPending}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
              onDeliveryAddressChange={setDeliveryAddress}
              onPaymentModeChange={setPaymentMode}
              onItemNoteChange={setItemNote}
              onQuantityChange={changeQuantity}
              onSubmit={submitOrder}
              statusMessage={orderStatus}
            />
          ) : null}
        </>
      ) : null}

      {data.activity_type === "hotel" || data.activity_type === "enterprise" || isTransport ? (
        <>
          {!isTransport && (data.activity_type === "hotel" || filteredRooms.length > 0) ? (
            <HotelBookingFlow
              vendorId={vendorId}
              hotelName={data.business_name}
              rooms={filteredRooms}
              acceptsBookings={Boolean(data.accepts_hotel_bookings)}
              payoutPhone={data.payout_phone}
            />
          ) : null}
          {isTransport ? (
            <TransportBookingFlow
              vendorId={vendorId}
              companyName={data.business_name}
              trips={data.room_types ?? []}
              acceptsBookings={Boolean(data.accepts_hotel_bookings)}
              payoutPhone={data.payout_phone}
            />
          ) : null}
        </>
      ) : null}

      {showShopSection && data.products.length ? (
        <RetailShopContent
          products={filteredProducts}
          onAddToCart={(productId) => handleAddProduct(productId)}
          onBuyNow={(productId) => handleAddProduct(productId, true)}
          isAdding={addProductMutation.isPending}
          cartMessage={cartMessage}
        />
      ) : null}
      {data.gallery_images.length ? (
        <article className="premium-card border border-slate-200 bg-white p-5">
          <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
            <Images className="h-5 w-5 text-brand-600" />
            Galerie
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {data.gallery_images.map((imageUrl, index) => (
              <div key={`gallery-${index}-${imageUrl}`} className="overflow-hidden rounded-2xl bg-slate-100">
                <Image
                  src={resolveImageUrl(imageUrl) ?? "/images/placeholders/default.svg"}
                  alt={data.business_name}
                  width={600}
                  height={600}
                  sizes="(max-width: 768px) 100vw, 600px"
                  quality={82}
                  unoptimized
                  className="h-40 w-full object-cover"
                />
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <VendorReviews vendorId={vendorId} name={data.business_name} />

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}

function StorefrontHero({ data }: { data: SellerStorefront }) {
  // En-tete de vitrine a la maniere des boutiques Shopify / Amazon : couverture, logo, nom,
  // un seul badge Premium, et les actions de contact bien visibles.
  const isPremium = data.storefront_tier === "premium";
  const phone = data.whatsapp_contact || data.phone;
  return (
    <header className="overflow-hidden rounded-card border border-border bg-card">
      <div className="relative h-36 w-full bg-ink-900 sm:h-52">
        {data.cover_image_url ? (
          <Image
            src={resolveImageUrl(data.cover_image_url) ?? "/images/placeholders/default.svg"}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            quality={82}
            unoptimized
            priority
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="px-4 pb-5 sm:px-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative -mt-10 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-card border-4 border-card bg-surface-1 shadow-resting sm:h-24 sm:w-24">
            {data.logo_url ? (
              <Image
                src={resolveImageUrl(data.logo_url) ?? "/images/placeholders/default.svg"}
                alt=""
                width={96}
                height={96}
                sizes="96px"
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <Store className="h-9 w-9 text-ink-500" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">{data.business_name}</h1>
              {data.is_verified ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-surface-1 px-2 py-0.5 text-xs font-semibold text-success">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Vérifiée
                </span>
              ) : null}
              {isPremium ? (
                <span className="rounded-pill bg-ink-900 px-2 py-0.5 text-xs font-semibold text-white">Premium</span>
              ) : null}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-600">
              {activityLabels[data.activity_type]} · {data.city ?? "Niamey"}
              {data.rating_count ? (
                <a href="#reviews-title" className="inline-flex items-center gap-1 font-medium text-ink-800 hover:underline">
                  <Stars value={data.rating_average ?? 0} size="h-3.5 w-3.5" />
                  {(data.rating_average ?? 0).toLocaleString("fr-FR")} ({data.rating_count} avis)
                </a>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              onClick={() => trackStorefrontContact(data.vendor_id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Appeler
            </a>
          ) : null}
          {data.whatsapp_contact ? (
            <span className="contents" onClickCapture={() => trackStorefrontContact(data.vendor_id)}>
              <WhatsAppButton
                phone={data.whatsapp_contact}
                variant="outline"
                label="WhatsApp"
                message={`Bonjour ${data.business_name}, je vous contacte depuis AMAZER.`}
              />
            </span>
          ) : null}
          <Link
            href={`/messages?vendor=${encodeURIComponent(data.vendor_id)}&name=${encodeURIComponent(data.business_name)}`}
            onClick={() => trackStorefrontContact(data.vendor_id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-field bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
          >
            Écrire à la boutique
          </Link>
        </div>

        {data.description || data.address || data.opening_hours || data.contact_email ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-ink-700">
            {data.description ? <p className="leading-6">{data.description}</p> : null}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-ink-600">
              {data.address ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {data.address}
                </span>
              ) : null}
              {data.opening_hours ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {data.opening_hours}
                </span>
              ) : null}
              {data.contact_email ? <span>{data.contact_email}</span> : null}
            </div>
            {data.deposit_amount && data.activity_type === "restaurant" ? (
              <p>Frais de réservation de table : {formatXOF(data.deposit_amount)}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

type RetailShopContentProps = {
  products: SellerStorefrontProduct[];
  onAddToCart: (productId: string) => void;
  onBuyNow: (productId: string) => void;
  isAdding?: boolean;
  cartMessage?: string;
};

function RetailShopContent({
  products,
  onAddToCart,
  onBuyNow,
  isAdding = false,
  cartMessage,
}: RetailShopContentProps) {
  if (!products.length) {
    return (
      <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Aucun article publie dans cette boutique pour le moment.
      </article>
    );
  }

  return (
    <article className="space-y-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink-900">Catalogue de la boutique</h2>
        <p className="text-sm text-ink-600">
          {products.length} article{products.length > 1 ? "s" : ""}
        </p>
      </header>
      {cartMessage ? (
        <p className="text-sm text-success" role="status">
          {cartMessage}
        </p>
      ) : null}
      <div className={PRODUCT_GRID_CLASS}>
        {products.map((item) => (
          <div key={item.price_id} className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
            <Link href={item.product_id ? getProductRoute(item.product_id) : "#"} className="group block">
              <div className="relative aspect-square w-full overflow-hidden bg-surface-1">
                {item.main_image_url ? (
                  <Image
                    src={resolveImageUrl(item.main_image_url) ?? "/images/placeholders/default.svg"}
                    alt={item.name}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                    quality={75}
                    unoptimized
                    className="object-cover transition-transform duration-slow ease-out-quint group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-ink-400" aria-hidden="true">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3 pb-2">
                <p className="text-base font-bold text-ink-900">{formatXOF(item.amount)}</p>
                <h3 className="line-clamp-2 text-sm text-ink-800 group-hover:text-brand-700">{item.name}</h3>
                {item.brand ? <p className="truncate text-xs uppercase tracking-label text-ink-500">{item.brand}</p> : null}
              </div>
            </Link>
            <div className="mt-auto grid gap-2 p-3 pt-0">
              <Button type="button" size="sm" onClick={() => onAddToCart(item.product_id)} disabled={isAdding || !item.product_id}>
                Ajouter au panier
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onBuyNow(item.product_id)}
                disabled={isAdding || !item.product_id}
              >
                Acheter
              </Button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

type RestaurantOrderPanelProps = {
  selectedItems: SelectedMenuItem[];
  total: number;
  deliveryFee: number;
  platformCommission: number;
  platformServiceFee: number;
  grandTotal: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMode: "nita" | "amana";
  isSubmitting: boolean;
  statusMessage?: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onDeliveryAddressChange: (value: string) => void;
  onPaymentModeChange: (value: "nita" | "amana") => void;
  onItemNoteChange: (menuItemId: string, note: string) => void;
  onQuantityChange: (menuItemId: string, delta: number) => void;
  onSubmit: () => void;
};

function RestaurantOrderPanel({
  selectedItems,
  total,
  deliveryFee,
  platformCommission,
  platformServiceFee,
  grandTotal,
  customerName,
  customerPhone,
  deliveryAddress,
  paymentMode,
  isSubmitting,
  statusMessage,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onDeliveryAddressChange,
  onPaymentModeChange,
  onItemNoteChange,
  onQuantityChange,
  onSubmit,
}: RestaurantOrderPanelProps) {
  const fees = platformCommission + platformServiceFee;
  const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";
  return (
    <section aria-labelledby="order-title" className="space-y-4 rounded-card border border-border bg-card p-4 sm:p-5">
      <h2 id="order-title" className="text-xl font-semibold text-ink-900">
        Votre commande
      </h2>
      {selectedItems.length ? (
        <ul className="divide-y divide-border">
          {selectedItems.map((item) => {
            const unit = item.base_price + item.selected_options.reduce((sum, option) => sum + option.price, 0);
            return (
              <li key={item.menu_item_id} className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{item.name}</p>
                    {item.selected_options.length ? (
                      <p className="text-xs text-ink-600">{item.selected_options.map((option) => option.name).join(", ")}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-semibold text-ink-900">{formatXOF(unit * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Retirer un ${item.name}`}
                    onClick={() => onQuantityChange(item.menu_item_id, -1)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-border text-lg font-semibold text-ink-900 hover:bg-surface-1"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-ink-900" aria-live="polite">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Ajouter un ${item.name}`}
                    onClick={() => onQuantityChange(item.menu_item_id, 1)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-border text-lg font-semibold text-ink-900 hover:bg-surface-1"
                  >
                    +
                  </button>
                </div>
                <input
                  aria-label={`Note pour ${item.name}`}
                  value={item.customer_note}
                  onChange={(event) => onItemNoteChange(item.menu_item_id, event.target.value)}
                  className="h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
                  placeholder="Note pour la cuisine (ex. pas de piment)"
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Appuyez sur + à côté d&apos;un plat pour l&apos;ajouter.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink-800">
          Nom
          <input className={fieldClass} value={customerName} onChange={(event) => onCustomerNameChange(event.target.value)} autoComplete="name" />
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Téléphone
          <input
            className={fieldClass}
            type="tel"
            inputMode="tel"
            value={customerPhone}
            onChange={(event) => onCustomerPhoneChange(event.target.value)}
            autoComplete="tel"
          />
        </label>
        <label className="block text-sm font-medium text-ink-800 sm:col-span-2">
          Adresse de livraison (quartier, repère)
          <input className={fieldClass} value={deliveryAddress} onChange={(event) => onDeliveryAddressChange(event.target.value)} />
        </label>
      </div>
      <fieldset className="min-w-0">
        <legend className="text-sm font-medium text-ink-800">Paiement</legend>
        <div className="mt-1 flex gap-2">
          {(["nita", "amana"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={paymentMode === mode}
              onClick={() => onPaymentModeChange(mode)}
              className={`min-h-11 flex-1 rounded-field border px-4 text-sm font-semibold ${
                paymentMode === mode ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-800"
              }`}
            >
              {mode === "nita" ? "Nita" : "Amana"}
            </button>
          ))}
        </div>
      </fieldset>

      <dl className="space-y-1 rounded-field bg-surface-1 p-3 text-sm text-ink-800">
        <div className="flex justify-between">
          <dt>Plats</dt>
          <dd>{formatXOF(total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Livraison</dt>
          <dd>{formatXOF(deliveryFee)}</dd>
        </div>
        {fees > 0 ? (
          <div className="flex justify-between">
            <dt>Frais de service</dt>
            <dd>{formatXOF(fees)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-ink-900">
          <dt>Total</dt>
          <dd>{formatXOF(grandTotal)}</dd>
        </div>
      </dl>

      <Button type="button" size="lg" className="w-full" disabled={isSubmitting || !selectedItems.length} onClick={onSubmit}>
        {isSubmitting ? "Envoi…" : selectedItems.length ? `Commander · ${formatXOF(grandTotal)}` : "Ajoutez un plat"}
      </Button>
      {statusMessage ? (
        <p className="text-sm text-ink-800" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}

