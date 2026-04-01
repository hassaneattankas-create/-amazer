"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Clock3, UtensilsCrossed } from "lucide-react";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { PasswordInput } from "@/components/PasswordInput";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import { resolveImageUrl } from "@/lib/image";
import { deleteMyAccount } from "@/services/auth-service";
import {
  createRestaurantMenuItem,
  listSellerRestaurantOrders,
  updateSellerRestaurantOrderStatus,
} from "@/services/restaurant-service";
import { getSellerProfile, listSellerInventory, updateSellerInventory } from "@/services/seller-service";

export default function SellerDashboardPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
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
  const { data: inventory = [], isPending } = useQuery({
    queryKey: ["seller-inventory"],
    queryFn: listSellerInventory,
    enabled: showProductTools,
  });
  const { data: restaurantOrders = [] } = useQuery({
    queryKey: ["seller-restaurant-orders"],
    queryFn: listSellerRestaurantOrders,
    enabled: showRestaurantTools,
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: ({
      priceId,
      amount,
      stock,
      is_active,
      promo_amount,
      boost_duration_hours,
    }: {
      priceId: string;
      amount: number;
      stock: number;
      is_active?: boolean;
      promo_amount?: number;
      boost_duration_hours?: 24 | 168;
    }) =>
      updateSellerInventory(priceId, {
        amount,
        stock_quantity: stock,
        is_active,
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
  const deleteAccountMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      setDeleteStatus("Compte supprime avec succes. Redirection...");
      window.location.assign("/login");
    },
    onError: (error) => {
      setDeleteStatus(getApiErrorMessage(error, "Suppression impossible. Verifie le mot de passe."));
    },
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
  const normalizeImageInput = (raw: string): string | undefined => resolveImageUrl(raw) ?? undefined;
  const dashboardTitle =
    sellerMode === "restaurant"
      ? "Mon Restaurant AMAZER"
      : sellerMode === "enterprise"
        ? "Mon Premium AMAZER"
        : "Ma Boutique AMAZER";
  const dashboardDescription =
    sellerMode === "restaurant"
      ? "Dashboard restaurant: gere tes plats, boissons et commandes."
      : sellerMode === "enterprise"
        ? "Dashboard premium: produits, plats, boissons, commandes et outils avances dans un seul espace."
        : "Dashboard boutique: gere uniquement tes articles, prix, stock et boosts.";

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">{dashboardTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {dashboardDescription}
        </p>
      </header>

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
          Publier au menu
        </Button>
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
      ) : null}

      {showProductTools && (isPending || isProfilePending) ? (
        <ProductCardSkeleton />
      ) : null}

      {showProductTools && !isPending && !isProfilePending ? (
        <div className="space-y-3">
          <article className="premium-card border border-slate-200 bg-white p-6">
            <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
              <Boxes className="h-5 w-5 text-[#FF4D00]" />
              {sellerMode === "enterprise" ? "Catalogue produits" : "Articles boutique"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {sellerMode === "enterprise"
                ? "Espace premium: gere ton catalogue produits en plus du menu restaurant."
                : "Espace boutique: ici tu geres seulement tes produits, prix, stock et boosts."}
            </p>
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
      ) : null}

      {!showProductTools && !showRestaurantTools && !isProfilePending ? (
        <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Complete d'abord ton profil vendeur pour activer le bon dashboard.
        </article>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

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
