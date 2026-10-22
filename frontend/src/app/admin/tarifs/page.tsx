"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { requestAdminPin } from "@/lib/admin-pin";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import {
  downloadAuditCsv,
  getAdminFinanceSettings,
  grantAdminSellerSubscription,
  listAdminDistrictFees,
  listAdminAuditHistory,
  listAdminSellers,
  replaceAdminDistrictFees,
  setAdminSellerActivity,
  toggleLaunchMode,
  updateAdminFinanceSettings,
  updateAdminSellerPricing,
  verifyAdminSeller,
} from "@/services/finance-service";
import { getApiErrorMessage } from "@/lib/api-error";
import { type AdminSeller, FinanceSettings } from "@/types/finance";

function parseNonNegativeNumber(value: string, fallback: number) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Math.trunc(parseNonNegativeNumber(value, fallback));
  return parsed >= 1 ? parsed : fallback;
}

type AffiliateSecurityKey =
  | "affiliate_hold_days"
  | "affiliate_min_payout"
  | "affiliate_new_account_monthly_cap"
  | "affiliate_max_referrals_per_day"
  | "ambassador_first_month_percent"
  | "ambassador_tier2_shops"
  | "ambassador_tier2_percent"
  | "ambassador_tier3_shops"
  | "ambassador_tier3_percent"
  | "ambassador_monthly_top_bonus"
  | "fuel_included_outlets"
  | "fuel_tier1_price"
  | "fuel_tier2_price"
  | "fuel_tier3_price"
  | "fuel_network_flat";

/** Securite des gains d'affiliation et taux des ambassadeurs (tous reglables). */
const AFFILIATE_SECURITY_FIELDS: Array<{
  key: AffiliateSecurityKey;
  label: string;
  suffix: string;
  fallback: number;
  min: number;
  max: number;
  step: string;
  integer?: boolean;
  helper: string;
}> = [
  { key: "fuel_included_outlets", label: "Stations : nombre inclus dans l'abonnement Premium", suffix: "stations", fallback: 3, min: 0, max: 1000, step: "1", integer: true, helper: "Une marque de carburant paie l'abonnement Premium et déclare ce nombre de stations sans supplément." },
  { key: "fuel_tier1_price", label: "Stations : prix par station suivante (jusqu'à la 10e)", suffix: "XOF / mois", fallback: 2000, min: 0, max: 10_000_000, step: "500", helper: "Exemple avec 3 incluses : la 4e à la 10e station coûtent chacune ce montant." },
  { key: "fuel_tier2_price", label: "Stations : prix par station de la 11e à la 30e", suffix: "XOF / mois", fallback: 1500, min: 0, max: 10_000_000, step: "500", helper: "Prix dégressif : plus la marque a de stations, moins chacune coûte." },
  { key: "fuel_tier3_price", label: "Stations : prix par station à partir de la 31e", suffix: "XOF / mois", fallback: 1000, min: 0, max: 10_000_000, step: "500", helper: "Pour les grands réseaux nationaux." },
  { key: "fuel_network_flat", label: "Stations : forfait national (plafond, stations illimitées)", suffix: "XOF / mois", fallback: 50000, min: 0, max: 100_000_000, step: "1000", helper: "Le total d'une marque ne dépasse jamais ce montant. 0 = pas de plafond. Un prix négocié par marque (fiche vendeur) remplace tout ce calcul." },
  { key: "affiliate_hold_days", label: "Affiliés : délai de sécurité avant paiement", suffix: "jours", fallback: 30, min: 0, max: 180, step: "1", integer: true, helper: "Temps pour repérer annulations et fraudes avant qu'un gain soit payable." },
  { key: "affiliate_min_payout", label: "Affiliés : minimum pour demander un paiement", suffix: "XOF", fallback: 2000, min: 0, max: 10_000_000, step: "500", helper: "En dessous, le solde reste et s'additionne au mois suivant." },
  { key: "affiliate_new_account_monthly_cap", label: "Affiliés : plafond mensuel des nouveaux comptes", suffix: "XOF", fallback: 25000, min: 0, max: 100_000_000, step: "1000", helper: "Pendant les 3 premiers mois : au-delà, les gains passent « à vérifier ». 0 = pas de plafond." },
  { key: "affiliate_max_referrals_per_day", label: "Affiliés : inscriptions par jour avant vérification", suffix: "/ jour", fallback: 15, min: 1, max: 10000, step: "1", integer: true, helper: "Au-delà, les nouveaux parrainages sont signalés comme suspects." },
  { key: "ambassador_first_month_percent", label: "Ambassadeurs : prime sur le 1er mois d'abonnement", suffix: "%", fallback: 50, min: 0, max: 100, step: "1", helper: "Exemple : 50 % de 5 000 XOF = 2 500 XOF au premier mois payé par une boutique recrutée." },
  { key: "ambassador_tier2_shops", label: "Ambassadeurs : boutiques payantes pour le palier Argent", suffix: "boutiques", fallback: 10, min: 1, max: 100000, step: "1", integer: true, helper: "Avant ce palier, l'ambassadeur touche la part normale des affiliés." },
  { key: "ambassador_tier2_percent", label: "Ambassadeurs : part au palier Argent", suffix: "%", fallback: 25, min: 0, max: 90, step: "1", helper: "Part des abonnements suivants des boutiques recrutées." },
  { key: "ambassador_tier3_shops", label: "Ambassadeurs : boutiques payantes pour le palier Or", suffix: "boutiques", fallback: 25, min: 1, max: 100000, step: "1", integer: true, helper: "Doit être supérieur au palier Argent." },
  { key: "ambassador_tier3_percent", label: "Ambassadeurs : part au palier Or", suffix: "%", fallback: 30, min: 0, max: 90, step: "1", helper: "Part des abonnements suivants au palier Or." },
  { key: "ambassador_monthly_top_bonus", label: "Ambassadeurs : prime du n°1 du mois", suffix: "XOF", fallback: 10000, min: 0, max: 100_000_000, step: "1000", helper: "Affichée dans le classement. Versée par l'admin (page Affiliés) si le mois a rapporté plus." },
];

type SellerFilter = "tous" | "abonnes" | "sans-abonnement" | "hors-ligne" | "non-verifies";

const SELLER_FILTERS: Array<[SellerFilter, string]> = [
  ["tous", "Tous"],
  ["abonnes", "Abonnés"],
  ["sans-abonnement", "Sans abonnement / expiré"],
  ["hors-ligne", "Hors ligne"],
  ["non-verifies", "Non vérifiés"],
];

/** Libellés lisibles de l'historique ; un code inconnu reste affiché tel quel. */
const AUDIT_LABELS: Record<string, string> = {
  admin_seller_subscription_granted: "Abonnement offert / activé",
  admin_seller_restored: "Vendeur restauré",
  admin_seller_disabled: "Vendeur retiré",
  admin_seller_permanently_deleted: "Vendeur supprimé définitivement",
  admin_seller_verification_updated: "Badge vendeur modifié",
  admin_seller_pricing_updated: "Tarif personnalisé modifié",
  admin_seller_activity_set: "Activité du vendeur changée",
  admin_seller_subscription_payment_decision: "Paiement d'abonnement validé / refusé",
  admin_pre_registration_approved: "Inscription vendeur validée",
  admin_pre_registration_rejected: "Inscription vendeur refusée",
  admin_district_fees_updated: "Frais par quartier modifiés",
  admin_launch_mode_toggled: "Mode lancement (0 % commission) changé",
  admin_order_status_updated: "Statut de commande changé",
  admin_order_cancelled: "Commande annulée",
  admin_fund_transfer_created: "Versement enregistré",
  admin_message_sent: "Message envoyé",
  admin_finance_pin_verified: "Connexion admin (PIN)",
  admin_user_deactivated: "Compte retiré",
  admin_user_restored: "Compte restauré",
  admin_user_permanently_deleted: "Compte supprimé définitivement",
  admin_user_role_changed: "Rôle modifié",
  admin_finance_settings_updated: "Tarifs et réglages modifiés",
};

function subscriptionRunning(paidUntil: string | null | undefined): boolean {
  return Boolean(paidUntil && new Date(paidUntil) > new Date());
}

function filterSellers(list: AdminSeller[], filter: SellerFilter, search: string): AdminSeller[] {
  const needle = search.trim().toLowerCase();
  const digits = needle.replace(/\s/g, "");
  return list.filter((seller) => {
    if (filter === "abonnes" && !subscriptionRunning(seller.subscription_paid_until)) return false;
    if (filter === "sans-abonnement" && subscriptionRunning(seller.subscription_paid_until)) return false;
    if (filter === "hors-ligne" && seller.is_active) return false;
    if (filter === "non-verifies" && seller.is_verified) return false;
    if (!needle) return true;
    return (
      [seller.business_name, seller.city, seller.email ?? ""].some((value) => (value ?? "").toLowerCase().includes(needle)) ||
      (digits.length > 0 && (seller.phone ?? "").replace(/\s/g, "").includes(digits))
    );
  });
}

function AdminNumberField({
  label,
  value,
  onChange,
  suffix,
  step = "1",
  min = 0,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  suffix?: string;
  step?: string;
  min?: number;
  helper?: string;
}) {
  return (
    <label className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-sm font-semibold text-slate-900">
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <input
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
      />
      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
    </label>
  );
}

type SellerActivity = "shop" | "restaurant" | "premium" | "transport" | "pharmacy" | "fuel_station";
/** Un seul choix d'activité ; Entreprise, Transport, Pharmacie et Station sont des formules Premium. */
const ACTIVITY_OPTIONS: Array<[SellerActivity, string]> = [
  ["shop", "Boutique"],
  ["restaurant", "Restaurant"],
  ["premium", "Premium · Entreprise / Hôtel"],
  ["transport", "Premium · Transport"],
  ["pharmacy", "Premium · Pharmacie"],
  ["fuel_station", "Premium · Station-essence"],
];
const activityLabel = (value: SellerActivity) => ACTIVITY_OPTIONS.find(([key]) => key === value)?.[1] ?? "Boutique";
function sellerActivity(seller: AdminSeller): SellerActivity {
  if (seller.service_kind === "pharmacy" || seller.service_kind === "fuel_station") return seller.service_kind;
  if (seller.offers_transport) return "transport";
  if (seller.storefront_tier === "premium" || seller.activity_type === "enterprise" || seller.activity_type === "hotel") return "premium";
  return seller.activity_type === "restaurant" ? "restaurant" : "shop";
}

export default function AdminTarifsPage() {
  const queryClient = useQueryClient();
  // Le PIN est vérifié une seule fois par la mise en page admin.
  const pinVerified = true;
  const [status, setStatus] = useState("");
  // Trois onglets au lieu d'une longue page : Vendeurs (par défaut), Réglages, Historique. ?vue= ouvre un onglet.
  const [view, setView] = useState<"vendeurs" | "reglages" | "historique">(() => {
    const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("vue");
    return requested === "reglages" || requested === "historique" ? requested : "vendeurs";
  });
  // « Fiche vendeur » depuis Utilisateurs : /admin/tarifs?q=e-mail
  const [sellerSearch, setSellerSearch] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [sellerFilter, setSellerFilter] = useState<SellerFilter>("tous");
  const [draft, setDraft] = useState<FinanceSettings | null>(null);
  const [districtDraft, setDistrictDraft] = useState<string | null>(null);
  const [sellerPricingDrafts, setSellerPricingDrafts] = useState<
    Record<string, { commission: string; serviceFee: string; subscriptionFee: string }>
  >({});

  const { data: settings, isPending, isError: isSettingsError, error: settingsError } = useQuery({
    queryKey: ["admin-tarifs-settings"],
    queryFn: getAdminFinanceSettings,
    enabled: pinVerified,
  });
  const {
    data: auditHistory,
    isError: isAuditError,
    error: auditError,
  } = useQuery({
    queryKey: ["admin-audit-history"],
    queryFn: () => listAdminAuditHistory(80),
    enabled: pinVerified,
  });
  const {
    data: sellers,
    isError: isSellersError,
    error: sellersError,
  } = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: listAdminSellers,
    enabled: pinVerified,
  });
  const {
    data: districtFees,
    isError: isDistrictError,
    error: districtError,
  } = useQuery({
    queryKey: ["admin-district-fees"],
    queryFn: listAdminDistrictFees,
    enabled: pinVerified,
  });

  const saveMutation = useMutation({
    mutationFn: updateAdminFinanceSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tarifs-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-finance-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Tarifs enregistres.");
    },
    onError: () => setStatus("Erreur enregistrement tarifs."),
  });

  const launchModeMutation = useMutation({
    mutationFn: toggleLaunchMode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tarifs-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-finance-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Mode lancement mis a jour.");
    },
    onError: () => setStatus("Erreur mode lancement."),
  });
  const districtMutation = useMutation({
    mutationFn: replaceAdminDistrictFees,
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["admin-district-fees"] });
      setDistrictDraft(payload.map((item) => `${item.district_name}:${item.delivery_fee}`).join("\n"));
      setStatus("Frais de livraison par quartier enregistres.");
    },
    onError: () => setStatus("Erreur enregistrement frais quartiers."),
  });

  const activityMutation = useMutation({
    mutationFn: ({ profileId, activity }: { profileId: string; activity: SellerActivity }) => setAdminSellerActivity(profileId, activity),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus(`Activité mise à jour : ${activityLabel(vars.activity)}.`);
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Impossible de changer l'activité.")),
  });
  const verifySellerMutation = useMutation({
    mutationFn: ({ profileId, verified }: { profileId: string; verified: boolean }) =>
      verifyAdminSeller(profileId, verified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Statut vendeur mis a jour.");
    },
    onError: () => setStatus("Vérification vendeur impossible."),
  });
  const grantSubscriptionMutation = useMutation({
    mutationFn: ({ profileId, months }: { profileId: string; months: number }) =>
      grantAdminSellerSubscription(profileId, months),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
      setStatus("Abonnement accordé. La boutique est maintenant visible.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Impossible d'accorder l'abonnement.")),
  });


  const sellerPricingMutation = useMutation({
    mutationFn: ({
      profileId,
      commissionRateOverride,
      serviceFeeOverride,
      sellerSubscriptionFeeOverride,
    }: {
      profileId: string;
      commissionRateOverride: number | null;
      serviceFeeOverride: number | null;
      sellerSubscriptionFeeOverride: number | null;
    }) =>
      updateAdminSellerPricing(profileId, {
        commission_rate_override: commissionRateOverride,
        service_fee_override: serviceFeeOverride,
        seller_subscription_fee_override: sellerSubscriptionFeeOverride,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Tarification boutique mise à jour.");
    },
    onError: () => setStatus("Impossible de sauvegarder la tarification boutique."),
  });

  async function onExportAuditCsv() {
    try {
      const blob = await downloadAuditCsv(1000);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "amazer_audit_history.csv";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
  } catch {
      setStatus("Export CSV impossible.");
    }
  }

  const effective = useMemo(() => draft ?? settings ?? null, [draft, settings]);
  const visibleSellers = useMemo(() => filterSellers(sellers ?? [], sellerFilter, sellerSearch), [sellers, sellerFilter, sellerSearch]);
  const criticalPageError = useMemo(() => {
    return settingsError ? getAdminFinanceDataError(settingsError) : "";
  }, [settingsError]);
  const secondaryErrors = useMemo(
    () =>
      [
        auditError ? `Historique: ${getAdminFinanceDataError(auditError)}` : null,
        sellersError ? `Vendeurs: ${getAdminFinanceDataError(sellersError)}` : null,
        districtError ? `Quartiers: ${getAdminFinanceDataError(districtError)}` : null,
      ].filter(Boolean) as string[],
    [auditError, districtError, sellersError]
  );
  const districtRaw = useMemo(() => {
    if (districtDraft !== null) {
      return districtDraft;
    }
    if (districtFees?.length) {
      return districtFees.map((item) => `${item.district_name}:${item.delivery_fee}`).join("\n");
    }
    return "";
  }, [districtDraft, districtFees]);
  const parsedDistrictPayload = useMemo(
    () =>
      districtRaw
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [districtName, fee] = entry.split(":");
          return {
            district_name: (districtName || "").trim(),
            delivery_fee: parseNonNegativeNumber(fee || "", 0),
          };
        })
        .filter((entry) => entry.district_name),
    [districtRaw]
  );

  function getSellerDraft(profileId: string, seller: NonNullable<typeof sellers>[number]) {
    return (
      sellerPricingDrafts[profileId] ?? {
        commission: seller.commission_rate_override !== null ? String(seller.commission_rate_override * 100) : "",
        serviceFee: seller.service_fee_override !== null ? String(seller.service_fee_override) : "",
        subscriptionFee:
          seller.seller_subscription_fee_override !== null
            ? String(seller.seller_subscription_fee_override)
            : "",
      }
    );
  }

  if (isPending || !effective) {
    if (isSettingsError && criticalPageError) {
      return (
        <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
          <article className="premium-card border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-xl font-semibold text-rose-700">Chargement admin impossible</h1>
            <p className="mt-2 text-sm text-rose-700">{criticalPageError}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={requestAdminPin}>
                Revalider le PIN
              </Button>
              <Button type="button" variant="outline" onClick={() => window.location.assign("/login?next=/admin/tarifs")}>
                Me reconnecter
              </Button>
            </div>
          </article>
        </section>
      );
    }
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      {secondaryErrors.length ? (
        <article className="premium-card border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">Certaines sections admin sont indisponibles</h2>
          <div className="mt-2 space-y-1 text-sm text-amber-900">
            {secondaryErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        </article>
      ) : null}
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Vendeurs et tarifs</h1>
        <p className="mt-1 text-sm text-ink-600">Les inscriptions et paiements à valider sont dans « Commandes et paiements ».</p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Rubriques">
          {(
            [
              ["vendeurs", `Vendeurs${sellers?.length ? ` (${sellers.length})` : ""}`],
              ["reglages", "Tarifs, frais et réglages"],
              ["historique", "Historique"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`min-h-10 rounded-pill border px-4 text-sm font-medium ${
                view === key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {status ? (
        <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800" role="status">
          {status}
        </p>
      ) : null}

      {view === "reglages" ? (
        <>
      <article id="tarifs" className="premium-card border border-slate-200 bg-white p-6">
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminNumberField
              label="Commission AMAZER"
              value={Number((effective.commission_rate * 100).toFixed(4))}
              suffix="%"
              step="0.01"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  commission_rate: parseNonNegativeNumber(value, effective.commission_rate * 100) / 100,
                })
              }
              helper="Saisie libre sans plafond. Exemple: 150 = 150%."
            />
            <AdminNumberField
              label="Frais plateforme"
              value={effective.service_fee}
              suffix="XOF"
              onChange={(value) =>
                setDraft({ ...effective, service_fee: parseNonNegativeNumber(value, effective.service_fee) })
              }
            />
            <AdminNumberField
              label="Livraison par defaut"
              value={effective.default_delivery_fee}
              suffix="XOF"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  default_delivery_fee: parseNonNegativeNumber(value, effective.default_delivery_fee),
                })
              }
            />
            <AdminNumberField
              label="Livraison urbaine"
              value={effective.urban_delivery_fee}
              suffix="XOF"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  urban_delivery_fee: parseNonNegativeNumber(value, effective.urban_delivery_fee),
                })
              }
            />
            <AdminNumberField
              label="Livraison périphérique"
              value={effective.peripheral_delivery_fee}
              suffix="XOF"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  peripheral_delivery_fee: parseNonNegativeNumber(value, effective.peripheral_delivery_fee),
                })
              }
            />
            <AdminNumberField
              label="Abonnement boutique"
              value={effective.seller_subscription_fee_shop}
              suffix="XOF"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  seller_subscription_fee_shop: parseNonNegativeNumber(
                    value,
                    effective.seller_subscription_fee_shop
                  ),
                })
              }
              helper="Montant global applique aux boutiques classiques."
            />
            <AdminNumberField
              label="Abonnement restaurant"
              value={effective.seller_subscription_fee_restaurant}
              suffix="XOF"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  seller_subscription_fee_restaurant: parseNonNegativeNumber(
                    value,
                    effective.seller_subscription_fee_restaurant
                  ),
                })
              }
              helper="Montant global applique aux restaurants."
            />
            <AdminNumberField
              label="Abonnement premium"
              value={effective.seller_subscription_fee_premium}
              suffix="XOF"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  seller_subscription_fee_premium: parseNonNegativeNumber(
                    value,
                    effective.seller_subscription_fee_premium
                  ),
                })
              }
              helper="Montant global applique aux boutiques premium / mini-sites."
            />
            <AdminNumberField
              label="Max articles catalogue & menu (hors Premium)"
              value={effective.max_products_basic_tier}
              suffix="articles"
              min={1}
              step="1"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  max_products_basic_tier: parsePositiveInteger(value, effective.max_products_basic_tier),
                })
              }
              helper="Boutiques et restaurants en formule basic : plafond. Premium : illimite cote API."
            />
            <AdminNumberField
              label="Essai gratuit a l'inscription vendeur"
              value={effective.seller_trial_days ?? 0}
              suffix="jours"
              min={0}
              step="1"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  seller_trial_days: Math.min(365, Math.round(parseNonNegativeNumber(value, effective.seller_trial_days ?? 0))),
                })
              }
              helper="0 = pas d'essai. Exemple : 30 pour un premier mois gratuit. Accorde une seule fois par boutique."
            />
            <AdminNumberField
              label="Reduction de lancement sur l'abonnement"
              value={effective.seller_launch_discount_percent ?? 0}
              suffix="%"
              min={0}
              step="1"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  seller_launch_discount_percent: Math.min(
                    100,
                    parseNonNegativeNumber(value, effective.seller_launch_discount_percent ?? 0)
                  ),
                })
              }
              helper="0 = pas de reduction. S'applique aux tarifs ci-dessus, jamais aux tarifs negocies par boutique."
            />
            <AdminNumberField
              label="Abonnement revendeur (revente sans stock)"
              value={effective.reseller_subscription_fee ?? 500}
              suffix="XOF / mois"
              min={0}
              step="50"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  reseller_subscription_fee: parseNonNegativeNumber(value, effective.reseller_subscription_fee ?? 500),
                })
              }
              helper="0 = revente gratuite. L'essai gratuit vendeur s'applique aussi aux revendeurs."
            />
            <AdminNumberField
              label="Commission AMAZER sur la marge des revendeurs"
              value={effective.reseller_commission_percent ?? 10}
              suffix="%"
              min={0}
              step="1"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  reseller_commission_percent: Math.min(90, parseNonNegativeNumber(value, effective.reseller_commission_percent ?? 10)),
                })
              }
              helper="Prélevée sur chaque marge gagnée. Exemple : 10 % d'une marge de 1 500 XOF = 150 XOF pour AMAZER."
            />
            <AdminNumberField
              label="Affiliés : part des abonnements des vendeurs amenés"
              value={effective.affiliate_seller_share_percent ?? 20}
              suffix="%"
              min={0}
              step="1"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  affiliate_seller_share_percent: Math.min(90, parseNonNegativeNumber(value, effective.affiliate_seller_share_percent ?? 20)),
                })
              }
              helper="Prise sur l'abonnement encaissé (vendeurs et revendeurs). Exemple : 20 % de 5 000 XOF = 1 000 XOF pour l'affilié."
            />
            <AdminNumberField
              label="Affiliés : durée de la part d'abonnement"
              value={effective.affiliate_seller_share_months ?? 12}
              suffix="mois"
              min={1}
              step="1"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  affiliate_seller_share_months: Math.max(1, Math.min(120, Math.round(parseNonNegativeNumber(value, effective.affiliate_seller_share_months ?? 12)))),
                })
              }
              helper="Après cette durée depuis l'inscription du vendeur, l'affilié ne touche plus rien sur ses abonnements."
            />
            <AdminNumberField
              label="Affiliés : bonus par nouveau client"
              value={effective.affiliate_customer_bonus ?? 250}
              suffix="XOF"
              min={0}
              step="50"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  affiliate_customer_bonus: parseNonNegativeNumber(value, effective.affiliate_customer_bonus ?? 250),
                })
              }
              helper="Montant fixe payé par AMAZER pour la 1re commande livrée d'un client amené. 0 = désactivé."
            />
            {AFFILIATE_SECURITY_FIELDS.map((field) => (
              <AdminNumberField
                key={field.key}
                label={field.label}
                value={effective[field.key] ?? field.fallback}
                suffix={field.suffix}
                min={field.min}
                step={field.step}
                onChange={(value) =>
                  setDraft({
                    ...effective,
                    [field.key]: Math.max(
                      field.min,
                      Math.min(field.max, field.integer ? Math.round(parseNonNegativeNumber(value, field.fallback)) : parseNonNegativeNumber(value, field.fallback))
                    ),
                  })
                }
                helper={field.helper}
              />
            ))}
            <AdminNumberField
              label="Livraisons : réception confirmée automatiquement après"
              value={effective.auto_receipt_hours ?? 72}
              suffix="heures"
              min={24}
              step="12"
              onChange={(value) =>
                setDraft({
                  ...effective,
                  auto_receipt_hours: Math.max(24, Math.min(336, Math.round(parseNonNegativeNumber(value, effective.auto_receipt_hours ?? 72)))),
                })
              }
              helper="Si le client ne confirme pas, la commande « En livraison » passe « Reçu » après ce délai. Prévoyez assez pour les livraisons hors de Niamey (24 h à 14 jours)."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-1">
            <div>
              <p className="text-sm font-medium text-slate-800">Numéro wallet AMAZER (Nita / Amana)</p>
              <p className="text-xs text-slate-500">
                Affiche sur les recus clients comme destination des versements plateforme (prioritaire sur le telephone
                support si renseigne).
              </p>
              <input
                value={effective.platform_wallet_phone ?? ""}
                onChange={(event) =>
                  setDraft({ ...effective, platform_wallet_phone: event.target.value || null })
                }
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="+227 xx xx xx xx"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Email support</p>
              <input
                type="email"
                value={effective.support_email ?? ""}
                onChange={(event) => setDraft({ ...effective, support_email: event.target.value || null })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="support@amazer.ne"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Téléphone support</p>
              <input
                value={effective.support_phone ?? ""}
                onChange={(event) => setDraft({ ...effective, support_phone: event.target.value || null })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="+227 xx xx xx xx"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">WhatsApp support</p>
              <input
                value={effective.support_whatsapp ?? ""}
                onChange={(event) => setDraft({ ...effective, support_whatsapp: event.target.value || null })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="+227 xx xx xx xx"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-slate-800">Livraison depuis les pharmacies (numéro AMAZER)</p>
              <p className="text-xs text-slate-500">Bouton « Se faire livrer » des pharmacies. Vide = bouton masqué.</p>
              <input
                value={effective.pharmacy_delivery_phone ?? ""}
                onChange={(event) => setDraft({ ...effective, pharmacy_delivery_phone: event.target.value || null })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="+227 xx xx xx xx"
                inputMode="tel"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Commandes de gaz depuis les stations (numéro AMAZER)</p>
              <p className="text-xs text-slate-500">Bouton « Commander du gaz » : seul le gaz se livre, et seulement quand la station en indique. Vide = bouton masqué.</p>
              <input
                value={effective.fuel_delivery_phone ?? ""}
                onChange={(event) => setDraft({ ...effective, fuel_delivery_phone: event.target.value || null })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="+227 xx xx xx xx"
                inputMode="tel"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-slate-800">Villes où AMAZER livre (pharmacies et stations)</p>
              <p className="text-xs text-slate-500">
                Séparées par des virgules, par exemple : Niamey, Maradi, Zinder. Ailleurs, le bouton « Se faire livrer » reste masqué.
              </p>
              <input
                value={effective.local_delivery_cities ?? "Niamey"}
                onChange={(event) => setDraft({ ...effective, local_delivery_cities: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Niamey, Maradi, Zinder"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => saveMutation.mutate(effective)} className="bg-brand-600 text-white hover:bg-brand-700">
            Enregistrer
          </Button>
          <Button
            variant="outline"
            onClick={() => launchModeMutation.mutate(!effective.launch_mode_zero_commission)}
          >
            {effective.launch_mode_zero_commission ? "Désactiver 0% Commission" : "Activer 0% Commission"}
          </Button>
        </div>
      </article>

      <article id="quartiers" className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Frais de livraison par quartier</h2>
        <p className="mt-2 text-sm text-slate-600">Format: `Quartier:Montant` sur une ligne par quartier.</p>
        <textarea
          value={districtRaw}
          onChange={(event) => setDistrictDraft(event.target.value)}
          className="mt-3 min-h-36 w-full rounded-md border border-slate-300 p-3 text-sm"
          placeholder={"Centre Ville:1500\nYantala:2000"}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => districtMutation.mutate(parsedDistrictPayload)}
            variant="outline"
          >
            Enregistrer quartiers
          </Button>
          <p className="text-xs text-slate-500">
            {districtFees?.length ? `${districtFees.length} quartier(s) configures.` : "Aucun quartier configure."}
          </p>
        </div>
      </article>
        </>
      ) : null}

      {view === "vendeurs" ? (
      <article id="vendeurs" className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Vendeurs</h2>
        <p className="mt-1 text-sm text-ink-600">
          Activité, badge, abonnement et tarif. Retirer, restaurer ou supprimer un compte : « Gérer le compte » (page Utilisateurs).
        </p>
        <label className="mt-3 block">
          <span className="sr-only">Rechercher un vendeur</span>
          <input
            type="search"
            value={sellerSearch}
            onChange={(event) => setSellerSearch(event.target.value)}
            placeholder="Boutique, ville, téléphone ou e-mail"
            className="h-10 w-full rounded-field border border-border bg-card px-3 text-sm"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filtrer les vendeurs">
          {SELLER_FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={sellerFilter === key}
              onClick={() => setSellerFilter(key)}
              className={`min-h-9 rounded-pill border px-3 text-xs font-medium ${
                sellerFilter === key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
              }`}
            >
              {label} ({filterSellers(sellers ?? [], key, "").length})
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {visibleSellers.length === 0 ? (
            <p className="rounded-field border border-border p-4 text-sm text-ink-600">Aucun vendeur ne correspond.</p>
          ) : null}
          {visibleSellers.map((seller) => (
            <div key={seller.profile_id} className="rounded-field border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{seller.business_name}</p>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {seller.city}
                    {seller.phone ? ` · ${seller.phone}` : ""}
                    {seller.created_at ? ` · inscrit le ${new Date(seller.created_at).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs">
                    <span className="rounded-pill bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">{activityLabel(sellerActivity(seller))}</span>
                    {seller.is_verified ? <span className="rounded-pill bg-success/10 px-2 py-0.5 font-semibold text-success">Vérifié</span> : null}
                    {!seller.is_active ? <span className="rounded-pill bg-warning/15 px-2 py-0.5 font-semibold text-ink-800">Hors ligne</span> : null}
                    {seller.subscription_paid_until && new Date(seller.subscription_paid_until) > new Date() ? (
                      <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-ink-700">
                        Abonné jusqu&apos;au {new Date(seller.subscription_paid_until).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="rounded-pill bg-danger/10 px-2 py-0.5 font-semibold text-danger">
                        {seller.subscription_paid_until ? `Abonnement expiré le ${new Date(seller.subscription_paid_until).toLocaleDateString("fr-FR")}` : "Aucun abonnement"}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/admin/users?q=${encodeURIComponent(seller.email ?? seller.phone ?? seller.business_name)}`}
                  className="rounded-field border border-border px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-1"
                >
                  Gérer le compte
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-xs font-medium text-ink-700">
                  Activité
                  <select
                    value={sellerActivity(seller)}
                    disabled={activityMutation.isPending}
                    onChange={(event) =>
                      activityMutation.mutate({ profileId: seller.profile_id, activity: event.target.value as SellerActivity })
                    }
                    className="mt-1 block h-9 rounded-field border border-border bg-card px-2 text-sm text-ink-900"
                  >
                    {ACTIVITY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => verifySellerMutation.mutate({ profileId: seller.profile_id, verified: !seller.is_verified })}
                >
                  {seller.is_verified ? "Retirer le badge" : "Vérifier"}
                </Button>
                <Button
                  size="sm"
                  disabled={grantSubscriptionMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Activer 12 mois d'abonnement pour ${seller.business_name} sans paiement en ligne (payé à part) ?`)) {
                      grantSubscriptionMutation.mutate({ profileId: seller.profile_id, months: 12 });
                    }
                  }}
                >
                  Activer 12 mois
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={grantSubscriptionMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Offrir 1 mois gratuit à ${seller.business_name} ?`)) {
                      grantSubscriptionMutation.mutate({ profileId: seller.profile_id, months: 1 });
                    }
                  }}
                >
                  Offrir 1 mois
                </Button>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-ink-600">
                  Tarif personnalisé · commission {(seller.effective_commission_rate * 100).toFixed(2)} %, frais {seller.effective_service_fee} XOF,
                  abonnement {seller.effective_seller_subscription_fee} XOF
                </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <input
                  type="number"
                  step="0.01"
                  value={getSellerDraft(seller.profile_id, seller).commission}
                  onChange={(event) =>
                    setSellerPricingDrafts((prev) => ({
                      ...prev,
                      [seller.profile_id]: {
                        ...getSellerDraft(seller.profile_id, seller),
                        commission: event.target.value,
                      },
                    }))
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="Commission override %"
                />
                <input
                  type="number"
                  step="1"
                  value={getSellerDraft(seller.profile_id, seller).serviceFee}
                  onChange={(event) =>
                    setSellerPricingDrafts((prev) => ({
                      ...prev,
                      [seller.profile_id]: {
                        ...getSellerDraft(seller.profile_id, seller),
                        serviceFee: event.target.value,
                      },
                    }))
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="Frais override XOF"
                />
                <input
                  type="number"
                  step="1"
                  value={getSellerDraft(seller.profile_id, seller).subscriptionFee}
                  onChange={(event) =>
                    setSellerPricingDrafts((prev) => ({
                      ...prev,
                      [seller.profile_id]: {
                        ...getSellerDraft(seller.profile_id, seller),
                        subscriptionFee: event.target.value,
                      },
                    }))
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="Prix négocié par mois (XOF)"
                  title="Remplace le tarif calculé (ex. stations : abonnement + stations). Vide = tarif normal."
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    sellerPricingMutation.mutate({
                      profileId: seller.profile_id,
                      commissionRateOverride: getSellerDraft(seller.profile_id, seller).commission.trim()
                        ? parseNonNegativeNumber(
                            getSellerDraft(seller.profile_id, seller).commission,
                            seller.effective_commission_rate * 100
                          ) / 100
                        : null,
                      serviceFeeOverride: getSellerDraft(seller.profile_id, seller).serviceFee.trim()
                        ? parseNonNegativeNumber(
                            getSellerDraft(seller.profile_id, seller).serviceFee,
                            seller.effective_service_fee
                          )
                        : null,
                      sellerSubscriptionFeeOverride: getSellerDraft(seller.profile_id, seller).subscriptionFee.trim()
                        ? parseNonNegativeNumber(
                            getSellerDraft(seller.profile_id, seller).subscriptionFee,
                            seller.effective_seller_subscription_fee
                          )
                        : null,
                    })
                  }
                >
                  Enregistrer tarif boutique
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSellerPricingDrafts((prev) => ({
                      ...prev,
                      [seller.profile_id]: { commission: "", serviceFee: "", subscriptionFee: "" },
                    }));
                    sellerPricingMutation.mutate({
                      profileId: seller.profile_id,
                      commissionRateOverride: null,
                      serviceFeeOverride: null,
                      sellerSubscriptionFeeOverride: null,
                    });
                  }}
                >
                  Revenir au tarif global
                </Button>
              </div>
              </details>
            </div>
          ))}
        </div>
      </article>
      ) : null}

      {view === "historique" ? (
      <article id="audit" className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Historique des modifications</h2>
        <div className="mt-2">
          <button
            type="button"
            onClick={onExportAuditCsv}
            className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
        {isAuditError ? <p className="mt-3 text-sm text-amber-700">{getAdminFinanceDataError(auditError)}</p> : null}
        <div className="mt-3 space-y-2">
          {(auditHistory ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
              <p className="font-medium">{AUDIT_LABELS[item.event_type] ?? item.event_type}</p>
              <p>
                {new Date(item.created_at).toLocaleString("fr-FR")} | {item.actor_email ?? "system"} | IP {item.ip_address ?? "-"}
              </p>
            </div>
          ))}
        </div>
      </article>
      ) : null}

    </section>
  );
}
