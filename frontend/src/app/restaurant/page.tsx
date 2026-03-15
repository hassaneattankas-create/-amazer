"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, ForkKnife } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { StorefrontShowcaseCard } from "@/components/storefront/StorefrontShowcaseCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { listStorefronts } from "@/services/catalog-service";
import { getPublicFinanceSettings } from "@/services/finance-service";
import {
  createRestaurantOrder,
  listRestaurantMenu,
} from "@/services/restaurant-service";
import { RestaurantMenuItem, RestaurantMenuOption } from "@/types/restaurant";

type SelectedItem = {
  menu_item_id: string;
  vendor_id: string;
  name: string;
  quantity: number;
  base_price: number;
  selected_options: RestaurantMenuOption[];
  customer_note: string;
};

const dishImageFallbacks = [
  "/images/placeholders/restaurant.svg",
  "/images/placeholders/alimentation.svg",
  "/images/placeholders/default.svg",
];

function badgeColor(tag: string): string {
  if (tag.toLowerCase() === "chaud") return "bg-rose-100 text-rose-700 border-rose-200";
  if (tag.toLowerCase() === "populaire") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function resolveMenuCategory(item: RestaurantMenuItem): string {
  const normalizedTags = (item.tags || []).map((tag) => tag.trim().toLowerCase());
  if (normalizedTags.some((tag) => tag.includes("entree"))) {
    return "Entrees";
  }
  if (normalizedTags.some((tag) => tag.includes("boisson") || tag.includes("jus"))) {
    return "Boissons";
  }
  return "Plats";
}

export default function RestaurantPage() {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [distanceKm, setDistanceKm] = useState("3");
  const [storeQuery, setStoreQuery] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"nita" | "amana" | "cash_on_delivery">("nita");
  const [status, setStatus] = useState("");

  const { data: storefronts = [], isPending: isStorefrontsPending } = useQuery({
    queryKey: ["catalog-storefronts-restaurants", storeQuery],
    queryFn: () =>
      listStorefronts({
        query: storeQuery,
        activityType: "restaurant",
      }),
  });
  const { data: financeSettings } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });
  const deliveryFee = financeSettings?.default_delivery_fee ?? 1500;

  const { data: menu = [], isPending } = useQuery({
    queryKey: ["restaurant-menu", selectedVendorId],
    queryFn: () => listRestaurantMenu(selectedVendorId || undefined),
    enabled: Boolean(selectedVendorId),
  });
  const visibleStorefronts = useMemo(() => {
    const copy = [...storefronts];
    copy.sort((a, b) => Number(b.is_verified) - Number(a.is_verified));
    return copy;
  }, [storefronts]);
  const groupedMenu = useMemo(() => {
    const groups = new Map<string, RestaurantMenuItem[]>();
    for (const item of menu) {
      const group = resolveMenuCategory(item);
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [menu]);

  const orderMutation = useMutation({
    mutationFn: createRestaurantOrder,
    onSuccess: (order) => {
      setStatus(`Commande envoyee au restaurant ${order.vendor_name}. Livraison en cours de preparation.`);
      setSelectedItems([]);
    },
    onError: () => setStatus("Echec envoi commande. Verifie les champs et reconnecte-toi."),
  });

  const total = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const optionsTotal = item.selected_options.reduce((acc, option) => acc + option.price, 0);
        return sum + (item.base_price + optionsTotal) * item.quantity;
      }, 0),
    [selectedItems]
  );
  const orderTotal = useMemo(
    () => (selectedItems.length ? total + deliveryFee : total),
    [deliveryFee, selectedItems.length, total]
  );

  const addDish = (dish: RestaurantMenuItem) => {
    setSelectedItems((prev) => {
      if (!selectedVendorId) {
        setStatus("Selectionne d'abord un restaurant.");
        return prev;
      }
      if (prev.length && prev[0].vendor_id !== dish.vendor_id) {
        setStatus("Choisis des plats d'un seul restaurant a la fois.");
        return prev;
      }
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

  const setItemNote = (menuItemId: string, customerNote: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.menu_item_id === menuItemId ? { ...item, customer_note: customerNote } : item))
    );
  };

  const submitOrder = () => {
    if (!selectedItems.length) return;
    const vendorId = selectedItems[0].vendor_id;
    orderMutation.mutate({
      vendor_id: vendorId,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: deliveryAddress,
      distance_km: Number(distanceKm),
      payment_mode: paymentMode,
      items: selectedItems.map((item) => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        selected_options: item.selected_options,
        customer_note: item.customer_note.trim() || undefined,
      })),
    });
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-gradient-to-br from-white to-orange-50 p-6">
        <h1 className="luxury-title inline-flex items-center gap-2 text-3xl font-semibold">
          <ForkKnife className="h-7 w-7 text-[#FF4D00]" />
          AMAZER RESTAURANT
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Commande appetissante, paiement local et livraison express moto-coursier a Niamey.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700">
          <span className="rounded-full border border-[#FF4D00]/25 bg-[#FF4D00]/10 px-3 py-1 font-medium text-[#FF4D00]">
            Frais livraison unique: {formatXOF(deliveryFee)}
          </span>
        </div>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-xl font-semibold">Restaurants (rubrique boutiques)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Recherchez vos restaurants preferes et filtrez le menu par boutique.
        </p>
        <Input
          value={storeQuery}
          onChange={(event) => setStoreQuery(event.target.value)}
          placeholder="Rechercher une boutique restaurant..."
          className="mt-4"
        />
        {isStorefrontsPending ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <ProductCardSkeleton key={`restaurant-storefront-skeleton-${index}`} />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleStorefronts.slice(0, 12).map((store) => (
                <div key={store.id} className="space-y-3">
                  <StorefrontShowcaseCard store={store} ctaLabel="Voir" />
                  <Button
                    type="button"
                    onClick={() => {
                      setSelectedItems([]);
                      setSelectedVendorId(store.id);
                    }}
                    className={
                      selectedVendorId === store.id
                        ? "primary-glow-btn w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
                        : "w-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }
                  >
                    {selectedVendorId === store.id ? "Selectionne" : "Selectionner pour commander"}
                  </Button>
                </div>
              ))}
            </div>
            {!visibleStorefronts.length ? (
              <p className="mt-4 text-sm text-slate-500">Aucun restaurant trouve pour le moment.</p>
            ) : null}
          </>
        )}
      </article>

      {!selectedVendorId ? (
        <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Selectionne un restaurant ci-dessus pour afficher son menu.
        </article>
      ) : isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={`menu-skeleton-${index}`} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMenu.map(([category, items]) => (
            <section key={category} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="luxury-title text-xl font-semibold">{category}</h2>
                <p className="text-xs text-slate-500">{items.length} article(s)</p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((dish, index) => (
                  <article
                    key={dish.id}
                    className="premium-card overflow-hidden border border-slate-200 bg-white"
                  >
                    <div className="relative h-52 w-full">
                      <Image
                        src={
                          resolveImageUrl(dish.image_url) ||
                          dishImageFallbacks[index % dishImageFallbacks.length]
                        }
                        alt={dish.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-[#FF4D00]">{dish.vendor_name}</p>
                          <h2 className="text-lg font-semibold text-slate-900">{dish.name}</h2>
                        </div>
                        <p className="text-sm font-semibold text-[#FF4D00]">
                          {formatXOF(dish.base_price)}
                        </p>
                      </div>
                      {dish.description ? <p className="text-sm text-slate-600">{dish.description}</p> : null}

                      <div className="flex flex-wrap gap-2">
                        {(dish.tags.length ? dish.tags : ["Populaire"]).slice(0, 3).map((tag) => (
                          <motion.span
                            key={`${dish.id}-${tag}`}
                            initial={{ scale: 0.92, opacity: 0.7 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${badgeColor(
                              tag
                            )}`}
                          >
                            <Flame className="h-3 w-3" />
                            {tag}
                          </motion.span>
                        ))}
                      </div>

                      {dish.options.length ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                          <p className="text-xs font-medium text-slate-700">Options</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {dish.options.map((option) => (
                              <button
                                key={`${dish.id}-${option.name}`}
                                type="button"
                                onClick={() => toggleOption(dish.id, option)}
                                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                              >
                                {option.name} (+{formatXOF(option.price)})
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        onClick={() => addDish(dish)}
                        className="primary-glow-btn w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
                      >
                        Ajouter au panier repas
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-xl font-semibold">Commander maintenant</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nom complet" />
          <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Telephone" />
          <Input
            value={deliveryAddress}
            onChange={(event) => setDeliveryAddress(event.target.value)}
            placeholder="Adresse livraison"
            className="sm:col-span-2"
          />
          <Input value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} type="number" min="0.1" step="0.1" placeholder="Distance estimee (km)" />
          <div className="flex flex-wrap gap-2">
            {[
              { value: "nita", label: "Nita" },
              { value: "amana", label: "Amana" },
              { value: "cash_on_delivery", label: "Paiement livraison" },
            ].map((entry) => (
              <Button
                key={entry.value}
                type="button"
                onClick={() =>
                  setPaymentMode(entry.value as "nita" | "amana" | "cash_on_delivery")
                }
                className={
                  paymentMode === entry.value
                    ? "border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                    : "border border-slate-200 bg-white text-slate-700"
                }
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
          <p className="mt-1">Frais de livraison: {formatXOF(deliveryFee)}</p>
          <p className="mt-1">Total panier repas: {formatXOF(total)}</p>
          <p className="mt-1 font-medium">Total a payer: {formatXOF(orderTotal)}</p>
          <p className="mt-1">Articles: {selectedItems.length}</p>
        </div>

        {selectedItems.length ? (
          <div className="mt-4 space-y-3">
            {selectedItems.map((item) => (
              <div key={item.menu_item_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.name} x{item.quantity}
                  </p>
                  <p className="text-sm font-semibold text-[#FF4D00]">{formatXOF(item.base_price * item.quantity)}</p>
                </div>
                <textarea
                  value={item.customer_note}
                  onChange={(event) => setItemNote(item.menu_item_id, event.target.value)}
                  className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  placeholder='Note cuisine ou livraison, ex: "Pas de piment"'
                />
              </div>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          disabled={orderMutation.isPending || !selectedItems.length}
          onClick={submitOrder}
          className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
        >
          {orderMutation.isPending ? "Envoi en cours..." : "Commander maintenant"}
        </Button>

        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}
