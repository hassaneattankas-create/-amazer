"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, PlusCircle, UtensilsCrossed } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { persistAppMode } from "@/lib/session-mode";
import { listCatalogCategories } from "@/services/catalog-service";
import { createRestaurantMenuItem, listRestaurantMenu } from "@/services/restaurant-service";
import { createSellerProduct, getSellerProfile, upsertSellerProfile } from "@/services/seller-service";
import { useAuthStore } from "@/store/auth-store";

const SELLER_PROFILE_DRAFT_KEY = "amazer_seller_profile_draft";
const SELLER_PRODUCT_DRAFT_KEY = "amazer_seller_product_draft";
const SELLER_RESTAURANT_DRAFT_KEY = "amazer_seller_restaurant_draft";

function loadDraft<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

export default function SellerPage() {
  const queryClient = useQueryClient();
  const setAppMode = useAuthStore((state) => state.setAppMode);
  const [status, setStatus] = useState("");
  const [profileHydratedFromServer, setProfileHydratedFromServer] = useState(false);

  const [profileForm, setProfileForm] = useState(() =>
    loadDraft(SELLER_PROFILE_DRAFT_KEY, {
      business_name: "",
      city: "Niamey",
      phone: "",
      address: "",
    })
  );
  const [productForm, setProductForm] = useState(() =>
    loadDraft(SELLER_PRODUCT_DRAFT_KEY, {
      name: "",
      brand: "",
      category_id: "",
      amount: "",
      stock_quantity: "1",
      description: "",
      main_image_url: "",
    })
  );
  const [restaurantForm, setRestaurantForm] = useState(() =>
    loadDraft(SELLER_RESTAURANT_DRAFT_KEY, {
      name: "",
      description: "",
      image_url: "",
      base_price: "",
      estimated_prep_minutes: "20",
      category: "plat" as "plat" | "boisson",
      is_plat_du_jour: false,
    })
  );

  useEffect(() => {
    setAppMode("seller");
    persistAppMode("seller");
  }, [setAppMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELLER_PROFILE_DRAFT_KEY, JSON.stringify(profileForm));
    }
  }, [profileForm]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELLER_PRODUCT_DRAFT_KEY, JSON.stringify(productForm));
    }
  }, [productForm]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELLER_RESTAURANT_DRAFT_KEY, JSON.stringify(restaurantForm));
    }
  }, [restaurantForm]);

  const { data: profile, isPending } = useQuery({
    queryKey: ["seller-profile"],
    queryFn: getSellerProfile,
  });
  const { data: restaurantItems = [] } = useQuery({
    queryKey: ["seller-restaurant-menu", profile?.vendor_id],
    queryFn: () => listRestaurantMenu(profile?.vendor_id),
    enabled: Boolean(profile?.vendor_id),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: listCatalogCategories,
  });

  useEffect(() => {
    if (!profile || profileHydratedFromServer) {
      return;
    }
    setProfileForm((prev) => ({
      ...prev,
      business_name: prev.business_name || profile.business_name || "",
      city: prev.city || profile.city || "Niamey",
      phone: prev.phone || profile.phone || "",
      address: prev.address || profile.address || "",
    }));
    setProfileHydratedFromServer(true);
  }, [profile, profileHydratedFromServer]);

  const profileMutation = useMutation({
    mutationFn: upsertSellerProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setStatus("Profil vendeur enregistre.");
    },
    onError: () => setStatus("Erreur lors de l'enregistrement du profil."),
  });

  const productMutation = useMutation({
    mutationFn: createSellerProduct,
    onSuccess: () => setStatus("Produit liste avec succes."),
    onError: () => setStatus("Erreur lors de la creation du produit."),
  });

  const restaurantMutation = useMutation({
    mutationFn: createRestaurantMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-restaurant-menu", profile?.vendor_id] });
      setStatus("Article restaurant publie avec succes.");
      setRestaurantForm({
        name: "",
        description: "",
        image_url: "",
        base_price: "",
        estimated_prep_minutes: "20",
        category: "plat",
        is_plat_du_jour: false,
      });
    },
    onError: () => setStatus("Erreur lors de la publication de l'article restaurant."),
  });

  const normalizeImageInput = (raw: string): string | undefined => resolveImageUrl(raw) ?? undefined;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Seller Central Niamey</h1>
        <p className="mt-2 text-sm text-slate-600">
          Interface commercants pour publier des offres locales. Vos brouillons restent sauvegardes.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/seller/dashboard">Aller au dashboard de stock</Link>
        </Button>
      </header>

      {isPending ? (
        <ProductCardSkeleton />
      ) : (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Building2 className="h-5 w-5 text-[#FF4D00]" />
            Profil vendeur
          </h2>
          {profile ? (
            <p className="mt-2 text-sm text-emerald-700">
              Profil actif immediatement: {profile.business_name} ({profile.city}) -{" "}
              {profile.is_verified ? "Badge Confiance actif" : "Boutique operationnelle"}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Aucun profil actif pour ce compte.</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nom du commerce"
              value={profileForm.business_name}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, business_name: event.target.value }))
              }
            />
            <Input
              placeholder="Ville"
              value={profileForm.city}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, city: event.target.value }))}
            />
            <Input
              placeholder="Telephone"
              value={profileForm.phone}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <Input
              placeholder="Adresse"
              value={profileForm.address}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </div>
          <Button
            className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
            onClick={() => profileMutation.mutate(profileForm)}
          >
            Enregistrer le profil
          </Button>
        </article>
      )}

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
          <PlusCircle className="h-5 w-5 text-[#FF4D00]" />
          Lister un produit
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Le prix de vos produits est defini par vous. AMAZER applique uniquement sa commission/frais au checkout.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nom produit"
            value={productForm.name}
            onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            placeholder="Marque"
            value={productForm.brand}
            onChange={(event) => setProductForm((prev) => ({ ...prev, brand: event.target.value }))}
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
            placeholder="Prix XOF"
            type="number"
            value={productForm.amount}
            onChange={(event) => setProductForm((prev) => ({ ...prev, amount: event.target.value }))}
          />
          <Input
            placeholder="Stock"
            type="number"
            value={productForm.stock_quantity}
            onChange={(event) =>
              setProductForm((prev) => ({ ...prev, stock_quantity: event.target.value }))
            }
          />
          <Input
            placeholder="Image URL"
            value={productForm.main_image_url}
            onChange={(event) =>
              setProductForm((prev) => ({ ...prev, main_image_url: event.target.value }))
            }
          />
          <Input
            placeholder="Description"
            value={productForm.description}
            onChange={(event) =>
              setProductForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </div>
        <Button
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
          Publier mon produit
        </Button>
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
          <UtensilsCrossed className="h-5 w-5 text-[#FF4D00]" />
          Boutique Restaurant (Plats et Boissons)
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Ajoutez vos plats, boissons, prix et marquez vos offres en "Plat du Jour".
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nom (ex: Shawarma Poulet / Jus d'ananas)"
            value={restaurantForm.name}
            onChange={(event) => setRestaurantForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            placeholder="Prix XOF"
            type="number"
            value={restaurantForm.base_price}
            onChange={(event) => setRestaurantForm((prev) => ({ ...prev, base_price: event.target.value }))}
          />
          <Input
            placeholder="Description"
            value={restaurantForm.description}
            onChange={(event) => setRestaurantForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <Input
            placeholder="Image URL"
            value={restaurantForm.image_url}
            onChange={(event) => setRestaurantForm((prev) => ({ ...prev, image_url: event.target.value }))}
          />
          <Input
            placeholder="Temps de preparation (minutes)"
            type="number"
            value={restaurantForm.estimated_prep_minutes}
            onChange={(event) =>
              setRestaurantForm((prev) => ({ ...prev, estimated_prep_minutes: event.target.value }))
            }
          />
          <select
            value={restaurantForm.category}
            onChange={(event) =>
              setRestaurantForm((prev) => ({ ...prev, category: event.target.value as "plat" | "boisson" }))
            }
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          >
            <option value="plat">Plat</option>
            <option value="boisson">Boisson</option>
          </select>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={restaurantForm.is_plat_du_jour}
            onChange={(event) =>
              setRestaurantForm((prev) => ({ ...prev, is_plat_du_jour: event.target.checked }))
            }
          />
          Marquer comme Plat du Jour
        </label>

        <Button
          className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
          onClick={() => {
            const tags = [restaurantForm.category === "boisson" ? "Boisson" : "Plat"];
            if (restaurantForm.is_plat_du_jour) {
              tags.push("Plat du Jour");
            }
            restaurantMutation.mutate({
              name: restaurantForm.name,
              description: restaurantForm.description || undefined,
              image_url: normalizeImageInput(restaurantForm.image_url),
              base_price: Number(restaurantForm.base_price || 0),
              currency: "XOF",
              estimated_prep_minutes: Number(restaurantForm.estimated_prep_minutes || 20),
              tags,
              options: [],
            });
          }}
        >
          Publier article restaurant
        </Button>

        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-slate-800">Articles deja publies</p>
          {restaurantItems.length ? (
            restaurantItems.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.tags.join(" - ") || "Sans tag"}</p>
                </div>
                <p className="font-semibold text-[#FF4D00]">{formatXOF(item.base_price)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucun article restaurant pour le moment.</p>
          )}
        </div>
      </article>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
