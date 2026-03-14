"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Circle, ImageUp, PlusCircle, UtensilsCrossed } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { persistAppMode } from "@/lib/session-mode";
import { listCatalogCategories } from "@/services/catalog-service";
import { uploadMedia } from "@/services/media-service";
import { createRestaurantMenuItem, listRestaurantMenu } from "@/services/restaurant-service";
import {
  createSellerProduct,
  getSellerProfile,
  listSellerInventory,
  upsertSellerProfile,
} from "@/services/seller-service";
import { useAuthStore } from "@/store/auth-store";

const SELLER_PROFILE_DRAFT_KEY = "amazer_seller_profile_draft";
const SELLER_PRODUCT_DRAFT_KEY = "amazer_seller_product_draft";
const SELLER_RESTAURANT_DRAFT_KEY = "amazer_seller_restaurant_draft";

function splitListInput(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseServices(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [title, description = "", displayMode = "consult_only"] = entry
        .split("|")
        .map((part) => part.trim());
      return {
        title,
        description: description || null,
        display_mode: (displayMode || "consult_only") as
          | "consult_only"
          | "book_only"
          | "shop",
      };
    })
    .filter((entry) => entry.title);
}

function parseRoomTypes(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [
        name,
        priceText = "0",
        capacityText = "1",
        amenitiesText = "",
        depositText = "",
      ] = entry.split("|").map((part) => part.trim());
      return {
        id: `room-${index + 1}`,
        name,
        description: null,
        night_price: Number(priceText || 0),
        capacity: Number(capacityText || 1),
        amenities: splitListInput(amenitiesText),
        photo_urls: [],
        deposit_amount: depositText ? Number(depositText) : null,
      };
    })
    .filter((entry) => entry.name && entry.night_price > 0);
}

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
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending: isAuthPending } = useCurrentUser();
  const queryClient = useQueryClient();
  const setAppMode = useAuthStore((state) => state.setAppMode);
  const [status, setStatus] = useState("");
  const [profileHydratedFromServer, setProfileHydratedFromServer] = useState(false);

  const [profileForm, setProfileForm] = useState(() => {
    const draft = loadDraft(SELLER_PROFILE_DRAFT_KEY, {
      business_name: "",
      city: "Niamey",
      phone: "",
      address: "",
      activity_type: "shop" as "shop" | "restaurant" | "hotel",
      storefront_tier: "basic" as "basic" | "premium",
      description: "",
      logo_url: "",
      cover_image_url: "",
      opening_hours: "",
      whatsapp_contact: "",
      contact_email: "",
      gallery_images_text: "",
      service_offerings_text: "",
      room_types_text: "",
      deposit_payment_method: "nita" as "nita" | "amana",
      deposit_amount: "",
      accepts_table_reservations: false,
      accepts_hotel_bookings: false,
    });
    const normalizedActivity = draft.activity_type === "enterprise" ? "hotel" : draft.activity_type;
    return {
      ...draft,
      activity_type: normalizedActivity,
      storefront_tier: normalizedActivity === "hotel" ? "premium" : "basic",
    };
  });
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
  const { data: inventory = [] } = useQuery({
    queryKey: ["seller-inventory", profile?.vendor_id],
    queryFn: listSellerInventory,
    enabled: Boolean(profile?.vendor_id),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: listCatalogCategories,
  });

  useEffect(() => {
    if (isAuthPending) {
      return;
    }
    if (!user) {
      const next = encodeURIComponent(pathname || "/seller");
      router.replace(`/login?next=${next}`);
    }
  }, [isAuthPending, pathname, router, user]);

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
      activity_type:
        prev.activity_type ||
        (profile.activity_type === "enterprise" ? "hotel" : profile.activity_type) ||
        "shop",
      storefront_tier:
        prev.storefront_tier ||
        (profile.activity_type === "hotel" || profile.activity_type === "enterprise"
          ? "premium"
          : profile.storefront_tier) ||
        "basic",
      description: prev.description || profile.description || "",
      logo_url: prev.logo_url || profile.logo_url || "",
      cover_image_url: prev.cover_image_url || profile.cover_image_url || "",
      opening_hours: prev.opening_hours || profile.opening_hours || "",
      whatsapp_contact: prev.whatsapp_contact || profile.whatsapp_contact || "",
      contact_email: prev.contact_email || profile.contact_email || "",
      gallery_images_text:
        prev.gallery_images_text || (profile.gallery_images || []).join("\n") || "",
      service_offerings_text:
        prev.service_offerings_text ||
        (profile.service_offerings || [])
          .map((item) => [item.title, item.description || "", item.display_mode].join(" | "))
          .join("\n"),
      room_types_text:
        prev.room_types_text ||
        (profile.room_types || [])
          .map((room) =>
            [
              room.name,
              String(room.night_price),
              String(room.capacity),
              (room.amenities || []).join(", "),
              room.deposit_amount ? String(room.deposit_amount) : "",
            ].join(" | "),
          )
          .join("\n"),
      deposit_payment_method:
        prev.deposit_payment_method || profile.deposit_payment_method || "nita",
      deposit_amount:
        prev.deposit_amount || (profile.deposit_amount ? String(profile.deposit_amount) : ""),
      accepts_table_reservations:
        prev.accepts_table_reservations || profile.accepts_table_reservations || false,
      accepts_hotel_bookings:
        prev.accepts_hotel_bookings || profile.accepts_hotel_bookings || false,
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
  const isShop = profileForm.activity_type === "shop";
  const isRestaurant = profileForm.activity_type === "restaurant";
  const isPremium = profileForm.activity_type === "hotel";
  const showRestaurantSection = isRestaurant || isPremium;
  const showProductSection = isShop || isPremium;
  const hasProfile = Boolean(profile?.id);
  const hasProducts = inventory.length > 0;
  const hasMenu = restaurantItems.length > 0;
  const hasPremiumConfig =
    Boolean(profile?.gallery_images?.length) ||
    Boolean(profile?.service_offerings?.length) ||
    Boolean(profile?.room_types?.length);
  const nextStep = !hasProfile
    ? "Complete ton profil vendeur."
    : isShop
      ? hasProducts
        ? "Publie un deuxième produit ou booste ta boutique."
        : "Publie ton premier produit."
      : isRestaurant
        ? hasMenu
          ? "Active les reservations de table si besoin."
          : "Publie ton premier plat."
        : hasPremiumConfig
          ? "Ajoute une offre ou mets en avant tes services."
          : "Configure services, galerie et chambres premium.";

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Espace vendeur</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choisis ton profil vendeur (boutique, restaurant ou premium) puis publie tes offres.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/seller/dashboard">Aller au dashboard de stock</Link>
        </Button>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Assistant d&apos;inscription vendeur</h2>
        <p className="mt-1 text-sm text-slate-600">
          Experience type Shopify, sans connexion Shopify. Suis ces etapes pour activer ta boutique.
        </p>
        <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            {hasProfile ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 text-slate-400" />
            )}
            <span>1. Enregistre ton profil vendeur.</span>
          </div>
          {showProductSection ? (
            <div className="flex items-start gap-2">
              {hasProducts ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-slate-400" />
              )}
              <span>2. Publie au moins un produit.</span>
            </div>
          ) : null}
          {showRestaurantSection ? (
            <div className="flex items-start gap-2">
              {hasMenu ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-slate-400" />
              )}
              <span>3. Ajoute un menu restaurant.</span>
            </div>
          ) : null}
          {isPremium ? (
            <div className="flex items-start gap-2">
              {hasPremiumConfig ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-slate-400" />
              )}
              <span>4. Configure services, galerie et chambres.</span>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-sm font-medium text-[#FF4D00]">Prochaine action: {nextStep}</p>
      </article>

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
          <p className="mt-3 text-sm text-slate-600">
            Boutique: publier des produits. Restaurant: menu digital et reservations. Premium: mini-site complet
            (services, chambres, paiement avec acompte).
          </p>
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
            <select
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
              value={profileForm.activity_type}
              onChange={(event) => {
                const activityType = event.target.value as "shop" | "restaurant" | "hotel";
                setProfileForm((prev) => ({
                  ...prev,
                  activity_type: activityType,
                  storefront_tier: activityType === "hotel" ? "premium" : "basic",
                }));
              }}
            >
              <option value="shop">Boutique (produits)</option>
              <option value="restaurant">Restaurant (menu)</option>
              <option value="hotel">Premium (mini-site)</option>
            </select>
            <div className="space-y-2">
              <Input
                placeholder="Logo URL"
                value={profileForm.logo_url}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, logo_url: event.target.value }))}
              />
              <MediaUploader
                label="Uploader logo"
                onUploaded={(url) => setProfileForm((prev) => ({ ...prev, logo_url: url }))}
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Cover URL"
                value={profileForm.cover_image_url}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, cover_image_url: event.target.value }))
                }
              />
              <MediaUploader
                label="Uploader couverture"
                onUploaded={(url) => setProfileForm((prev) => ({ ...prev, cover_image_url: url }))}
              />
            </div>
            <Input
              placeholder="Horaires"
              value={profileForm.opening_hours}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, opening_hours: event.target.value }))
              }
            />
            <Input
              placeholder="WhatsApp contact"
              value={profileForm.whatsapp_contact}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, whatsapp_contact: event.target.value }))
              }
            />
            <Input
              placeholder="Email contact"
              value={profileForm.contact_email}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, contact_email: event.target.value }))
              }
            />
            {isPremium ? (
              <Input
                placeholder="Acompte XOF"
                type="number"
                value={profileForm.deposit_amount}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, deposit_amount: event.target.value }))
                }
              />
            ) : null}
            {isPremium ? (
              <select
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
                value={profileForm.deposit_payment_method}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    deposit_payment_method: event.target.value as "nita" | "amana",
                  }))
                }
              >
                <option value="nita">Nita</option>
                <option value="amana">Amana</option>
              </select>
            ) : null}
            {showRestaurantSection ? (
              <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={profileForm.accepts_table_reservations}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        accepts_table_reservations: event.target.checked,
                      }))
                    }
                  />
                  Activer reservation de table
                </label>
                {isPremium ? (
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profileForm.accepts_hotel_bookings}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          accepts_hotel_bookings: event.target.checked,
                        }))
                      }
                    />
                    Activer reservation premium
                  </label>
                ) : null}
              </div>
            ) : null}
            <textarea
              placeholder="Description boutique"
              value={profileForm.description}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            {isPremium ? (
              <textarea
                placeholder="Galerie photos: une URL par ligne"
                value={profileForm.gallery_images_text}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, gallery_images_text: event.target.value }))
                }
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            ) : null}
            {isPremium ? (
              <textarea
                placeholder="Services: titre | description | consult_only"
                value={profileForm.service_offerings_text}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, service_offerings_text: event.target.value }))
                }
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            ) : null}
            {isPremium ? (
              <textarea
                placeholder="Chambres: nom | prix | capacite | amenites | acompte"
                value={profileForm.room_types_text}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, room_types_text: event.target.value }))
                }
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
            ) : null}
          </div>
          <Button
            className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
            onClick={() =>
              profileMutation.mutate({
                business_name: profileForm.business_name,
                city: profileForm.city,
                phone: profileForm.phone || undefined,
                address: profileForm.address || undefined,
                activity_type: profileForm.activity_type,
                storefront_tier: profileForm.storefront_tier,
                description: profileForm.description || undefined,
                logo_url: normalizeImageInput(profileForm.logo_url),
                cover_image_url: normalizeImageInput(profileForm.cover_image_url),
                opening_hours: profileForm.opening_hours || undefined,
                whatsapp_contact: profileForm.whatsapp_contact || undefined,
                contact_email: profileForm.contact_email || undefined,
                gallery_images: isPremium ? splitListInput(profileForm.gallery_images_text) : [],
                service_offerings: isPremium ? parseServices(profileForm.service_offerings_text) : [],
                room_types: isPremium ? parseRoomTypes(profileForm.room_types_text) : [],
                deposit_payment_method: isPremium ? profileForm.deposit_payment_method : undefined,
                deposit_amount: isPremium
                  ? profileForm.deposit_amount
                    ? Number(profileForm.deposit_amount)
                    : undefined
                  : undefined,
                accepts_table_reservations: showRestaurantSection
                  ? profileForm.accepts_table_reservations
                  : false,
                accepts_hotel_bookings: isPremium ? profileForm.accepts_hotel_bookings : false,
              })
            }
          >
            Enregistrer le profil
          </Button>
        </article>
      )}

      {showProductSection ? (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <PlusCircle className="h-5 w-5 text-[#FF4D00]" />
            Boutique produits
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Publiez vos articles avec une experience type Shopify, sans connexion Shopify.
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
            <div className="space-y-2">
              <Input
                placeholder="Image URL"
                value={productForm.main_image_url}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, main_image_url: event.target.value }))
                }
              />
              <MediaUploader
                label="Uploader image produit"
                onUploaded={(url) => setProductForm((prev) => ({ ...prev, main_image_url: url }))}
              />
            </div>
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
      ) : null}

      {showRestaurantSection ? (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <UtensilsCrossed className="h-5 w-5 text-[#FF4D00]" />
            Menu restaurant
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
            <div className="space-y-2">
              <Input
                placeholder="Image URL"
                value={restaurantForm.image_url}
                onChange={(event) => setRestaurantForm((prev) => ({ ...prev, image_url: event.target.value }))}
              />
              <MediaUploader
                label="Uploader image plat"
                onUploaded={(url) => setRestaurantForm((prev) => ({ ...prev, image_url: url }))}
              />
            </div>
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
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}

type MediaUploaderProps = {
  label: string;
  onUploaded: (url: string) => void;
};

function MediaUploader({ label, onUploaded }: MediaUploaderProps) {
  const inputId = useId();
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setStatus("");
    setIsUploading(true);
    try {
      const response = await uploadMedia(file);
      onUploaded(response.url);
      setStatus("Upload termine.");
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Erreur lors de l'upload."));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
      >
        <ImageUp className="h-3.5 w-3.5 text-[#FF4D00]" />
        {isUploading ? "Upload..." : label}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="text-xs text-slate-500"
      />
      {status ? <span className="text-slate-500">{status}</span> : null}
    </div>
  );
}
