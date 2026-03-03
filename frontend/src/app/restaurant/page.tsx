"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, ForkKnife, Sparkles } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import { createRestaurantOrder, listRestaurantMenu } from "@/services/restaurant-service";
import { RestaurantMenuItem, RestaurantMenuOption } from "@/types/restaurant";

type SelectedItem = {
  menu_item_id: string;
  vendor_id: string;
  name: string;
  quantity: number;
  base_price: number;
  selected_options: RestaurantMenuOption[];
};

const dishImageFallbacks = [
  "https://images.unsplash.com/photo-1604908176997-431eb4ed4d5f?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80",
];

function badgeColor(tag: string): string {
  if (tag.toLowerCase() === "chaud") return "bg-rose-100 text-rose-700 border-rose-200";
  if (tag.toLowerCase() === "populaire") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

export default function RestaurantPage() {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [distanceKm, setDistanceKm] = useState("3");
  const [paymentMode, setPaymentMode] = useState<"nita" | "amana" | "cash_on_delivery">("nita");
  const [status, setStatus] = useState("");

  const { data: menu = [], isPending } = useQuery({
    queryKey: ["restaurant-menu"],
    queryFn: () => listRestaurantMenu(),
  });

  const orderMutation = useMutation({
    mutationFn: createRestaurantOrder,
    onSuccess: (order) => {
      setStatus(
        `Commande envoyee au restaurant ${order.vendor_name}. Livraison estimee: ${order.delivery_minutes} min.`
      );
      setSelectedItems([]);
    },
    onError: () => setStatus("Echec envoi commande. Verifie les champs et reconnecte-toi."),
  });

  const estimatedMinutes = useMemo(() => {
    const km = Number(distanceKm || 0);
    return Math.max(12, Math.round(8 + km * 4.5 + 20));
  }, [distanceKm]);

  const total = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const optionsTotal = item.selected_options.reduce((acc, option) => acc + option.price, 0);
        return sum + (item.base_price + optionsTotal) * item.quantity;
      }, 0),
    [selectedItems]
  );

  const addDish = (dish: RestaurantMenuItem) => {
    setSelectedItems((prev) => {
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
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={`menu-skeleton-${index}`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {menu.map((dish, index) => (
            <article
              key={dish.id}
              className="premium-card overflow-hidden border border-slate-200 bg-white"
            >
              <div className="relative h-52 w-full">
                <Image
                  src={dish.image_url || dishImageFallbacks[index % dishImageFallbacks.length]}
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
                  <p className="text-sm font-semibold text-[#FF4D00]">{formatXOF(dish.base_price)}</p>
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
          <p className="inline-flex items-center gap-1 font-medium">
            <Sparkles className="h-4 w-4 text-amber-600" />
            Livraison Express Niamey estimee: {estimatedMinutes} min
          </p>
          <p className="mt-1">Total panier repas: {formatXOF(total)}</p>
          <p className="mt-1">Articles: {selectedItems.length}</p>
        </div>

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
