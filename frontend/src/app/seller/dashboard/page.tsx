"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CalendarClock, Clock3, Hotel, PlusCircle, Settings2, Trash2, UtensilsCrossed } from "lucide-react";

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
  deleteSellerInventoryItem,
  exportSellerOrdersCsv,
  getSellerProfile,
  importSellerProductPhotos,
  importSellerProductsCsv,
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
  const isTransport = Boolean(profile?.offers_transport) || profile?.activity_type === "transport";
  const showHotelBookingTools =
    Boolean(profile) &&
    (profile?.activity_type === "hotel" || profile?.activity_type === "enterprise" || isTransport) &&
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
        main_image_url,
        product_name,
        brand,
        description,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      setStatus("Stock mis a jour.");
    },
    onError: () => setStatus("Erreur mise a jour stock."),
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
    onError: () => setStatus("Import impossible. Verifie le format du fichier CSV."),
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
        `${result.created} produit(s) cree(s) depuis tes photos${errs}. ` +
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
    onError: () => setDeleteStatus("Suppression impossible. Vérifie le mot de passe."),
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

  const [showDeleteZone, setShowDeleteZone] = useState(false);

  const normalizeImageInput = (raw: string): string | undefined => normalizeImageInputForApi(raw);

  function nextOrderStep(current: string): { label: string; next: "commande" | "preparation" | "livraison" | "recu" } | null {
    const map: Record<string, { label: string; next: "commande" | "preparation" | "livraison" | "recu" }> = {
      "commande": { label: "Confirmer reception paiement", next: "preparation" },
      "preparation": { label: "Expedier / En livraison", next: "livraison" },
      "livraison": { label: "Marquer livre", next: "recu" },
    };
    return map[current] ?? null;
  }

  const dashboardTitle =
    sellerMode === "restaurant"
      ? "Mon Restaurant AMAZER"
      : sellerMode === "enterprise"
        ? "Mon Premium AMAZER"
        : "Ma Boutique AMAZER";
  const dashboardDescription =
    sellerMode === "restaurant"
      ? "Gere tes plats, boissons, reservations et commandes restaurant."
      : sellerMode === "enterprise"
        ? "Espace premium: produits, menu restaurant, reservations et outils avances."
        : "Gere tes produits, ton stock, ton menu restaurant et tes commandes.";

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
      <header className="premium-card border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="luxury-title text-2xl font-semibold">{dashboardTitle}</h1>
            {profile?.business_name ? (
              <p className="mt-1 text-sm text-slate-500">{profile.business_name}</p>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/seller">
              <Settings2 className="mr-1.5 h-4 w-4" />
              Modifier le profil
            </Link>
          </Button>
        </div>
      </header>

      {profile?.is_enterprise ? (
        <article className="premium-card border border-indigo-200 bg-indigo-50/50 p-5">
          <h2 className="luxury-title text-lg font-semibold text-slate-900">Outils Premium Entreprise</h2>
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
        {showProductTools ? (
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <PlusCircle className="h-5 w-5 text-[#FF4D00]" />
              Ajouter un produit
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Cree un nouvel article directement depuis le dashboard.
            </p>

            <div className="mt-4 rounded-xl border border-dashed border-[#FF4D00]/40 bg-orange-50/60 p-4">
              <p className="text-sm font-medium text-slate-900">
                Import rapide par photos
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Selectionne plusieurs photos : on cree automatiquement{" "}
                <span className="font-medium">un produit brouillon par photo</span> (masque du
                public). Tu completes ensuite le nom et le prix de chaque article, puis tu
                l&apos;actives.
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#FF4D00]/50 bg-white px-3 py-1.5 text-sm font-medium text-[#FF4D00] hover:bg-orange-50">
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
              {restaurantOrders.map((order) => {
                const next = nextOrderStep(order.status);
                return (
                  <div key={order.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.customer_name} — {order.customer_phone}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{order.items.map((it) => `${it.dish_name} x${it.quantity}`).join(", ")}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{order.delivery_address} | {order.payment_mode?.toUpperCase()}</p>
                        <AnimatedPrice value={order.total_amount} className="mt-1 text-sm font-semibold text-[#FF4D00]" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {order.status === "commande" ? "Nouvelle" : order.status === "preparation" ? "En preparation" : order.status === "livraison" ? "En livraison" : "Livree"}
                        </span>
                        {next ? (
                          <Button size="sm" className="primary-glow-btn bg-[#FF4D00] text-white" onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: next.next })}>
                            {next.label}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              {shopOrders.map((order) => {
                const next = nextOrderStep(order.status);
                return (
                  <div key={order.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {order.customer_name} {order.tracking_code ? `#${order.tracking_code}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {order.items.map((it) => `${it.product_name} x${it.quantity}`).join(", ")}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {order.payment_mode?.toUpperCase()} | {new Date(order.created_at).toLocaleDateString("fr-FR")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#FF4D00]">{formatXOF(order.total_amount)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {order.status === "commande" ? "Nouvelle" : order.status === "payment_pending" ? "Paiement en attente" : order.status === "preparation" ? "En preparation" : order.status === "livraison" ? "En livraison" : "Livree"}
                        </span>
                        {next ? (
                          <Button size="sm" className="primary-glow-btn bg-[#FF4D00] text-white" onClick={() => shopOrderStatusMutation.mutate({ orderId: order.id, status: next.next })}>
                            {next.label}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                    {reservation.status !== "confirmed" ? (
                      <Button size="sm" className="border border-emerald-300 bg-emerald-50 text-emerald-700"
                        onClick={() => reservationStatusMutation.mutate({ reservationId: reservation.id, status: "confirmed" })}>
                        Confirmer
                      </Button>
                    ) : null}
                    {reservation.status !== "declined" ? (
                      <Button size="sm" className="border border-rose-300 bg-rose-50 text-rose-700"
                        onClick={() => reservationStatusMutation.mutate({ reservationId: reservation.id, status: "declined" })}>
                        Refuser
                      </Button>
                    ) : null}
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
              {isTransport ? "Reservations de trajets" : "Reservations hotel"}
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
                    {booking.status !== "confirmed" ? (
                      <Button size="sm" className="border border-emerald-300 bg-emerald-50 text-emerald-700"
                        onClick={() => hotelBookingStatusMutation.mutate({ bookingId: booking.id, status: "confirmed" })}>
                        Confirmer
                      </Button>
                    ) : null}
                    {booking.status !== "cancelled" ? (
                      <Button size="sm" className="border border-rose-300 bg-rose-50 text-rose-700"
                        onClick={() => hotelBookingStatusMutation.mutate({ bookingId: booking.id, status: "cancelled" })}>
                        Annuler
                      </Button>
                    ) : null}
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
Catalogue produits
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {sellerMode === "enterprise"
                  ? "Gere ton catalogue produits et ton menu restaurant."
                  : "Gere tes articles, ton stock et tes promotions."}
              </p>
            </article>
            {inventory.map((item) => (
              <article key={item.price_id} className="premium-card border border-slate-200 bg-white p-4">
                {/* Ligne principale : image + infos + champs + actions */}
                <div className="flex flex-wrap gap-3 items-start">
                  {/* Image */}
                  <div className="shrink-0">
                    {item.main_image_url ? (
                      <img
                        src={resolveImageUrl(item.main_image_url) ?? ""}
                        alt={item.product_name}
                        className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditingImagePriceId(item.price_id); setEditImageUrl(""); }}
                        className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 hover:border-[#FF4D00]/50"
                      >
                        + Photo
                      </button>
                    )}
                    {item.main_image_url ? (
                      <button
                        type="button"
                        onClick={() => { setEditingImagePriceId(item.price_id); setEditImageUrl(item.main_image_url ?? ""); }}
                        className="mt-1 w-full text-center text-[10px] text-slate-400 hover:text-[#FF4D00]"
                      >
                        Changer
                      </button>
                    ) : null}
                  </div>

                  {/* Champs éditables */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input id={`name-${item.price_id}`} defaultValue={item.product_name} placeholder="Nom" className="h-9 text-sm" />
                      <Input id={`brand-${item.price_id}`} defaultValue={item.brand} placeholder="Marque" className="h-9 text-sm" />
                      <Input id={`desc-${item.price_id}`} defaultValue={item.description ?? ""} placeholder="Description" className="h-9 text-sm sm:col-span-2" />
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Input type="number" min={0} defaultValue={item.amount} placeholder="Prix XOF" className="h-9 w-28 text-sm" id={`amount-${item.price_id}`} />
                      <Input type="number" min={0} defaultValue={item.stock_quantity} placeholder="Stock" className="h-9 w-20 text-sm" id={`stock-${item.price_id}`} />
                      <Input type="number" min={0} defaultValue={item.promo_price ?? ""} placeholder="Promo" className="h-9 w-24 text-sm" id={`promo-${item.price_id}`} />
                      {item.promo_price ? <span className="text-xs text-[#FF4D00]">Promo: {item.promo_price.toFixed(0)} XOF</span> : null}
                    </div>
                  </div>

                  {/* Boutons actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
                      disabled={inventoryMutation.isPending}
                      onClick={() => {
                        const get = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
                        const promoVal = Number(get(`promo-${item.price_id}`));
                        inventoryMutation.mutate({
                          priceId: item.price_id,
                          amount: Number(get(`amount-${item.price_id}`)) || item.amount,
                          stock: Number(get(`stock-${item.price_id}`)) ?? item.stock_quantity,
                          product_name: get(`name-${item.price_id}`).trim() || undefined,
                          brand: get(`brand-${item.price_id}`).trim() || undefined,
                          description: get(`desc-${item.price_id}`).trim() || undefined,
                          ...(promoVal > 0 ? { promo_amount: promoVal } : {}),
                        });
                      }}
                    >
                      Sauver
                    </Button>
                    <Button
                      size="sm"
                      className={item.is_active ? "border border-rose-300 bg-rose-50 text-rose-700" : "border border-emerald-300 bg-emerald-50 text-emerald-700"}
                      onClick={() => inventoryMutation.mutate({ priceId: item.price_id, amount: item.amount, stock: item.stock_quantity, is_active: !item.is_active })}
                    >
                      {item.is_active ? "Retirer" : "Republier"}
                    </Button>
                    <Button
                      size="sm"
                      className="border border-red-200 bg-white text-red-600 hover:bg-red-50"
                      disabled={deleteInventoryMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Supprimer "${item.product_name}" ?`)) {
                          deleteInventoryMutation.mutate(item.price_id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Edition image (quand active) */}
                {editingImagePriceId === item.price_id ? (
                  <div className="mt-3 flex gap-2 items-end border-t border-slate-100 pt-3">
                    <div className="flex-1">
                      <SingleMediaField label="" value={editImageUrl} onChange={setEditImageUrl} emptyMessage="Choisis ou uploade une photo" />
                    </div>
                    <Button size="sm" className="bg-[#FF4D00] text-white" onClick={() => {
                      inventoryMutation.mutate({ priceId: item.price_id, amount: item.amount, stock: item.stock_quantity, main_image_url: normalizeImageInputForApi(editImageUrl) ?? "" });
                      setEditingImagePriceId(null); setEditImageUrl("");
                    }}>
                      Sauver photo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingImagePriceId(null); setEditImageUrl(""); }}>Annuler</Button>
                  </div>
                ) : null}
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

      <div>
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
              Action irreversible: boutique fermee et donnees anonymisees.
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
