"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GalleryMediaField, SingleMediaField } from "@/components/seller/MediaFields";
import {
  RoomTypesEditor,
  payloadToRoomRows,
  roomRowsToPayload,
  type RoomRow,
} from "@/components/seller/RoomTypesEditor";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { normalizeImageInputForApi } from "@/lib/image";
import { persistAppMode } from "@/lib/session-mode";
import { getPublicFinanceSettings } from "@/services/finance-service";
import {
  getSellerProfile,
  listSellerSubscriptionPaymentRequests,
  getSellerSubscriptionStatus,
  paySellerSubscription,
  upsertSellerProfile,
} from "@/services/seller-service";
import { useAuthStore } from "@/store/auth-store";
import type { SellerProfile, StorefrontTier } from "@/types/seller";

const SELLER_PROFILE_DRAFT_KEY = "amazer_seller_profile_draft";

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
  // Le transport est gere comme une entreprise (drapeau offers_transport en plus).
  if (value === "enterprise" || value === "hotel" || value === "transport") {
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
  const [showPayForm, setShowPayForm] = useState(false);
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
      payout_phone: "",
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
      room_types_list: [] as RoomRow[],
      deposit_payment_method: "nita" as "nita" | "amana",
      deposit_amount: "",
      accepts_table_reservations: false,
      accepts_hotel_bookings: false,
      offers_shop: false,
      offers_restaurant: false,
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
  useEffect(() => {
    setAppMode("seller");
    persistAppMode("seller");
  }, [setAppMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELLER_PROFILE_DRAFT_KEY, JSON.stringify(profileForm));
    }
  }, [profileForm]);

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
      payout_phone: prev.payout_phone || profile.payout_phone || "",
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
      room_types_list:
        prev.room_types_list && prev.room_types_list.length
          ? prev.room_types_list
          : payloadToRoomRows(profile.room_types || []),
      deposit_payment_method:
        prev.deposit_payment_method || profile.deposit_payment_method || "nita",
      deposit_amount:
        prev.deposit_amount || (profile.deposit_amount ? String(profile.deposit_amount) : ""),
      accepts_table_reservations:
        prev.accepts_table_reservations || profile.accepts_table_reservations || false,
      accepts_hotel_bookings:
        prev.accepts_hotel_bookings || profile.accepts_hotel_bookings || false,
      offers_shop: prev.offers_shop || profile.offers_shop || false,
      offers_restaurant: prev.offers_restaurant || profile.offers_restaurant || false,
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
      setStatus("Profil vendeur enregistré.");
    },
    onError: (error) =>
      setStatus(getApiErrorMessage(error, "Erreur lors de l'enregistrement du profil.")),
  });

  const subscriptionMutation = useMutation({
    mutationFn: paySellerSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-subscription-status"] });
      queryClient.invalidateQueries({ queryKey: ["seller-subscription-payment-requests"] });
      setSubscriptionForm((prev) => ({ ...prev, transaction_reference: "" }));
      setStatus("Demande envoyee. Tu recevras une notification des que le paiement est accepte ou refusé.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Paiement vendeur impossible.")),
  });

  const normalizeImageInput = (raw: string): string | undefined => normalizeImageInputForApi(raw);
  const profileGalleryImages = splitListInput(profileForm.gallery_images_text);
  const isRestaurant = profileForm.activity_type === "restaurant";
  const isTransport = Boolean(profile?.offers_transport);
  const isPremium = profileForm.activity_type === "hotel" || profileForm.activity_type === "enterprise";
  const showRestaurantSection = isRestaurant || isPremium;
  const showRoomTypes = isPremium || isTransport;
  const { data: publicFinance } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });
  const savedPlanBucket = profile
    ? resolveSellerPlanBucket(profile.activity_type, profile.storefront_tier)
    : null;
  const selectedPlanBucket = resolveSellerPlanBucket(profileForm.activity_type, profileForm.storefront_tier);
  const hasUnsavedPlanChange = Boolean(savedPlanBucket && savedPlanBucket !== selectedPlanBucket);
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
    commissionRate: profile?.effective_commission_rate ?? publicFinance?.commission_rate ?? null,
    serviceFee: profile?.effective_service_fee ?? publicFinance?.service_fee ?? null,
    sellerSubscriptionFee: selectedSellerSubscriptionFee,
  };
  const welcomeMessage =
    searchParams.get("welcome") === "1"
      ? "Compte vendeur créé. Les informations de base sont enregistrées. Active maintenant l'abonnement mensuel pour publier."
      : "";
  const latestSubscriptionPayment = subscriptionPaymentRequests[0] ?? null;
  const paymentDestination =
    publicFinance?.platform_wallet_phone ||
    publicFinance?.support_phone ||
    publicFinance?.support_whatsapp ||
    "";
  const selectedSubscriptionMonths = Math.max(1, Math.min(12, Number(subscriptionForm.months || 1)));
  const selectedSubscriptionAmount = visibleMonthlyFee * selectedSubscriptionMonths;

  const subscriptionUntil = subscriptionStatus?.subscription_paid_until
    ? new Date(subscriptionStatus.subscription_paid_until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const pendingPayment = Boolean(subscriptionStatus?.has_pending_payment_request);
  const showPaymentForm = hasProfile && !pendingPayment && (sellerPaymentRequired || showSubscriptionRenewHeadsUp || showPayForm);
  const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";
  const labelClass = "block text-sm font-medium text-ink-800";
  const setField = (key: keyof typeof profileForm) => (value: string | boolean) =>
    setProfileForm((prev) => ({ ...prev, [key]: value }));

  const saveProfile = () =>
    profileMutation.mutate({
      business_name: profileForm.business_name,
      city: profileForm.city,
      phone: profileForm.phone || undefined,
      payout_phone: profileForm.payout_phone ?? "",
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
      room_types: showRoomTypes ? roomRowsToPayload(profileForm.room_types_list) : [],
      deposit_payment_method: showRoomTypes ? profileForm.deposit_payment_method : undefined,
      deposit_amount: isPremium ? (profileForm.deposit_amount ? Number(profileForm.deposit_amount) : undefined) : undefined,
      accepts_table_reservations: showRestaurantSection ? profileForm.accepts_table_reservations : false,
      accepts_hotel_bookings: isPremium ? profileForm.accepts_hotel_bookings : false,
      offers_shop: isPremium ? profileForm.offers_shop : undefined,
      offers_restaurant: isPremium ? profileForm.offers_restaurant : undefined,
    });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-gutter pb-28 pt-4">
      <header>
        {!sellerPaymentRequired ? (
          <Link href="/seller/dashboard" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 hover:underline">
            ← Mon espace vendeur
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold text-ink-900">Profil et abonnement</h1>
        {welcomeMessage ? <p className="mt-1 text-sm text-success">{welcomeMessage}</p> : null}
      </header>

      {/* Abonnement : un seul bloc, etat clair, paiement seulement quand il faut */}
      <article className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Abonnement</h2>
            <p
              className={`mt-1 text-sm font-medium ${
                hasActiveSubscription ? (showSubscriptionRenewHeadsUp ? "text-warning" : "text-success") : "text-danger"
              }`}
            >
              {pendingPayment
                ? "Paiement envoyé : AMAZER le vérifie. Vous serez prévenu."
                : hasActiveSubscription
                  ? `Actif${subscriptionUntil ? ` jusqu'au ${subscriptionUntil}` : ""}${showSubscriptionRenewHeadsUp ? " · à renouveler bientôt" : ""}`
                  : hasProfile
                    ? "Inactif : votre boutique est masquée aux clients."
                    : "Enregistrez d'abord votre profil ci-dessous."}
            </p>
          </div>
          <p className="text-right text-sm text-ink-700">
            <span className="block text-lg font-bold text-ink-900">{formatXOF(visibleMonthlyFee)}</span>
            par mois
          </p>
        </div>
        <p className="mt-2 text-xs text-ink-600">
          Commission sur les ventes :{" "}
          {pricingSnapshot.commissionRate !== null ? `${Number((pricingSnapshot.commissionRate * 100).toFixed(2))} %` : "—"} · frais de
          service : {pricingSnapshot.serviceFee !== null ? formatXOF(pricingSnapshot.serviceFee) : "—"} par commande (payés par le client)
        </p>
        {latestSubscriptionPayment?.status === "rejected" ? (
          <p className="mt-3 rounded-field bg-surface-1 px-3 py-2 text-sm text-danger">
            Dernier paiement refusé
            {latestSubscriptionPayment.admin_note ? ` : ${latestSubscriptionPayment.admin_note}` : ""}. Vérifiez la référence et
            réessayez.
          </p>
        ) : null}
        {hasUnsavedPlanChange ? (
          <p className="mt-3 rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">
            Nouvelle formule choisie : enregistrez le profil avant de payer.
          </p>
        ) : null}

        {showPaymentForm ? (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium text-ink-800">Durée</p>
              <div className="mt-1 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Durée">
                {[1, 3, 6, 12].map((months) => (
                  <button
                    key={months}
                    type="button"
                    role="radio"
                    aria-checked={selectedSubscriptionMonths === months}
                    onClick={() => setSubscriptionForm((prev) => ({ ...prev, months: String(months) }))}
                    className={`min-h-11 rounded-field border text-sm font-semibold ${
                      selectedSubscriptionMonths === months ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-800"
                    }`}
                  >
                    {months} mois
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-800">Moyen de paiement</p>
              <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Moyen de paiement">
                {(["nita", "amana"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={subscriptionForm.payment_mode === mode}
                    onClick={() => setSubscriptionForm((prev) => ({ ...prev, payment_mode: mode }))}
                    className={`min-h-11 rounded-field border text-sm font-semibold ${
                      subscriptionForm.payment_mode === mode ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-800"
                    }`}
                  >
                    {mode === "nita" ? "Nita" : "Amana"}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-field bg-surface-1 p-3 text-sm text-ink-800">
              Envoyez <span className="text-lg font-bold text-ink-900">{formatXOF(selectedSubscriptionAmount)}</span> au{" "}
              <span className="text-lg font-bold text-ink-900">{paymentDestination || "numéro AMAZER"}</span>
            </div>
            <label className={labelClass}>
              Référence du paiement (reçue par SMS)
              <input
                className={fieldClass}
                value={subscriptionForm.transaction_reference}
                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, transaction_reference: event.target.value }))}
              />
            </label>
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={subscriptionMutation.isPending || hasUnsavedPlanChange || subscriptionForm.transaction_reference.trim().length < 4}
              onClick={() =>
                subscriptionMutation.mutate({
                  payment_mode: subscriptionForm.payment_mode,
                  transaction_reference: subscriptionForm.transaction_reference.trim() || undefined,
                  months: selectedSubscriptionMonths,
                })
              }
            >
              {subscriptionMutation.isPending ? "Envoi…" : "J'ai payé, envoyer"}
            </Button>
          </div>
        ) : hasProfile && !pendingPayment ? (
          <Button type="button" variant="outline" className="mt-4" onClick={() => setShowPayForm(true)}>
            Prolonger mon abonnement
          </Button>
        ) : null}
      </article>

      {/* Profil : sections courtes et etiquetees */}
      {isPending ? (
        <ProductCardSkeleton />
      ) : (
        <article className="space-y-5 rounded-card border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-ink-900">Ma boutique</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Nom de la boutique
              <input className={fieldClass} value={profileForm.business_name} onChange={(e) => setField("business_name")(e.target.value)} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Description (ce que vous vendez)
              <textarea
                className={`${fieldClass} h-auto min-h-24 py-2`}
                value={profileForm.description}
                onChange={(e) => setField("description")(e.target.value)}
              />
            </label>
            <SingleMediaField
              label="Logo"
              value={profileForm.logo_url}
              onChange={(value) => setField("logo_url")(value)}
              emptyMessage="Ajoutez votre logo."
            />
            <SingleMediaField
              label="Photo de couverture"
              value={profileForm.cover_image_url}
              onChange={(value) => setField("cover_image_url")(value)}
              emptyMessage="Ajoutez une belle photo de votre commerce."
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-ink-900">Contact client</h3>
            <p className="text-xs text-ink-600">Affiché sur votre boutique : les clients vous appellent ou vous écrivent directement.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                WhatsApp
                <input className={fieldClass} inputMode="tel" value={profileForm.whatsapp_contact} onChange={(e) => setField("whatsapp_contact")(e.target.value)} />
              </label>
              <label className={labelClass}>
                Téléphone
                <input className={fieldClass} inputMode="tel" value={profileForm.phone} onChange={(e) => setField("phone")(e.target.value)} />
              </label>
              <label className={labelClass}>
                E-mail
                <input className={fieldClass} type="email" value={profileForm.contact_email} onChange={(e) => setField("contact_email")(e.target.value)} />
              </label>
              <label className={labelClass}>
                Horaires
                <input
                  className={fieldClass}
                  placeholder="Ex. Lun-Sam 8h-20h"
                  value={profileForm.opening_hours}
                  onChange={(e) => setField("opening_hours")(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Ville
                <input className={fieldClass} value={profileForm.city} onChange={(e) => setField("city")(e.target.value)} />
              </label>
              <label className={labelClass}>
                Adresse / quartier
                <input className={fieldClass} value={profileForm.address} onChange={(e) => setField("address")(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-ink-900">Formule</h3>
            <label className={`${labelClass} mt-2`}>
              Type d&apos;activité
              <select
                className={fieldClass}
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
                <option value="enterprise">Premium (hôtel, transport, pharmacie, station, entreprise)</option>
              </select>
            </label>
            {isPremium ? (
              <p className="mt-2 text-sm text-ink-600">
                Hôtel, transport, pharmacie ou station-essence : AMAZER active la fonction adaptée après vérification de
                votre établissement. Écrivez-nous sur WhatsApp depuis la page d&apos;aide pour l&apos;activer.
              </p>
            ) : null}
          </div>

          {isPremium || isRestaurant ? (
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="font-semibold text-ink-900">Options {isPremium ? "Premium" : "restaurant"}</h3>
              {isPremium ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-ink-800">Ce que propose votre mini-site</legend>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-ink-800">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={profileForm.offers_shop} onChange={(e) => setField("offers_shop")(e.target.checked)} />
                    Boutique (vendre des produits)
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-ink-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={profileForm.offers_restaurant}
                      onChange={(e) => setField("offers_restaurant")(e.target.checked)}
                    />
                    Restaurant (menu et commandes)
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-ink-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={profileForm.accepts_hotel_bookings}
                      onChange={(e) => setField("accepts_hotel_bookings")(e.target.checked)}
                    />
                    Réservations en ligne ({isTransport ? "trajets" : "chambres"})
                  </label>
                </fieldset>
              ) : null}
              {showRestaurantSection && !sellerPaymentRequired ? (
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={profileForm.accepts_table_reservations}
                    onChange={(e) => setField("accepts_table_reservations")(e.target.checked)}
                  />
                  Réservation de tables
                </label>
              ) : null}
              <label className={labelClass}>
                Numéro qui reçoit les paiements clients (Nita / Amana)
                <input className={fieldClass} inputMode="tel" placeholder="Ex. 90 00 00 00" value={profileForm.payout_phone} onChange={(e) => setField("payout_phone")(e.target.value)} />
                <span className="mt-1 block text-xs font-normal text-ink-600">Affiché au client pour les réservations et acomptes.</span>
              </label>
              {isPremium ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    Acompte de réservation (XOF, facultatif)
                    <input className={fieldClass} inputMode="numeric" value={profileForm.deposit_amount} onChange={(e) => setField("deposit_amount")(e.target.value.replace(/\D/g, ""))} />
                  </label>
                  <label className={labelClass}>
                    Acompte payé par
                    <select className={fieldClass} value={profileForm.deposit_payment_method} onChange={(e) => setField("deposit_payment_method")(e.target.value)}>
                      <option value="nita">Nita</option>
                      <option value="amana">Amana</option>
                    </select>
                  </label>
                </div>
              ) : null}
              {isPremium ? (
                <GalleryMediaField
                  label="Galerie photos"
                  values={profileGalleryImages}
                  onChange={(values) => setProfileForm((prev) => ({ ...prev, gallery_images_text: mergeImageList(values) }))}
                />
              ) : null}
              {isPremium ? (
                <label className={labelClass}>
                  Services (un par ligne : titre | description)
                  <textarea
                    className={`${fieldClass} h-auto min-h-24 py-2`}
                    value={profileForm.service_offerings_text}
                    onChange={(e) => setField("service_offerings_text")(e.target.value)}
                  />
                </label>
              ) : null}
              {showRoomTypes ? (
                <div id="chambres" className="scroll-mt-24">
                  <p className="mb-2 text-sm font-medium text-ink-800">{isTransport ? "Vos trajets" : "Vos chambres"}</p>
                  <RoomTypesEditor
                    value={profileForm.room_types_list}
                    onChange={(rows) => setProfileForm((prev) => ({ ...prev, room_types_list: rows }))}
                    isTransport={isTransport}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      )}

      {status ? (
        <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800" role="status">
          {status}
        </p>
      ) : null}

      {/* Bouton d'enregistrement toujours visible sur telephone */}
      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-card/95 px-gutter py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto max-w-3xl">
          <Button type="button" size="lg" className="w-full sm:w-auto" disabled={profileMutation.isPending} onClick={saveProfile}>
            {profileMutation.isPending ? "Enregistrement…" : "Enregistrer le profil"}
          </Button>
        </div>
      </div>
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
