"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  PenSquare,
  PlusCircle,
  UtensilsCrossed,
} from "lucide-react";

import { GalleryMediaField, SingleMediaField } from "@/components/seller/MediaFields";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { normalizeImageInputForApi } from "@/lib/image";
import { persistAppMode } from "@/lib/session-mode";
import { listCatalogCategories } from "@/services/catalog-service";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { createRestaurantMenuItem, listRestaurantMenu } from "@/services/restaurant-service";
import {
  createSellerProduct,
  getSellerProfile,
  listSellerSubscriptionPaymentRequests,
  getSellerSubscriptionStatus,
  listSellerInventory,
  paySellerSubscription,
  upsertSellerProfile,
} from "@/services/seller-service";
import { useAuthStore } from "@/store/auth-store";
import type { SellerProfile, StorefrontTier } from "@/types/seller";

const SELLER_PROFILE_DRAFT_KEY = "amazer_seller_profile_draft";
const SELLER_PRODUCT_DRAFT_KEY = "amazer_seller_product_draft";
const SELLER_RESTAURANT_DRAFT_KEY = "amazer_seller_restaurant_draft";

function splitListInput(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeImageList(values: string[]): string {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join("\n");
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

function normalizeSellerActivityType(
  value: string | null | undefined,
): "shop" | "restaurant" | "enterprise" {
  if (value === "restaurant") {
    return "restaurant";
  }
  if (value === "enterprise" || value === "hotel") {
    return "enterprise";
  }
  return "shop";
}

function resolveGlobalSubscriptionFeeByType(
  finance:
    | {
        seller_subscription_fee_shop: number;
        seller_subscription_fee_restaurant: number;
        seller_subscription_fee_premium: number;
      }
    | null
    | undefined,
  activityType: "shop" | "restaurant" | "enterprise" | "hotel",
): number {
  if (!finance) {
    return 0;
  }
  if (activityType === "restaurant") {
    return finance.seller_subscription_fee_restaurant ?? 0;
  }
  if (activityType === "enterprise" || activityType === "hotel") {
    return finance.seller_subscription_fee_premium ?? 0;
  }
  return finance.seller_subscription_fee_shop ?? 0;
}

function resolveSellerPlanBucket(
  activityType: string | null | undefined,
  storefrontTier: string | null | undefined,
): "shop" | "restaurant" | "premium" {
  if (storefrontTier === "premium" || activityType === "hotel" || activityType === "enterprise") {
    return "premium";
  }
  if (activityType === "restaurant") {
    return "restaurant";
  }
  return "shop";
}

function SellerPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedSellerTypeParam = searchParams.get("type");
  const requestedSellerType = normalizeSellerActivityType(requestedSellerTypeParam);
  const hasRequestedSellerType = Boolean(requestedSellerTypeParam);
  const { data: user, isPending: isAuthPending } = useCurrentUser();
  const queryClient = useQueryClient();
  const setAppMode = useAuthStore((state) => state.setAppMode);
  const [status, setStatus] = useState("");
  const [profileHydratedFromServer, setProfileHydratedFromServer] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showAdvancedProfileFields, setShowAdvancedProfileFields] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<{
    payment_mode: "nita" | "amana";
    transaction_reference: string;
    months: string;
  }>({
    payment_mode: "nita",
    transaction_reference: "",
    months: "1",
  });

  const [profileForm, setProfileForm] = useState(() => {
    const draft = loadDraft(SELLER_PROFILE_DRAFT_KEY, {
      business_name: "",
      city: "Niamey",
      phone: "",
      address: "",
      activity_type: requestedSellerType as "shop" | "restaurant" | "hotel" | "enterprise",
      storefront_tier:
        (requestedSellerType === "enterprise" ? "premium" : "basic") as "basic" | "premium",
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
    const normalizedDraftActivity =
      (draft.activity_type as string) === "hotel" ? "enterprise" : draft.activity_type;
    const normalizedActivity = hasRequestedSellerType ? requestedSellerType : normalizedDraftActivity;
    return {
      ...draft,
      activity_type: normalizedActivity,
      storefront_tier: normalizedActivity === "enterprise" ? "premium" : "basic",
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
    enabled: Boolean(user),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  const { data: subscriptionStatus } = useQuery({
    queryKey: ["seller-subscription-status"],
    queryFn: getSellerSubscriptionStatus,
    enabled: Boolean(user),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  const { data: subscriptionPaymentRequests = [] } = useQuery({
    queryKey: ["seller-subscription-payment-requests"],
    queryFn: listSellerSubscriptionPaymentRequests,
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileForm((prev) => ({
      ...prev,
      business_name: prev.business_name || profile.business_name || "",
      city: prev.city || profile.city || "Niamey",
      phone: prev.phone || profile.phone || "",
      address: prev.address || profile.address || "",
      activity_type: normalizeSellerActivityType(profile.activity_type),
      storefront_tier:
        profile.activity_type === "hotel" || profile.activity_type === "enterprise"
          ? "premium"
          : profile.storefront_tier || "basic",
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const profileMutation = useMutation({
    mutationFn: upsertSellerProfile,
    onSuccess: (updatedProfile) => {
      const previousProfile = queryClient.getQueryData<SellerProfile | null>(["seller-profile"]);
      const planChanged =
        previousProfile &&
        resolveSellerPlanBucket(previousProfile.activity_type, previousProfile.storefront_tier) !==
          resolveSellerPlanBucket(updatedProfile.activity_type, updatedProfile.storefront_tier);
      if (planChanged) {
        queryClient.setQueryData(["seller-subscription-status"], (current: typeof subscriptionStatus) =>
          current
            ? {
                ...current,
                subscription_active: false,
                subscription_paid_until: null,
              }
            : current,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      queryClient.invalidateQueries({ queryKey: ["seller-subscription-status"] });
      queryClient.invalidateQueries({ queryKey: ["seller-subscription-payment-requests"] });
      // Met à jour la home + les listes de boutiques (elles sont basées sur /catalog/storefronts).
      queryClient.invalidateQueries({ queryKey: ["home-storefronts"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-storefronts-boutiques"] });
      setStatus("Profil vendeur enregistre.");
    },
    onError: (error) =>
      setStatus(getApiErrorMessage(error, "Erreur lors de l'enregistrement du profil.")),
  });

  const productMutation = useMutation({
    mutationFn: createSellerProduct,
    onSuccess: () => {
      // Met à jour les résultats produits affichés sur la home (search products).
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
      setStatus("Produit liste avec succes.");
    },
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
  const subscriptionMutation = useMutation({
    mutationFn: paySellerSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-subscription-status"] });
      queryClient.invalidateQueries({ queryKey: ["seller-subscription-payment-requests"] });
      setSubscriptionForm((prev) => ({ ...prev, transaction_reference: "" }));
      setStatus("Demande envoyee. Tu recevras une notification des que le paiement est accepte ou refuse.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Paiement vendeur impossible.")),
  });

  const normalizeImageInput = (raw: string): string | undefined => normalizeImageInputForApi(raw);
  const profileGalleryImages = splitListInput(profileForm.gallery_images_text);
  const isShop = profileForm.activity_type === "shop";
  const isRestaurant = profileForm.activity_type === "restaurant";
  const isPremium = profileForm.activity_type === "hotel" || profileForm.activity_type === "enterprise";
  const showRestaurantSection = isRestaurant || isPremium;
  const showProductSection = isShop || isPremium;
  const { data: publicFinance } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });
  const maxBasicListings = publicFinance?.max_products_basic_tier ?? 10;
  const savedPlanBucket = profile
    ? resolveSellerPlanBucket(profile.activity_type, profile.storefront_tier)
    : null;
  const selectedPlanBucket = resolveSellerPlanBucket(profileForm.activity_type, profileForm.storefront_tier);
  const hasUnsavedPlanChange = Boolean(savedPlanBucket && savedPlanBucket !== selectedPlanBucket);
  const isPremiumTier = selectedPlanBucket === "premium";
  const shopListingLimitReached =
    showProductSection && !isPremiumTier && inventory.length >= maxBasicListings;
  const menuListingLimitReached =
    showRestaurantSection && !isPremiumTier && restaurantItems.length >= maxBasicListings;
  const hasProfile = Boolean(profile?.id);
  const hasActiveSubscription = Boolean(subscriptionStatus?.subscription_active);
  const subscriptionPaidUntilMs = subscriptionStatus?.subscription_paid_until
    ? Date.parse(subscriptionStatus.subscription_paid_until)
    : NaN;
  const daysUntilSubscriptionEnd = Number.isFinite(subscriptionPaidUntilMs) && nowMs !== null
    ? (subscriptionPaidUntilMs - nowMs) / 86_400_000
    : null;
  const showSubscriptionRenewHeadsUp =
    hasActiveSubscription &&
    daysUntilSubscriptionEnd !== null &&
    daysUntilSubscriptionEnd > 0 &&
    daysUntilSubscriptionEnd <= 7;
  const sellerOnboardingFlow = hasProfile || hasRequestedSellerType || searchParams.get("welcome") === "1";
  const sellerPaymentRequired = sellerOnboardingFlow && !hasActiveSubscription;
  const selectedSellerSubscriptionFee =
    profile?.seller_subscription_fee_override ??
    resolveGlobalSubscriptionFeeByType(
      publicFinance,
      profileForm.activity_type as "shop" | "restaurant" | "enterprise" | "hotel",
    );
  const currentSavedMonthlyFee =
    subscriptionStatus?.monthly_fee ??
    profile?.effective_seller_subscription_fee ??
    selectedSellerSubscriptionFee;
  const visibleMonthlyFee = hasUnsavedPlanChange
    ? selectedSellerSubscriptionFee
    : currentSavedMonthlyFee;
  const pricingSnapshot = {
    commissionRate: profile?.effective_commission_rate ?? publicFinance?.commission_rate ?? 0,
    serviceFee: profile?.effective_service_fee ?? publicFinance?.service_fee ?? 0,
    sellerSubscriptionFee: selectedSellerSubscriptionFee,
  };
  const welcomeMessage =
    searchParams.get("welcome") === "1"
      ? "Compte vendeur cree. Les informations de base sont enregistrees. Active maintenant l'abonnement mensuel pour publier."
      : "";
  const latestSubscriptionPayment = subscriptionPaymentRequests[0] ?? null;
  const paymentDestination =
    publicFinance?.platform_wallet_phone ||
    publicFinance?.support_phone ||
    publicFinance?.support_whatsapp ||
    "";
  const selectedSubscriptionMonths = Math.max(1, Math.min(12, Number(subscriptionForm.months || 1)));
  const selectedSubscriptionAmount = visibleMonthlyFee * selectedSubscriptionMonths;
  const latestPaymentStatusLabel =
    latestSubscriptionPayment?.status === "approved"
      ? "Accepte"
      : latestSubscriptionPayment?.status === "rejected"
        ? "Refuse"
        : latestSubscriptionPayment?.status === "pending"
          ? "En attente"
          : null;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Espace vendeur</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gere ta boutique, ton menu et tes operations vendeur depuis un seul espace.
        </p>
        {!sellerPaymentRequired ? (
          <Button asChild variant="outline" className="mt-4">
            <Link href="/seller/dashboard">Aller au dashboard de stock</Link>
          </Button>
        ) : null}
      </header>

      {showSubscriptionRenewHeadsUp ? (
        <article
          className="premium-card border border-sky-200 bg-sky-50 p-6"
          role="status"
        >
          <h2 className="text-lg font-semibold text-sky-950">Renouvellement proche</h2>
          <p className="mt-1 text-sm text-sky-900">
            Ton abonnement vendeur se termine dans environ{" "}
            {daysUntilSubscriptionEnd !== null && daysUntilSubscriptionEnd < 1
              ? "moins de 24 heures"
              : `${Math.max(1, Math.ceil(daysUntilSubscriptionEnd ?? 1))} jour(s)`}
            . Renouvelle maintenant pour eviter toute interruption (tes donnees restent conservees).
          </p>
          {subscriptionStatus?.has_pending_payment_request ? (
            <p className="mt-3 text-sm font-medium text-sky-900">
              Paiement de renouvellement deja soumis — en attente de validation admin. Tu recevras une notification.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-sky-300 bg-white p-4 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Numero de versement AMAZER</p>
                <p className="mt-2">
                  <span className="font-semibold text-[#FF4D00]">
                    {paymentDestination || "Numero non renseigne pour le moment"}
                  </span>
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  className="h-11 w-full rounded-md border border-sky-300 bg-white px-3 text-sm text-slate-900"
                  value={subscriptionForm.payment_mode}
                  onChange={(event) =>
                    setSubscriptionForm((prev) => ({
                      ...prev,
                      payment_mode: event.target.value as "nita" | "amana",
                    }))
                  }
                >
                  <option value="nita">Versement via Nita</option>
                  <option value="amana">Versement via Amana</option>
                </select>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="Nombre de mois"
                  value={subscriptionForm.months}
                  onChange={(event) =>
                    setSubscriptionForm((prev) => ({ ...prev, months: event.target.value || "1" }))
                  }
                />
                <Input
                  placeholder="Reference de transaction"
                  value={subscriptionForm.transaction_reference}
                  onChange={(event) =>
                    setSubscriptionForm((prev) => ({
                      ...prev,
                      transaction_reference: event.target.value,
                    }))
                  }
                />
              </div>
              <p className="text-sm text-sky-800">
                Total : {formatXOF(visibleMonthlyFee * selectedSubscriptionMonths)} pour{" "}
                {selectedSubscriptionMonths} mois.
              </p>
              <Button
                type="button"
                disabled={subscriptionMutation.isPending}
                className="bg-sky-700 text-white hover:bg-sky-600"
                onClick={() =>
                  subscriptionMutation.mutate({
                    payment_mode: subscriptionForm.payment_mode,
                    transaction_reference:
                      subscriptionForm.transaction_reference.trim() || undefined,
                    months: selectedSubscriptionMonths,
                  })
                }
              >
                {subscriptionMutation.isPending ? "Envoi..." : "Soumettre le renouvellement"}
              </Button>
            </div>
          )}
        </article>
      ) : null}

      {sellerPaymentRequired ? (
        <article className="premium-card border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Activation vendeur requise</h2>
          <p className="mt-1 text-sm text-amber-800">
            L&apos;abonnement vendeur doit etre valide pour activer la boutique.
          </p>
          {!hasProfile ? (
            <p className="mt-2 text-sm text-amber-900">
              Enregistre d&apos;abord ton profil vendeur.
            </p>
          ) : null}
          <div className="mt-3 grid gap-2 text-sm text-amber-900 sm:grid-cols-3">
            <p>Frais creation: desactives</p>
            <p>Mensualite: {formatXOF(visibleMonthlyFee)}</p>
            <p>A payer maintenant: {formatXOF(selectedSubscriptionAmount)}</p>
          </div>
          <p className="mt-2 text-xs text-amber-900">{selectedSubscriptionMonths} mois selectionne(s).</p>
          {hasUnsavedPlanChange ? (
            <p className="mt-3 text-sm font-medium text-amber-900">
              Tu as choisi une nouvelle formule. Enregistre d&apos;abord le profil pour appliquer cette mensualite,
              puis lance la demande de paiement.
            </p>
          ) : null}
          {subscriptionStatus?.has_pending_payment_request ? (
            <p className="mt-3 text-sm font-medium text-amber-900">
              Paiement deja soumis. En attente de validation par l&apos;admin. Une notification t&apos;avertira des la decision.
            </p>
          ) : null}
          {!hasActiveSubscription && hasProfile && subscriptionStatus?.onboarding_fee_paid ? (
            <p className="mt-3 text-sm font-medium text-amber-900">
              Abonnement expire: les publications, la gestion boutique et les actions vendeur restent bloquees jusqu&apos;a
              validation d&apos;un nouveau paiement.
            </p>
          ) : null}
          {latestSubscriptionPayment ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-100/70 p-4 text-sm text-amber-950">
              <p className="font-semibold">Derniere demande de paiement</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <p>Statut : {latestPaymentStatusLabel}</p>
                <p>Mode : {latestSubscriptionPayment.payment_mode === "nita" ? "Nita" : "Amana"}</p>
                <p>Reference : {latestSubscriptionPayment.transaction_reference}</p>
                <p>Mois : {latestSubscriptionPayment.months}</p>
              </div>
              {latestSubscriptionPayment.admin_note ? (
                <p className="mt-2">
                  Note admin : <span className="font-medium">{latestSubscriptionPayment.admin_note}</span>
                </p>
              ) : null}
            </div>
          ) : null}
          {hasProfile ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-amber-300 bg-white p-4 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Numero de versement</p>
                <p className="mt-2">
                  AMAZER :{" "}
                  <span className="font-semibold text-[#FF4D00]">
                    {paymentDestination || "Numero non renseigne pour le moment"}
                  </span>
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  className="h-11 w-full rounded-md border border-amber-300 bg-white px-3 text-sm text-slate-900"
                  value={subscriptionForm.payment_mode}
                  onChange={(event) =>
                    setSubscriptionForm((prev) => ({
                      ...prev,
                      payment_mode: event.target.value as "nita" | "amana",
                    }))
                  }
                >
                  <option value="nita">Versement via Nita</option>
                  <option value="amana">Versement via Amana</option>
                </select>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="Nombre de mois"
                  value={subscriptionForm.months}
                  onChange={(event) =>
                    setSubscriptionForm((prev) => ({ ...prev, months: event.target.value || "1" }))
                  }
                />
                <Input
                  placeholder="Reference de transaction"
                  value={subscriptionForm.transaction_reference}
                  onChange={(event) =>
                    setSubscriptionForm((prev) => ({
                      ...prev,
                      transaction_reference: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="rounded-2xl border border-amber-300 bg-white p-4 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Resume</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p>Mode choisi : {subscriptionForm.payment_mode === "nita" ? "Nita" : "Amana"}</p>
                  <p>Mois choisis : {selectedSubscriptionMonths}</p>
                  <p>Frais de creation appliques : Non</p>
                  <p>Total attendu : {formatXOF(selectedSubscriptionAmount)}</p>
                </div>
              </div>
              <Button
                type="button"
                disabled={
                  subscriptionMutation.isPending ||
                  hasUnsavedPlanChange ||
                  Boolean(subscriptionStatus?.has_pending_payment_request)
                }
                className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
                onClick={() =>
                  subscriptionMutation.mutate({
                    payment_mode: subscriptionForm.payment_mode,
                    transaction_reference: subscriptionForm.transaction_reference.trim() || undefined,
                    months: selectedSubscriptionMonths,
                  })
                }
              >
                {subscriptionMutation.isPending ? "Envoi..." : "J'ai paye, verifier maintenant"}
              </Button>
            </div>
          ) : null}
        </article>
      ) : null}

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Tarification appliquee a cette boutique</h2>
        <p className="mt-1 text-sm text-slate-600">
          Les valeurs ci-dessous suivent soit le tarif global AMAZER, soit une surcharge definie pour ta boutique.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Commission</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {(pricingSnapshot.commissionRate * 100).toFixed(2)}%
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Frais plateforme</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatXOF(pricingSnapshot.serviceFee)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Abonnement vendeur</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatXOF(pricingSnapshot.sellerSubscriptionFee)}
            </p>
          </div>
        </div>
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
              Profil enregistre: {profile.business_name} ({profile.city}) -{" "}
              {hasActiveSubscription
                ? profile.is_verified
                  ? "Boutique active avec badge Confiance"
                  : "Boutique active"
                : "Activation en attente d'un abonnement valide"}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Aucun profil actif pour ce compte.</p>
          )}
          {welcomeMessage ? <p className="mt-3 text-sm font-medium text-emerald-700">{welcomeMessage}</p> : null}
          <p className="mt-3 text-sm text-slate-600">
            Garde ici les informations utiles de ta boutique. Les options avancees restent disponibles si besoin.
          </p>
          {profile ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Profil vendeur</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-700/80">Commerce</p>
                  <p className="mt-1 font-medium">{profileForm.business_name || "Non renseigne"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-700/80">Type</p>
                  <p className="mt-1 font-medium">
                    {profileForm.activity_type === "shop"
                      ? "Boutique"
                      : profileForm.activity_type === "restaurant"
                        ? "Restaurant"
                        : "Premium"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-700/80">Ville</p>
                  <p className="mt-1 font-medium">{profileForm.city || "Niamey"}</p>
                </div>
              </div>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                onClick={() => setShowProfileEditor((value) => !value)}
              >
                <PenSquare className="h-3.5 w-3.5" />
                {showProfileEditor ? "Masquer les details" : "Modifier ou completer mon profil"}
              </button>
            </div>
          ) : null}
          {!profile || showProfileEditor ? (
            <>
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
                const activityType = event.target.value as "shop" | "restaurant" | "enterprise";
                setProfileForm((prev) => ({
                  ...prev,
                  activity_type: activityType,
                  storefront_tier: activityType === "enterprise" ? "premium" : "basic",
                }));
              }}
            >
              <option value="shop">Boutique (produits)</option>
              <option value="restaurant">Restaurant (menu)</option>
              <option value="enterprise">Premium entreprise (mini-site complet)</option>
            </select>
            <textarea
              placeholder="Description courte"
              value={profileForm.description}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <button
              type="button"
              className="w-fit rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:col-span-2"
              onClick={() => setShowAdvancedProfileFields((value) => !value)}
            >
              {showAdvancedProfileFields ? "Masquer les options avancees" : "Afficher les options avancees"}
            </button>
            {showAdvancedProfileFields ? (
              <>
            <SingleMediaField
              label="Logo du commerce"
              value={profileForm.logo_url}
              onChange={(value) => setProfileForm((prev) => ({ ...prev, logo_url: value }))}
              emptyMessage="Ajoute le logo depuis la galerie."
            />
            <SingleMediaField
              label="Couverture du commerce"
              value={profileForm.cover_image_url}
              onChange={(value) => setProfileForm((prev) => ({ ...prev, cover_image_url: value }))}
              emptyMessage="Ajoute la couverture depuis la galerie."
            />
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
            {showRestaurantSection && !sellerPaymentRequired ? (
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
            {isPremium ? (
              <GalleryMediaField
                label="Galerie photos"
                values={profileGalleryImages}
                onChange={(values) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    gallery_images_text: mergeImageList(values),
                  }))
                }
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
              </>
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
                storefront_tier: profileForm.storefront_tier as StorefrontTier,
                description: profileForm.description || undefined,
                logo_url: normalizeImageInput(profileForm.logo_url),
                cover_image_url: normalizeImageInput(profileForm.cover_image_url),
                opening_hours: profileForm.opening_hours || undefined,
                whatsapp_contact: profileForm.whatsapp_contact || undefined,
                contact_email: profileForm.contact_email || undefined,
                gallery_images: isPremium
                  ? splitListInput(profileForm.gallery_images_text).flatMap((value) => {
                      const normalized = normalizeImageInput(value);
                      return normalized ? [normalized] : [];
                    })
                  : [],
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
            </>
          ) : null}
        </article>
      )}

      {showProductSection && !sellerPaymentRequired ? (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <PlusCircle className="h-5 w-5 text-[#FF4D00]" />
            Boutique produits
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Publiez vos articles avec une experience type Shopify, sans connexion Shopify.
          </p>
          {!isPremiumTier ? (
            <p className="mt-2 text-sm text-slate-700">
              Compte hors Premium : jusqu&apos;a {maxBasicListings} article(s) catalogue. Premium : illimite.
            </p>
          ) : null}
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
            <SingleMediaField
              label="Photo du produit"
              value={productForm.main_image_url}
              onChange={(value) => setProductForm((prev) => ({ ...prev, main_image_url: value }))}
              emptyMessage="Choisis la photo du produit depuis la galerie."
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
              (() => {
                if (shopListingLimitReached) {
                  setStatus(
                    `Limite atteinte (${maxBasicListings} articles hors Premium). Passe en Premium pour continuer.`
                  );
                  return;
                }
                const stock = Number(productForm.stock_quantity || 0);
                if (!Number.isFinite(stock) || stock <= 0) {
                  setStatus("Ton produit doit avoir un stock > 0 pour s'afficher dans les boutiques.");
                  return;
                }
                productMutation.mutate({
                  name: productForm.name,
                  brand: productForm.brand,
                  amount: Number(productForm.amount || 0),
                  stock_quantity: stock,
                  description: productForm.description || undefined,
                  main_image_url: normalizeImageInput(productForm.main_image_url),
                  category_id: productForm.category_id || undefined,
                  currency: "XOF",
                });
              })()
            }
          >
            Publier mon produit
          </Button>
        </article>
      ) : null}

      {showRestaurantSection && !sellerPaymentRequired ? (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <UtensilsCrossed className="h-5 w-5 text-[#FF4D00]" />
            Menu restaurant
          </h2>
          <p className="mt-2 text-sm text-slate-600">
        Ajoutez vos plats, boissons, prix et marquez vos offres en Plat du Jour.
          </p>
          {!isPremiumTier ? (
            <p className="mt-2 text-sm text-slate-700">
              Hors Premium : jusqu&apos;a {maxBasicListings} plat(s) au menu. Premium : illimite.
            </p>
          ) : null}

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
            <SingleMediaField
              label="Photo du plat"
              value={restaurantForm.image_url}
              onChange={(value) => setRestaurantForm((prev) => ({ ...prev, image_url: value }))}
              emptyMessage="Choisis la photo du plat depuis la galerie."
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
              if (menuListingLimitReached) {
                setStatus(
                  `Limite atteinte (${maxBasicListings} plats hors Premium). Passe en Premium pour un menu illimite.`
                );
                return;
              }
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

export default function SellerPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
          <ProductCardSkeleton />
        </section>
      }
    >
      <SellerPageContent />
    </Suspense>
  );
}
