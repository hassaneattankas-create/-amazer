"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Settings2 } from "lucide-react";

import { PasswordInput } from "@/components/PasswordInput";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { SingleMediaField } from "@/components/seller/MediaFields";
import { TransportDesk } from "@/components/seller/hotel/TransportDesk";
import { HotelFrontDesk, HotelKpis } from "@/components/seller/hotel/HotelFrontDesk";
import { RestaurantKitchen } from "@/components/seller/restaurant/RestaurantKitchen";
import { RestaurantKpis } from "@/components/seller/restaurant/RestaurantKpis";
import { RestaurantMenuManager, SELLER_MENU_KEY } from "@/components/seller/restaurant/RestaurantMenuManager";
import { RestaurantReservations } from "@/components/seller/restaurant/RestaurantReservations";
import { RestaurantSettingsPanel } from "@/components/seller/restaurant/RestaurantSettingsPanel";
import { SellerReviewsPanel } from "@/components/seller/SellerReviewsPanel";
import { SellerKpis } from "@/components/seller/SellerKpis";
import { SellerOrderList } from "@/components/seller/SellerOrderList";
import { SellerProductList } from "@/components/seller/SellerProductList";
import { getShopRoute } from "@/lib/mobile-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeImageInputForApi } from "@/lib/image";
import { getApiErrorMessage } from "@/lib/api-error";
import { deleteMyAccount } from "@/services/auth-service";
import { notifyLocalOrderEvent } from "@/services/notification-service";
import { listCatalogCategories } from "@/services/catalog-service";
import {
  listSellerRestaurantMenu,
  listSellerRestaurantOrders,
  listSellerRestaurantReservations,
} from "@/services/restaurant-service";
import {
  createSellerProduct,
  deleteSellerInventoryItem,
  exportSellerOrdersCsv,
  getSellerProfile,
  importSellerProductPhotos,
  importSellerProductsCsv,
  listSellerHotelBookings,
  listSellerInventory,
  listSellerOrders,
  updateSellerOrderStatus,
  updateSellerInventory,
} from "@/services/seller-service";

type SellerTab = "accueil" | "commandes" | "produits" | "ajouter" | "reglages";
const SELLER_TABS: { key: SellerTab; label: string }[] = [
  { key: "accueil", label: "Accueil" },
  { key: "commandes", label: "Commandes" },
  { key: "produits", label: "Produits" },
  { key: "ajouter", label: "Ajouter" },
  { key: "reglages", label: "Réglages" },
];

export default function SellerDashboardPage() {
  const queryClient = useQueryClient();
  const seenShopOrderIdsRef = useRef<Set<string>>(new Set());
  const seenRestaurantOrderIdsRef = useRef<Set<string>>(new Set());
  const shopOrdersInitializedRef = useRef(false);
  const restaurantOrdersInitializedRef = useRef(false);
  const [status, setStatus] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    category_id: "",
    amount: "",
    stock_quantity: "1",
    description: "",
    main_image_url: "",
  });
  const [tab, setTab] = useState<SellerTab>("accueil");
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.replace("#", "");
      const target = hash === "catalogue" ? "produits" : hash;
      if (SELLER_TABS.some((item) => item.key === target)) setTab(target as SellerTab);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const openTab = (key: SellerTab) => {
    setTab(key);
    window.history.replaceState(null, "", `#${key}`);
    window.scrollTo({ top: 0 });
  };

  const { data: profile, isPending: isProfilePending } = useQuery({
    queryKey: ["seller-profile-dashboard"],
    queryFn: getSellerProfile,
  });

  const sellerMode =
    profile?.activity_type === "hotel" || profile?.activity_type === "enterprise"
      ? "enterprise"
      : profile?.activity_type || "shop";
  const showProductTools = sellerMode === "shop" || (sellerMode === "enterprise" && profile?.offers_shop !== false);
  const showRestaurantTools = sellerMode === "restaurant" || (sellerMode === "enterprise" && Boolean(profile?.offers_restaurant));
  const showRestaurantReservationTools =
    showRestaurantTools && Boolean(profile?.accepts_table_reservations);
  const isTransport = Boolean(profile?.offers_transport) || profile?.activity_type === "transport";
  const showHotelBookingTools =
    Boolean(profile) &&
    (profile?.activity_type === "hotel" || profile?.activity_type === "enterprise" || isTransport) &&
    Boolean(profile?.accepts_hotel_bookings);


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
    queryKey: SELLER_MENU_KEY,
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
      promo_days,
      clear_promo,
      main_image_url,
      product_name,
      brand,
      description,
    }: {
      priceId: string;
      amount: number;
      stock: number;
      is_active?: boolean;
      promo_amount?: number;
      promo_days?: number;
      clear_promo?: boolean;
      main_image_url?: string;
      product_name?: string;
      brand?: string;
      description?: string;
    }) =>
      updateSellerInventory(priceId, {
        amount,
        stock_quantity: stock,
        is_active,
        promo_amount,
        promo_days,
        clear_promo,
        main_image_url,
        product_name,
        brand,
        description,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      setStatus("Produit mis à jour.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Mise à jour impossible. Réessayez.")),
  });

  const deleteInventoryMutation = useMutation({
    mutationFn: deleteSellerInventoryItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      setStatus("Produit supprime du catalogue.");
    },
    onError: () => setStatus("Erreur lors de la suppression du produit."),
  });

  const importProductsMutation = useMutation({
    mutationFn: importSellerProductsCsv,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      const errs = result.errors.length ? ` (${result.errors.length} ligne(s) ignoree(s))` : "";
      setStatus(`${result.created} produit(s) importe(s)${errs}.`);
    },
    onError: () => setStatus("Import impossible. Vérifié le format du fichier CSV."),
  });

  const importPhotosMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const chunkSize = 8;
      let created = 0;
      const errors: string[] = [];
      const total = files.length;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        setStatus(`Envoi des photos... ${Math.min(i + chunk.length, total)}/${total}`);
        const res = await importSellerProductPhotos(chunk);
        created += res.created;
        errors.push(...res.errors);
      }
      return { created, errors };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      const errs = result.errors.length ? ` (${result.errors.length} ignoree(s))` : "";
      setStatus(
        `${result.created} produit(s) créé(s) depuis tes photos${errs}. ` +
          "Complete le nom et le prix de chaque article puis active-le.",
      );
    },
    onError: () => setStatus("Envoi des photos impossible. Reessaie avec moins de photos."),
  });


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
      setStatus("Commande boutique mise à jour.");
    },
    onError: () => setStatus("Erreur lors de la mise à jour de la commande boutique."),
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


  const deleteAccountMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      setDeleteStatus("Compte supprime avec succes. Redirection...");
      window.location.assign("/login");
    },
    onError: () => setDeleteStatus("Suppression impossible. Vérifie le mot de passe."),
  });

  function onDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteStatus("");
    deleteAccountMutation.mutate({ password: deletePassword });
  }

  const [showDeleteZone, setShowDeleteZone] = useState(false);

  const normalizeImageInput = (raw: string): string | undefined => normalizeImageInputForApi(raw);

  const dashboardTitle =
    sellerMode === "restaurant"
      ? "Mon Restaurant AMAZER"
      : sellerMode === "enterprise"
        ? "Mon Premium AMAZER"
        : "Ma Boutique AMAZER";

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
    <section className="mx-auto w-full max-w-5xl space-y-4 px-gutter pb-14 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{profile?.business_name || dashboardTitle}</h1>
          <p className="text-sm text-ink-600">Espace vendeur</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.vendor_id ? (
            <Button asChild variant="outline" size="sm">
              <Link href={getShopRoute(profile.vendor_id)}>Voir ma boutique</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/seller">
              <Settings2 className="mr-1.5 h-4 w-4" />
              Profil et abonnement
            </Link>
          </Button>
        </div>
      </header>

      <nav className="sticky top-14 z-dropdown -mx-gutter border-b border-border bg-background/95 px-gutter backdrop-blur sm:top-16" aria-label="Sections vendeur">
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {SELLER_TABS.filter((item) => item.key !== "commandes" || showProductTools || showRestaurantTools || showHotelBookingTools).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => openTab(item.key)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors duration-fast ${
                tab === item.key ? "border-brand-600 text-ink-900" : "border-transparent text-ink-600 hover:text-ink-900"
              }`}
            >
              {item.key === "produits" && showRestaurantTools && !showProductTools ? "Menu" : item.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "accueil" ? (
        <>
          {showProductTools ? <SellerKpis orders={shopOrders} inventory={inventory} /> : null}
          {showRestaurantTools ? <RestaurantKpis orders={restaurantOrders} menu={sellerMenu} /> : null}
          {showHotelBookingTools && !isTransport ? <HotelKpis bookings={hotelBookings} rooms={profile?.room_types ?? []} /> : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" size="lg" onClick={() => openTab("ajouter")}>
              <PlusCircle className="h-4 w-4" />
              {showRestaurantTools && !showProductTools ? "Ajouter un plat" : showHotelBookingTools && !showProductTools ? (isTransport ? "Gérer mes trajets" : "Gérer mes chambres") : "Ajouter un produit"}
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => openTab("commandes")}>
              Voir mes commandes
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => openTab("produits")}>
              {showRestaurantTools && !showProductTools ? "Gérer mon menu" : "Gérer mes produits"}
            </Button>
          </div>
          <SellerReviewsPanel />
          <p className="text-sm text-ink-600">
            Besoin d&apos;aide ?{" "}
            <Link href="/comment-ca-marche#vendre" className="font-medium text-brand-700 hover:underline">
              Guide du vendeur
            </Link>{" "}
            ·{" "}
            <Link href="/formations" className="font-medium text-brand-700 hover:underline">
              Formations gratuites
            </Link>
          </p>
        </>
      ) : null}

      {tab === "reglages" && showRestaurantTools ? <RestaurantSettingsPanel /> : null}

      {tab === "reglages" && (profile?.storefront_tier === "premium" ||
      profile?.activity_type === "enterprise" ||
      profile?.activity_type === "hotel") ? (
        <article className="premium-card border border-indigo-200 bg-indigo-50/50 p-5">
          <h2 className="luxury-title text-lg font-semibold text-slate-900">Outils Premium</h2>
          <p className="mt-1 text-sm text-slate-600">
            Gere ton gros catalogue et ta comptabilite en quelques clics.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void exportSellerOrdersCsv().catch(() => setStatus("Export impossible."));
              }}
            >
              Exporter mes ventes (texte)
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              {importProductsMutation.isPending ? "Import en cours..." : "Importer des produits"}
              <input
                type="file"
                accept=".csv,.tsv,.txt,.json,text/csv,text/plain,text/tab-separated-values,application/json"
                className="hidden"
                disabled={importProductsMutation.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    importProductsMutation.mutate(file);
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Formats acceptes: CSV, TSV, point-virgule, texte ou JSON. Colonnes{" "}
            <span className="font-medium">nom, marque, prix, stock, description</span>.
          </p>
        </article>
      ) : null}

      <div className="space-y-6">
        {tab === "ajouter" && showProductTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <PlusCircle className="h-5 w-5 text-brand-600" />
              Ajouter un produit
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              <Link href="/comment-ca-marche#photos" className="font-medium text-brand-700 hover:underline">
                Conseils pour des photos qui font vendre
              </Link>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Cree un nouvel article directement depuis le dashboard.
            </p>

            {profile?.storefront_tier === "premium" ? (
              <div className="mt-4 rounded-xl border border-dashed border-brand-300 bg-orange-50/60 p-4">
                <p className="text-sm font-medium text-slate-900">
                  Import rapide par photos
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    Premium
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Selectionne plusieurs photos : on cree automatiquement{" "}
                  <span className="font-medium">un produit brouillon par photo</span> (masque du
                  public). Tu completes ensuite le nom et le prix de chaque article, puis tu
                  l&apos;actives.
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-orange-50">
                  {importPhotosMutation.isPending ? "Envoi des photos..." : "Choisir des photos"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={importPhotosMutation.isPending}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      if (files.length) {
                        importPhotosMutation.mutate(files);
                      }
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            ) : null}

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
                <option value="">Catégorie (optionnel)</option>
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
              className="primary-glow-btn mt-4 bg-brand-600 text-white hover:bg-brand-700"
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

        {tab === "ajouter" && showRestaurantTools ? <RestaurantMenuManager startWithForm /> : null}

        {tab === "produits" && showRestaurantTools ? <RestaurantMenuManager /> : null}

        {tab === "commandes" && showRestaurantTools ? <RestaurantKitchen orders={restaurantOrders} /> : null}

        {tab === "commandes" && showProductTools ? (
          <SellerOrderList
            orders={shopOrders}
            busy={shopOrderStatusMutation.isPending}
            onAdvance={(orderId, next) => shopOrderStatusMutation.mutate({ orderId, status: next })}
          />
        ) : null}

        {tab === "commandes" && showRestaurantReservationTools ? <RestaurantReservations reservations={restaurantReservations} /> : null}

        {tab === "commandes" && showHotelBookingTools && !isTransport ? <HotelFrontDesk bookings={hotelBookings} /> : null}

        {tab === "commandes" && showHotelBookingTools && isTransport ? <TransportDesk bookings={hotelBookings} trips={profile?.room_types ?? []} /> : null}

        {tab === "produits" && showProductTools && (isInventoryPending || isProfilePending) ? <ProductCardSkeleton /> : null}

        {tab === "produits" && showProductTools && !isInventoryPending && !isProfilePending ? (
          <SellerProductList
            inventory={inventory}
            busy={inventoryMutation.isPending || deleteInventoryMutation.isPending}
            onUpdate={(update) => inventoryMutation.mutate(update)}
            onDelete={(priceId) => deleteInventoryMutation.mutate(priceId)}
          />
        ) : null}

        {!showProductTools && !showRestaurantTools && showHotelBookingTools && (tab === "produits" || tab === "ajouter") ? (
          <article className="space-y-3 rounded-card border border-border bg-card p-5">
            <p className="font-semibold text-ink-900">{isTransport ? "Vos trajets" : "Vos chambres"}</p>
            <p className="text-sm text-ink-700">
              {isTransport
                ? "Ajoutez ou modifiez vos trajets, prix, places et horaires dans Profil et abonnement."
                : "Ajoutez ou modifiez vos chambres (photos, prix par nuit, nombre de chambres) dans Profil et abonnement."}
            </p>
            <Button asChild>
              <Link href="/seller#chambres">{isTransport ? "Gérer mes trajets" : "Gérer mes chambres"}</Link>
            </Button>
          </article>
        ) : null}

        {!showProductTools && !showRestaurantTools && !showHotelBookingTools && !isProfilePending ? (
          <article className="rounded-card border border-border bg-card p-6 text-sm text-ink-700">
            Complétez d&apos;abord votre profil vendeur pour activer votre espace.{" "}
            <Link href="/seller" className="font-semibold text-brand-700 hover:underline">
              Compléter mon profil
            </Link>
          </article>
        ) : null}

        {status ? <p className="text-sm text-slate-700">{status}</p> : null}
      </div>

      <div className={tab === "reglages" ? "" : "hidden"}>
        <button
          type="button"
          onClick={() => setShowDeleteZone((v) => !v)}
          className="text-xs text-slate-400 hover:text-rose-500 underline"
        >
          {showDeleteZone ? "Masquer" : "Supprimer mon compte"}
        </button>
        {showDeleteZone ? (
          <article className="premium-card mt-3 border border-rose-200 bg-rose-50 p-5">
            <h2 className="text-sm font-semibold text-rose-700">Suppression du compte vendeur</h2>
            <p className="mt-1 text-xs text-rose-700/80">
              Action irréversible : boutique fermée et données anonymisées.
            </p>
            <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={onDeleteAccount}>
              <PasswordInput
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Mot de passe actuel"
                required
                wrapperClassName="w-full sm:flex-1"
              />
              <Button type="submit" disabled={deleteAccountMutation.isPending || !deletePassword} className="bg-rose-600 text-white hover:bg-rose-500" size="sm">
                {deleteAccountMutation.isPending ? "..." : "Supprimer"}
              </Button>
            </form>
            {deleteStatus ? <p className="mt-2 text-xs text-rose-800">{deleteStatus}</p> : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}
