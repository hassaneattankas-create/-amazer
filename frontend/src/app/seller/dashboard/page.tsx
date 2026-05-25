"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CalendarClock, Clock3, Hotel, PlusCircle, Settings2, UtensilsCrossed } from "lucide-react";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { PasswordInput } from "@/components/PasswordInput";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { SingleMediaField } from "@/components/seller/MediaFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import { normalizeImageInputForApi, resolveImageUrl } from "@/lib/image";
import { deleteMyAccount } from "@/services/auth-service";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { notifyLocalOrderEvent } from "@/services/notification-service";
import { listCatalogCategories } from "@/services/catalog-service";
import {
  createRestaurantMenuItem,
  listSellerRestaurantMenu,
  listSellerRestaurantOrders,
  listSellerRestaurantReservations,
  updateSellerRestaurantMenuAvailability,
  updateSellerRestaurantOrderStatus,
  updateSellerRestaurantReservationStatus,
} from "@/services/restaurant-service";
import {
  createSellerProduct,
  getSellerProfile,
  listSellerHotelBookings,
  listSellerInventory,
  listSellerOrders,
  updateSellerOrderStatus,
  updateSellerHotelBookingStatus,
  updateSellerInventory,
} from "@/services/seller-service";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR");
}

export default function SellerDashboardPage() {
  const queryClient = useQueryClient();
  const seenShopOrderIdsRef = useRef<Set<string>>(new Set());
  const seenRestaurantOrderIdsRef = useRef<Set<string>>(new Set());
  const shopOrdersInitializedRef = useRef(false);
  const restaurantOrdersInitializedRef = useRef(false);
  const [status, setStatus] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [editingImagePriceId, setEditingImagePriceId] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    category_id: "",
    amount: "",
    stock_quantity: "1",
    description: "",
    main_image_url: "",
  });
  const [dishForm, setDishForm] = useState({
    name: "",
    description: "",
    image_url: "",
    base_price: "",
    prep: "20",
    tags: "Chaud,Populaire",
    options: "Boisson:500,Sauce pimentee:250",
  });

  const { data: profile, isPending: isProfilePending } = useQuery({
    queryKey: ["seller-profile-dashboard"],
    queryFn: getSellerProfile,
  });

  const sellerMode =
    profile?.activity_type === "hotel" || profile?.activity_type === "enterprise"
      ? "enterprise"
      : profile?.activity_type || "shop";
  const showProductTools = sellerMode === "shop" || sellerMode === "enterprise";
  const showRestaurantTools = sellerMode === "restaurant" || sellerMode === "enterprise";
  const showRestaurantReservationTools =
    showRestaurantTools && Boolean(profile?.accepts_table_reservations);
  const showHotelBookingTools =
    Boolean(profile) &&
    (profile?.activity_type === "hotel" || profile?.activity_type === "enterprise") &&
    Boolean(profile?.accepts_hotel_bookings);

  const { data: financeSettings } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
    enabled: showProductTools,
    staleTime: 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories-dashboard"],
    queryFn: listCatalogCategories,
    enabled: showProductTools,
  });
  const { data: inventory = [], isPending: isInventoryPending } = useQuery({
    queryKey: ["seller-inventory"],
    queryFn: listSellerInventory,
    enabled: showProductTools,
  });
  const { data: shopOrders = [] } = useQuery({
    queryKey: ["seller-shop-orders"],
    queryFn: listSellerOrders,
    enabled: showProductTools,
    refetchInterval: 5000,
  });
  const { data: sellerMenu = [] } = useQuery({
    queryKey: ["seller-restaurant-menu-dashboard"],
    queryFn: listSellerRestaurantMenu,
    enabled: showRestaurantTools,
  });
  const { data: restaurantOrders = [] } = useQuery({
    queryKey: ["seller-restaurant-orders"],
    queryFn: listSellerRestaurantOrders,
    enabled: showRestaurantTools,
    refetchInterval: 5000,
  });
  const { data: restaurantReservations = [] } = useQuery({
    queryKey: ["seller-restaurant-reservations"],
    queryFn: listSellerRestaurantReservations,
    enabled: showRestaurantReservationTools,
    refetchInterval: 10000,
  });
  const { data: hotelBookings = [] } = useQuery({
    queryKey: ["seller-hotel-bookings"],
    queryFn: listSellerHotelBookings,
    enabled: showHotelBookingTools,
    refetchInterval: 10000,
  });

  const inventoryMutation = useMutation({
    mutationFn: ({
      priceId,
      amount,
      stock,
      is_active,
      promo_amount,
      boost_duration_hours,
      boost_payment_reference,
      boost_payment_mode,
      main_image_url,
    }: {
      priceId: string;
      amount: number;
      stock: number;
      is_active?: boolean;
      promo_amount?: number;
      boost_duration_hours?: 24 | 168;
      boost_payment_reference?: string;
      boost_payment_mode?: "nita" | "amana";
      main_image_url?: string;
    }) =>
      updateSellerInventory(priceId, {
        amount,
        stock_quantity: stock,
        is_active,
        promo_amount,
        boost_duration_hours,
        boost_payment_reference,
        boost_payment_mode,
        main_image_url,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      setStatus("Stock mis a jour.");
    },
    onError: () => setStatus("Erreur mise a jour stock."),
  });

  function readBoostProof(priceId: string): {
    boost_payment_reference: string;
    boost_payment_mode: "nita" | "amana";
  } | null {
    const refInput = document.getElementById(`boost-ref-${priceId}`) as HTMLInputElement | null;
    const modeSelect = document.getElementById(`boost-mode-${priceId}`) as HTMLSelectElement | null;
    const boost_payment_reference = (refInput?.value ?? "").trim();
    const modeRaw = modeSelect?.value === "amana" ? "amana" : "nita";
    if (boost_payment_reference.length < 4) {
      setStatus("Boost: saisis la reference de paiement (apres versement Nita ou Amana) sur la ligne du produit.");
      return null;
    }
    return {
      boost_payment_reference,
      boost_payment_mode: modeRaw,
    };
  }

  const shopOrderStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: "commande" | "preparation" | "livraison" | "recu";
    }) => updateSellerOrderStatus(orderId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-shop-orders"] });
      setStatus("Commande boutique mise a jour.");
    },
    onError: () => setStatus("Erreur lors de la mise a jour de la commande boutique."),
  });

  const productMutation = useMutation({
    mutationFn: createSellerProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      setStatus("Produit ajoute au catalogue.");
      setProductForm({
        name: "",
        brand: "",
        category_id: "",
        amount: "",
        stock_quantity: "1",
        description: "",
        main_image_url: "",
      });
    },
    onError: () => setStatus("Erreur lors de l'ajout du produit."),
  });

  const dishMutation = useMutation({
    mutationFn: createRestaurantMenuItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-restaurant-menu-dashboard"] });
      setStatus("Plat restaurant publie.");
    },
    onError: () => setStatus("Erreur publication du plat."),
  });

  const menuAvailabilityMutation = useMutation({
    mutationFn: ({ menuItemId, isAvailable }: { menuItemId: string; isAvailable: boolean }) =>
      updateSellerRestaurantMenuAvailability(menuItemId, isAvailable),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-restaurant-menu-dashboard"] });
      setStatus("Disponibilite du plat mise a jour.");
    },
    onError: () => setStatus("Erreur lors de la mise a jour du menu."),
  });

  const orderStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: "commande" | "preparation" | "livraison" | "recu";
    }) => updateSellerRestaurantOrderStatus(orderId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-restaurant-orders"] });
      setStatus("Commande restaurant mise a jour.");
    },
  });

  const reservationStatusMutation = useMutation({
    mutationFn: ({
      reservationId,
      status,
    }: {
      reservationId: string;
      status: "pending" | "confirmed" | "declined";
    }) => updateSellerRestaurantReservationStatus(reservationId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-restaurant-reservations"] });
      setStatus("Reservation restaurant mise a jour.");
    },
  });

  const hotelBookingStatusMutation = useMutation({
    mutationFn: ({
      bookingId,
      status,
    }: {
      bookingId: string;
      status: "pending" | "confirmed" | "cancelled";
    }) => updateSellerHotelBookingStatus(bookingId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-hotel-bookings"] });
      setStatus("Reservation hotel mise a jour.");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      setDeleteStatus("Compte supprime avec succes. Redirection...");
      window.location.assign("/login");
    },
    onError: () => setDeleteStatus("Suppression impossible. Verifie le mot de passe."),
  });

  function onDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteStatus("");
    deleteAccountMutation.mutate({ password: deletePassword });
  }

  const parseOptions = (value: string): Array<{ name: string; price: number }> =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, priceText] = entry.split(":");
        return { name: (name || "").trim(), price: Number(priceText || 0) };
      })
      .filter((entry) => entry.name && Number.isFinite(entry.price));

  const normalizeImageInput = (raw: string): string | undefined => normalizeImageInputForApi(raw);
  const dashboardTitle =
    sellerMode === "restaurant"
      ? "Mon Restaurant AMAZER"
      : sellerMode === "enterprise"
        ? "Mon Premium AMAZER"
        : "Ma Boutique AMAZER";
  const dashboardDescription =
    sellerMode === "restaurant"
      ? 'Dashboard restaurant: gere tes plats, reservations et commandes.'
      : sellerMode === "enterprise"
        ? "Dashboard premium: produits, menu, reservations restaurant, reservations hotel et outils avances."
        : "Dashboard boutique: gere tes produits, ton stock et tes boosts.";

  useEffect(() => {
    const known = seenShopOrderIdsRef.current;
    if (!shopOrders.length) {
      return;
    }
    if (!shopOrdersInitializedRef.current) {
      for (const order of shopOrders) {
        known.add(order.id);
      }
      shopOrdersInitializedRef.current = true;
      return;
    }
    const newOrders = shopOrders.filter(
      (order) => (order.status === "commande" || order.status === "payment_pending") && !known.has(order.id)
    );
    for (const order of shopOrders) {
      known.add(order.id);
    }
    if (!newOrders.length) {
      return;
    }
    const latest = newOrders[0];
    const orderedItems = latest.items.map((item) => item.product_name).filter(Boolean).slice(0, 2).join(", ");
    notifyLocalOrderEvent({
      title: "Nouvelle commande boutique",
      body: `${latest.customer_name} a commande ${orderedItems || "un article"}${latest.tracking_code ? ` (${latest.tracking_code})` : ""}`.trim(),
      tag: `seller-shop-order-${latest.id}`,
      href: "/seller/dashboard",
    });
    setStatus(`Nouvelle commande boutique detectee pour ${latest.customer_name}.`);
  }, [shopOrders]);

  useEffect(() => {
    const known = seenRestaurantOrderIdsRef.current;
    if (!restaurantOrders.length) {
      return;
    }
    if (!restaurantOrdersInitializedRef.current) {
      for (const order of restaurantOrders) {
        known.add(order.id);
      }
      restaurantOrdersInitializedRef.current = true;
      return;
    }
    const newOrders = restaurantOrders.filter(
      (order) => (order.status === "commande" || order.status === "payment_pending") && !known.has(order.id)
    );
    for (const order of restaurantOrders) {
      known.add(order.id);
    }
    if (!newOrders.length) {
      return;
    }
    const latest = newOrders[0];
    const orderedDishes = latest.items.map((item) => item.dish_name).filter(Boolean).slice(0, 2).join(", ");
    notifyLocalOrderEvent({
      title: "Nouvelle commande restaurant",
      body: `${latest.customer_name} a commande ${orderedDishes || "un plat"}.`,
      tag: `seller-restaurant-order-${latest.id}`,
      href: "/seller/dashboard",
    });
    setStatus(`Nouvelle commande restaurant detectee pour ${latest.customer_name}.`);
  }, [restaurantOrders]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">{dashboardTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">{dashboardDescription}</p>
        {profile?.business_name ? (
          <p className="mt-2 text-sm font-medium text-slate-900">Espace actif: {profile.business_name}</p>
        ) : null}
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
          <Settings2 className="h-5 w-5 text-[#FF4D00]" />
          Configuration vendeur
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Le dashboard pilote maintenant les operations vendeur. Pour regler le profil complet,
          les services premium, les chambres ou la galerie, ouvre aussi la page de configuration.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/seller">Configurer mon profil vendeur</Link>
          </Button>
        </div>
      </article>

      <div className="space-y-6">
        {showProductTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <PlusCircle className="h-5 w-5 text-[#FF4D00]" />
              Ajouter un produit
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Cree un nouvel article directement depuis le dashboard.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                value={productForm.name}
                onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nom produit"
              />
              <Input
                value={productForm.brand}
                onChange={(event) => setProductForm((prev) => ({ ...prev, brand: event.target.value }))}
                placeholder="Marque"
              />
              <select
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
                value={productForm.category_id}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, category_id: event.target.value }))
                }
              >
                <option value="">Categorie (optionnel)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Input
                value={productForm.amount}
                onChange={(event) => setProductForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="Prix XOF"
                type="number"
              />
              <Input
                value={productForm.stock_quantity}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, stock_quantity: event.target.value }))
                }
                placeholder="Stock"
                type="number"
              />
              <SingleMediaField
                label="Photo du produit"
                value={productForm.main_image_url}
                onChange={(value) => setProductForm((prev) => ({ ...prev, main_image_url: value }))}
                emptyMessage="Choisis la photo du produit depuis la galerie."
              />
              <Input
                value={productForm.description}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Description"
              />
            </div>
            <Button
              type="button"
              className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
              onClick={() =>
                productMutation.mutate({
                  name: productForm.name,
                  brand: productForm.brand,
                  amount: Number(productForm.amount || 0),
                  stock_quantity: Number(productForm.stock_quantity || 0),
                  description: productForm.description || undefined,
                  main_image_url: normalizeImageInput(productForm.main_image_url),
                  category_id: productForm.category_id || undefined,
                  currency: "XOF",
                })
              }
            >
              Ajouter au catalogue
            </Button>
          </article>
        ) : null}

        {showRestaurantTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <UtensilsCrossed className="h-5 w-5 text-[#FF4D00]" />
              Ajouter un plat ou une boisson
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                value={dishForm.name}
                onChange={(event) => setDishForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nom du plat"
              />
              <Input
                value={dishForm.base_price}
                onChange={(event) => setDishForm((prev) => ({ ...prev, base_price: event.target.value }))}
                placeholder="Prix de base XOF"
                type="number"
              />
              <Input
                value={dishForm.description}
                onChange={(event) => setDishForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Description"
              />
              <SingleMediaField
                label="Photo du plat"
                value={dishForm.image_url}
                onChange={(value) => setDishForm((prev) => ({ ...prev, image_url: value }))}
                emptyMessage="Choisis la photo du plat depuis la galerie."
              />
              <Input
                value={dishForm.tags}
                onChange={(event) => setDishForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Tags (Chaud,Populaire,Promo)"
              />
              <Input
                value={dishForm.prep}
                onChange={(event) => setDishForm((prev) => ({ ...prev, prep: event.target.value }))}
                placeholder="Preparation (minutes)"
                type="number"
              />
              <Input
                value={dishForm.options}
                onChange={(event) => setDishForm((prev) => ({ ...prev, options: event.target.value }))}
                placeholder="Options format Nom:Prix,Nom:Prix"
                className="sm:col-span-2"
              />
            </div>
            <Button
              type="button"
              className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
              onClick={() =>
                dishMutation.mutate({
                  name: dishForm.name,
                  description: dishForm.description || undefined,
                  image_url: normalizeImageInput(dishForm.image_url),
                  base_price: Number(dishForm.base_price || 0),
                  currency: "XOF",
                  tags: dishForm.tags
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                  options: parseOptions(dishForm.options),
                  estimated_prep_minutes: Number(dishForm.prep || 20),
                })
              }
            >
              Publier au menu
            </Button>
          </article>
        ) : null}

        {showRestaurantTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <UtensilsCrossed className="h-5 w-5 text-[#FF4D00]" />
              Menu publie
            </h2>
            <div className="mt-4 space-y-3">
              {sellerMenu.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.tags.join(" - ") || "Sans tag"} | {formatXOF(item.base_price)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      className={
                        item.is_available
                          ? "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }
                      onClick={() =>
                        menuAvailabilityMutation.mutate({
                          menuItemId: item.id,
                          isAvailable: !item.is_available,
                        })
                      }
                    >
                      {item.is_available ? "Retirer du menu" : "Remettre au menu"}
                    </Button>
                  </div>
                </div>
              ))}
              {!sellerMenu.length ? (
                <p className="text-sm text-slate-500">Aucun plat ou boisson publie pour le moment.</p>
              ) : null}
            </div>
          </article>
        ) : null}

        {showRestaurantTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <Clock3 className="h-5 w-5 text-[#FF4D00]" />
              Commandes restaurant en temps reel
            </h2>
            <div className="mt-4 space-y-3">
              {restaurantOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {order.customer_name} - {order.customer_phone}
                    </p>
                    <p className="text-xs text-slate-500">{order.status}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{order.delivery_address}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Livraison: ~{order.delivery_minutes} min | Paiement: {order.payment_mode}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {order.items.map((item) => `${item.dish_name} x${item.quantity}`).join(" | ")}
                  </p>
                  <AnimatedPrice
                    value={order.total_amount}
                    className="mt-2 text-base font-semibold text-[#FF4D00]"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["commande", "preparation", "livraison", "recu"] as const).map((step) => (
                      <Button
                        key={`${order.id}-${step}`}
                        type="button"
                        onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: step })}
                        className={
                          order.status === step
                            ? "border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                            : "border border-slate-200 bg-white text-slate-700"
                        }
                      >
                        {step}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {!restaurantOrders.length ? (
                <p className="text-sm text-slate-500">Aucune commande restaurant en cours.</p>
              ) : null}
            </div>
          </article>
        ) : null}

        {showProductTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <Clock3 className="h-5 w-5 text-[#FF4D00]" />
              Commandes boutique en temps reel
            </h2>
            <div className="mt-4 space-y-3">
              {shopOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {order.customer_name} {order.tracking_code ? `- ${order.tracking_code}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.status} | {order.delivery_type}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.items.length} article(s) | paiement {order.payment_mode} |{" "}
                    {new Date(order.created_at).toLocaleString("fr-FR")}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {order.items.map((item) => `${item.product_name} x${item.quantity}`).join(" | ")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#FF4D00]">{formatXOF(order.total_amount)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["commande", "preparation", "livraison", "recu"] as const).map((step) => (
                      <Button
                        key={`${order.id}-${step}`}
                        type="button"
                        onClick={() => shopOrderStatusMutation.mutate({ orderId: order.id, status: step })}
                        className={
                          order.status === step
                            ? "border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                            : "border border-slate-200 bg-white text-slate-700"
                        }
                      >
                        {step}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {!shopOrders.length ? (
                <p className="text-sm text-slate-500">Aucune commande boutique en cours.</p>
              ) : null}
            </div>
          </article>
        ) : null}

        {showRestaurantReservationTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <CalendarClock className="h-5 w-5 text-[#FF4D00]" />
              Reservations restaurant
            </h2>
            <div className="mt-4 space-y-3">
              {restaurantReservations.map((reservation) => (
                <div key={reservation.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {reservation.customer_name} - {reservation.customer_phone}
                    </p>
                    <p className="text-xs text-slate-500">{reservation.status}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {reservation.guest_count} personne(s) | {formatDateTime(reservation.reservation_at)}
                  </p>
                  {reservation.note ? (
                    <p className="mt-1 text-xs text-slate-500">Note: {reservation.note}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["pending", "confirmed", "declined"] as const).map((step) => (
                      <Button
                        key={`${reservation.id}-${step}`}
                        type="button"
                        onClick={() =>
                          reservationStatusMutation.mutate({
                            reservationId: reservation.id,
                            status: step,
                          })
                        }
                        className={
                          reservation.status === step
                            ? "border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                            : "border border-slate-200 bg-white text-slate-700"
                        }
                      >
                        {step}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {!restaurantReservations.length ? (
                <p className="text-sm text-slate-500">Aucune reservation restaurant pour le moment.</p>
              ) : null}
            </div>
          </article>
        ) : null}

        {showHotelBookingTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <Hotel className="h-5 w-5 text-[#FF4D00]" />
              Reservations hotel
            </h2>
            <div className="mt-4 space-y-3">
              {hotelBookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {booking.guest_name} - {booking.guest_phone}
                    </p>
                    <p className="text-xs text-slate-500">{booking.status}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {String(booking.room_snapshot?.name || "Chambre")} | du{" "}
                    {formatDateTime(booking.check_in_date)} au {formatDateTime(booking.check_out_date)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {booking.guest_count} personne(s) | acompte {formatXOF(booking.deposit_amount)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["pending", "confirmed", "cancelled"] as const).map((step) => (
                      <Button
                        key={`${booking.id}-${step}`}
                        type="button"
                        onClick={() =>
                          hotelBookingStatusMutation.mutate({
                            bookingId: booking.id,
                            status: step,
                          })
                        }
                        className={
                          booking.status === step
                            ? "border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                            : "border border-slate-200 bg-white text-slate-700"
                        }
                      >
                        {step}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {!hotelBookings.length ? (
                <p className="text-sm text-slate-500">Aucune reservation hotel pour le moment.</p>
              ) : null}
            </div>
          </article>
        ) : null}

        {showProductTools && (isInventoryPending || isProfilePending) ? <ProductCardSkeleton /> : null}

        {showProductTools && !isInventoryPending && !isProfilePending ? (
          <div className="space-y-3">
            <article className="premium-card border border-slate-200 bg-white p-6">
              <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
                <Boxes className="h-5 w-5 text-[#FF4D00]" />
                {sellerMode === "enterprise" ? "Catalogue produits" : "Articles boutique"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {sellerMode === "enterprise"
                  ? "Espace premium: gere ton catalogue produits en plus du menu restaurant."
                  : "Espace boutique: gere tes articles, ton stock et tes boosts."}
              </p>
              {financeSettings ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <strong>Boost sponsorise payant:</strong> {formatXOF(financeSettings.ad_boost_price_24h)} pour 24 h ou{" "}
                  {formatXOF(financeSettings.ad_boost_price_7d)} pour 7 jours. Versement au numero AMAZER puis saisis la reference
                  sur chaque ligne (obligatoire pour activer le boost).
                </p>
              ) : null}
            </article>
            {inventory.map((item) => (
              <article key={item.price_id} className="premium-card border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Boxes className="h-4 w-4 text-[#FF4D00]" />
                      {item.product_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.brand}</p>
                    <AnimatedPrice value={item.amount} className="mt-2 text-lg font-semibold text-[#FF4D00]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} defaultValue={item.amount} className="w-28" id={`amount-${item.price_id}`} />
                    <Input type="number" min={0} defaultValue={item.stock_quantity} className="w-24" id={`stock-${item.price_id}`} />
                    <Input
                      type="number"
                      min={0}
                      defaultValue={item.promo_price ?? ""}
                      placeholder="Promo"
                      className="w-24"
                      id={`promo-${item.price_id}`}
                    />
                    <Button
                      className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
                      onClick={() => {
                        const amountInput = document.getElementById(`amount-${item.price_id}`) as HTMLInputElement | null;
                        const stockInput = document.getElementById(`stock-${item.price_id}`) as HTMLInputElement | null;
                        const promoInput = document.getElementById(`promo-${item.price_id}`) as HTMLInputElement | null;
                        const promoValue = Number(promoInput?.value ?? 0);
                        inventoryMutation.mutate({
                          priceId: item.price_id,
                          amount: Number(amountInput?.value ?? item.amount),
                          stock: Number(stockInput?.value ?? item.stock_quantity),
                          ...(promoValue > 0 ? { promo_amount: promoValue } : {}),
                        });
                      }}
                    >
                      Sauver
                    </Button>
                    <Button
                      className={
                        item.is_active
                          ? "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }
                      onClick={() =>
                        inventoryMutation.mutate({
                          priceId: item.price_id,
                          amount: item.amount,
                          stock: item.stock_quantity,
                          is_active: !item.is_active,
                        })
                      }
                    >
                      {item.is_active ? "Retirer" : "Re-publier"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">Boost (apres paiement)</span>
                  <select
                    id={`boost-mode-${item.price_id}`}
                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                    defaultValue="nita"
                  >
                    <option value="nita">Nita</option>
                    <option value="amana">Amana</option>
                  </select>
                  <Input
                    id={`boost-ref-${item.price_id}`}
                    placeholder="Reference de paiement"
                    className="h-9 w-full max-w-xs text-xs sm:w-56"
                  />
                  <Button
                    className="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    onClick={() => {
                      const proof = readBoostProof(item.price_id);
                      if (!proof) {
                        return;
                      }
                      inventoryMutation.mutate({
                        priceId: item.price_id,
                        amount: item.amount,
                        stock: item.stock_quantity,
                        boost_duration_hours: 24,
                        ...proof,
                      });
                    }}
                  >
                    Boost 24 h
                  </Button>
                  <Button
                    className="border border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200"
                    onClick={() => {
                      const proof = readBoostProof(item.price_id);
                      if (!proof) {
                        return;
                      }
                      inventoryMutation.mutate({
                        priceId: item.price_id,
                        amount: item.amount,
                        stock: item.stock_quantity,
                        boost_duration_hours: 168,
                        ...proof,
                      });
                    }}
                  >
                    Boost 7 j
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {item.is_boosted ? "Boost actif" : "Boost inactif"}
                  {item.boost_until ? ` jusqu au ${formatDateTime(item.boost_until)}` : ""}
                  {item.promo_price ? ` | Promo: ${item.promo_price.toFixed(0)} XOF` : ""}
                </p>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-3">
                    {item.main_image_url ? (
                      <img
                        src={resolveImageUrl(item.main_image_url) ?? ""}
                        alt={item.product_name}
                        className="h-14 w-14 rounded-md object-cover border border-slate-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                        Sans photo
                      </div>
                    )}
                    {editingImagePriceId === item.price_id ? (
                      <div className="flex flex-1 flex-col gap-2">
                        <SingleMediaField
                          label=""
                          value={editImageUrl}
                          onChange={setEditImageUrl}
                          emptyMessage="Choisis ou uploade une photo"
                        />
                        <div className="flex gap-2">
                          <Button
                            className="bg-[#FF4D00] text-white hover:bg-[#e74700] text-xs px-3 h-8"
                            onClick={() => {
                              const normalized = normalizeImageInputForApi(editImageUrl);
                              inventoryMutation.mutate({
                                priceId: item.price_id,
                                amount: item.amount,
                                stock: item.stock_quantity,
                                main_image_url: normalized ?? "",
                              });
                              setEditingImagePriceId(null);
                              setEditImageUrl("");
                            }}
                          >
                            Sauver photo
                          </Button>
                          <Button
                            className="border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 text-xs px-3 h-8"
                            onClick={() => { setEditingImagePriceId(null); setEditImageUrl(""); }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 text-xs px-3 h-8"
                        onClick={() => {
                          setEditingImagePriceId(item.price_id);
                          setEditImageUrl(item.main_image_url ?? "");
                        }}
                      >
                        {item.main_image_url ? "Changer photo" : "Ajouter photo"}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {!inventory.length ? (
              <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Aucun article dans votre inventaire pour le moment.
              </article>
            ) : null}
          </div>
        ) : null}

        {!showProductTools && !showRestaurantTools && !isProfilePending ? (
          <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Complete d&apos;abord ton profil vendeur pour activer le bon dashboard.
          </article>
        ) : null}

        {status ? <p className="text-sm text-slate-700">{status}</p> : null}
      </div>

      <article className="premium-card border border-rose-200 bg-rose-50 p-6">
        <h2 className="luxury-title text-lg font-semibold text-rose-700">Suppression Du Compte Vendeur</h2>
        <p className="mt-1 text-sm text-rose-700/80">
          Action irreversible: votre compte sera desactive, votre boutique fermee et vos donnees personnelles anonymisees.
        </p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={onDeleteAccount}>
          <PasswordInput
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            placeholder="Mot de passe actuel"
            required
            wrapperClassName="w-full sm:flex-1"
          />
          <Button
            type="submit"
            disabled={deleteAccountMutation.isPending || !deletePassword}
            className="bg-rose-600 text-white hover:bg-rose-500"
          >
            {deleteAccountMutation.isPending ? "Suppression..." : "Supprimer Mon Compte"}
          </Button>
        </form>
        {deleteStatus ? <p className="mt-2 text-sm text-rose-800">{deleteStatus}</p> : null}
      </article>
    </section>
  );
}
