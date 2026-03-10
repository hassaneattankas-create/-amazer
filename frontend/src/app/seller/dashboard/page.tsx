"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Clock3, UtensilsCrossed } from "lucide-react";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveImageUrl } from "@/lib/image";
import {
  createRestaurantMenuItem,
  listSellerRestaurantOrders,
  updateSellerRestaurantOrderStatus,
} from "@/services/restaurant-service";
import { listSellerInventory, updateSellerInventory } from "@/services/seller-service";

export default function SellerDashboardPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [dishForm, setDishForm] = useState({
    name: "",
    description: "",
    image_url: "",
    base_price: "",
    prep: "20",
    tags: "Chaud,Populaire",
    options: "Boisson:500,Sauce pimentee:250",
  });
  const { data: inventory = [], isPending } = useQuery({
    queryKey: ["seller-inventory"],
    queryFn: listSellerInventory,
  });
  const { data: restaurantOrders = [] } = useQuery({
    queryKey: ["seller-restaurant-orders"],
    queryFn: listSellerRestaurantOrders,
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: ({
      priceId,
      amount,
      stock,
      promo_amount,
      boost_duration_hours,
    }: {
      priceId: string;
      amount: number;
      stock: number;
      promo_amount?: number;
      boost_duration_hours?: 24 | 168;
    }) =>
      updateSellerInventory(priceId, {
        amount,
        stock_quantity: stock,
        promo_amount,
        boost_duration_hours,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-inventory"] });
      setStatus("Stock mis a jour.");
    },
    onError: () => setStatus("Erreur mise a jour stock."),
  });
  const dishMutation = useMutation({
    mutationFn: createRestaurantMenuItem,
    onSuccess: () => {
      setStatus("Plat restaurant publie.");
      setDishForm((prev) => ({ ...prev, name: "", description: "", image_url: "", base_price: "" }));
    },
    onError: () => setStatus("Erreur publication du plat."),
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
      queryClient.invalidateQueries({ queryKey: ["seller-restaurant-orders"] });
    },
  });

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
  const normalizeImageInput = (raw: string): string | undefined => resolveImageUrl(raw) ?? undefined;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Seller Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">Gestion des stocks et prix pour les marchands.</p>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
          <UtensilsCrossed className="h-5 w-5 text-[#FF4D00]" />
          Ajouter un plat restaurant
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            value={dishForm.name}
            onChange={(event) => setDishForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nom du plat (Riz Sauce, Poulet Grille...)"
          />
          <Input
            value={dishForm.base_price}
            onChange={(event) => setDishForm((prev) => ({ ...prev, base_price: event.target.value }))}
            placeholder="Prix de base XOF"
            type="number"
          />
          <Input
            value={dishForm.description}
            onChange={(event) =>
              setDishForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Description"
          />
          <Input
            value={dishForm.image_url}
            onChange={(event) => setDishForm((prev) => ({ ...prev, image_url: event.target.value }))}
            placeholder="URL photo plat"
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
          Publier le plat
        </Button>
      </article>

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
              <AnimatedPrice value={order.total_amount} className="mt-2 text-base font-semibold text-[#FF4D00]" />
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

      {isPending ? (
        <ProductCardSkeleton />
      ) : (
        <div className="space-y-3">
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
                  <Input
                    type="number"
                    min={0}
                    defaultValue={item.amount}
                    className="w-28"
                    id={`amount-${item.price_id}`}
                  />
                  <Input
                    type="number"
                    min={0}
                    defaultValue={item.stock_quantity}
                    className="w-24"
                    id={`stock-${item.price_id}`}
                  />
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
                      const amountInput = document.getElementById(
                        `amount-${item.price_id}`
                      ) as HTMLInputElement | null;
                      const stockInput = document.getElementById(
                        `stock-${item.price_id}`
                      ) as HTMLInputElement | null;
                      const promoInput = document.getElementById(
                        `promo-${item.price_id}`
                      ) as HTMLInputElement | null;
                      const promoValue = Number(promoInput?.value ?? 0);
                      mutation.mutate({
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
                      mutation.mutate({
                        priceId: item.price_id,
                        amount: item.amount,
                        stock: item.stock_quantity,
                        is_active: !item.is_active,
                      })
                    }
                  >
                    {item.is_active ? "Retirer" : "Re-publier"}
                  </Button>
                  <Button
                    className="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    onClick={() =>
                      mutation.mutate({
                        priceId: item.price_id,
                        amount: item.amount,
                        stock: item.stock_quantity,
                        boost_duration_hours: 24,
                      })
                    }
                  >
                    Boost 24h
                  </Button>
                  <Button
                    className="border border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200"
                    onClick={() =>
                      mutation.mutate({
                        priceId: item.price_id,
                        amount: item.amount,
                        stock: item.stock_quantity,
                        boost_duration_hours: 168,
                      })
                    }
                  >
                    Boost 7j
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {item.is_boosted ? "Boost actif" : "Boost inactif"}
                {item.boost_until ? ` jusqu au ${new Date(item.boost_until).toLocaleString("fr-FR")}` : ""}
                {item.promo_price ? ` | Promo: ${item.promo_price.toFixed(0)} XOF` : ""}
              </p>
            </article>
          ))}
          {!inventory.length ? (
            <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Aucun article dans votre inventaire.
            </article>
          ) : null}
        </div>
      )}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
