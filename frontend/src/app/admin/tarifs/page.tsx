"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import {
  getAdminFinanceDataError,
  buildAdminFinanceVerifyPayload,
  getAdminFinanceVerifyError,
} from "@/lib/admin-finance-verification";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import {
  decideAdminPendingSeller,
  deleteAdminSeller,
  downloadAuditCsv,
  getAdminFinanceSettings,
  grantAdminSellerSubscription,
  listAdminDistrictFees,
  listAdminAuditHistory,
  listAdminPendingSellers,
  listAdminSellers,
  permanentlyDeleteAdminSeller,
  replaceAdminDistrictFees,
  restoreAdminSeller,
  setAdminSellerServiceKind,
  setAdminSellerTransport,
  toggleLaunchMode,
  updateAdminFinanceSettings,
  updateAdminSellerPricing,
  updateAdminSellerType,
  verifyAdminFinancePin,
  verifyAdminSeller,
} from "@/services/finance-service";
import { hasAdminFinanceVerified } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { AdminPendingSeller, FinanceSettings } from "@/types/finance";

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
  | "ambassador_monthly_top_bonus";

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

export default function AdminTarifsPage() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pinVerified, setPinVerified] = useState(() => hasAdminFinanceVerified());
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<FinanceSettings | null>(null);
  const [districtDraft, setDistrictDraft] = useState<string | null>(null);
  const [sellerPricingDrafts, setSellerPricingDrafts] = useState<
    Record<string, { commission: string; serviceFee: string; subscriptionFee: string }>
  >({});

  const pinMutation = useMutation({
    mutationFn: verifyAdminFinancePin,
    onSuccess: () => {
      setPinVerified(true);
      setStatus("Vérification admin valide. Acces tarifs autorise.");
      setPin("");
      setBirthDate("");
    },
    onError: (error) => setStatus(getAdminFinanceVerifyError(error)),
  });

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

  const deleteSellerMutation = useMutation({
    mutationFn: deleteAdminSeller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Vendeur retiré (désactivé). Tu peux le remettre en ligne a tout moment.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Retrait du vendeur impossible.")),
  });
  const restoreSellerMutation = useMutation({
    mutationFn: restoreAdminSeller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Vendeur remis en ligne.");
    },
    onError: () => setStatus("Remise en ligne impossible."),
  });
  const transportMutation = useMutation({
    mutationFn: ({ profileId, enabled }: { profileId: string; enabled: boolean }) =>
      setAdminSellerTransport(profileId, enabled),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus(
        vars.enabled
          ? "Entreprise marquee Transport : reservation de trajets activee."
          : "Fonction Transport retiree.",
      );
    },
    onError: () => setStatus("Impossible de changer la fonction Transport."),
  });
  const serviceKindMutation = useMutation({
    mutationFn: ({ profileId, kind }: { profileId: string; kind: "pharmacy" | "fuel_station" | "none" }) =>
      setAdminSellerServiceKind(profileId, kind),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus(
        vars.kind === "pharmacy"
          ? "Vitrine marquée Pharmacie : elle peut indiquer ses gardes."
          : vars.kind === "fuel_station"
            ? "Vitrine marquée Station-essence : elle peut indiquer ses disponibilités."
            : "Vitrine remise en vitrine normale.",
      );
    },
    onError: () => setStatus("Impossible de changer le type de service."),
  });
  const permanentDeleteSellerMutation = useMutation({
    mutationFn: permanentlyDeleteAdminSeller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Vendeur supprime définitivement. Son email est de nouveau disponible.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Suppression definitive impossible.")),
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
      setStatus("Abonnement accorde. La boutique est maintenant visible.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Impossible d'accorder l'abonnement.")),
  });

  const { data: pendingSellers } = useQuery({
    queryKey: ["admin-pending-sellers"],
    queryFn: () => listAdminPendingSellers("pending"),
    enabled: pinVerified,
    refetchInterval: 30000,
  });

  const pendingSellerDecisionMutation = useMutation({
    mutationFn: ({ regId, decision, adminNote }: { regId: string; decision: "approved" | "rejected"; adminNote?: string }) =>
      decideAdminPendingSeller(regId, { decision, admin_note: adminNote }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus(result.status === "approved" ? "Compte vendeur cree et boutique activee." : "Demande rejetee.");
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Impossible de traiter la demande.")),
  });

  const sellerTypeMutation = useMutation({
    mutationFn: ({ profileId, activityType, storefrontTier }: { profileId: string; activityType: string; storefrontTier: string }) =>
      updateAdminSellerType(profileId, { activity_type: activityType, storefront_tier: storefrontTier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Type de boutique mis a jour.");
    },
    onError: () => setStatus("Impossible de changer le type de boutique."),
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

  if (!pinVerified) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h1 className="luxury-title text-2xl font-semibold">Panneau Tarifs Admin</h1>
          <p className="mt-2 text-sm text-slate-600">Acces protege par MFA + secret admin + cle secondaire.</p>
          <p className="mt-1 text-xs text-slate-500">
            Si tu inverses la date et le PIN, l&apos;app corrige automatiquement.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <PasswordInput
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN admin"
              masking="password"
              wrapperClassName="min-w-0 flex-1"
            />
            <PasswordInput
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              placeholder="Date secondaire JJ/MM/AA"
              masking="text"
              autoComplete="off"
              wrapperClassName="min-w-0 flex-1"
            />
            <Button
              onClick={() => pinMutation.mutate(buildAdminFinanceVerifyPayload(pin, birthDate))}
              disabled={!pin || !birthDate}
            >
              Vérifier
            </Button>
          </div>
          {status ? <p className="mt-2 text-sm text-slate-700">{status}</p> : null}
        </article>
      </section>
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
              <Button type="button" onClick={() => setPinVerified(false)}>
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
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Controle Admin</h1>
        <p className="mt-2 text-sm text-slate-600">Commission, frais, abonnements, vendeurs et inscriptions.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#tarifs" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Tarifs & Frais</a>
          <a href="#inscriptions" className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-brand-600 font-medium hover:bg-orange-100">
            Inscriptions en attente {pendingSellers?.length ? `(${pendingSellers.length})` : ""}
          </a>
          <a href="#vendeurs" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">
            Vendeurs {sellers?.length ? `(${sellers.length})` : ""}
          </a>
          <a href="#quartiers" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Frais quartiers</a>
          <a href="#audit" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Historique</a>
          <Link href="/admin/catalog" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Catégories</Link>
          <Link href="/admin/sections" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Sections</Link>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => setPinVerified(false)}
        >
          Verrouiller
        </Button>
      </header>

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
              <p className="text-sm font-medium text-slate-800">Livraison depuis les stations (numéro AMAZER)</p>
              <p className="text-xs text-slate-500">Bouton « Se faire livrer » des stations (gaz, carburant). Vide = bouton masqué.</p>
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

      {(pendingSellers ?? []).length > 0 && (
        <article id="inscriptions" className="premium-card border border-orange-200 bg-orange-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Inscriptions en attente{" "}
            <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">
              {pendingSellers!.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Verifiez le paiement sur votre Nita (+227 96 95 31 63) avant de confirmer.
          </p>
          <div className="mt-3 space-y-3">
            {pendingSellers!.map((reg: AdminPendingSeller) => (
              <div key={reg.id} className="rounded-lg border border-orange-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{reg.business_name || reg.full_name}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {reg.full_name} &middot; {reg.identifier}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Type : {reg.activity_type} &middot; {reg.months} mois &middot; {reg.payment_mode?.toUpperCase()}
                    </p>
                    {reg.transaction_reference ? (
                      <p className="mt-0.5 text-xs font-medium text-slate-700">
                        Ref : {reg.transaction_reference}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-amber-600">Aucune référence fournie</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(reg.submitted_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 text-white hover:bg-green-700"
                      disabled={pendingSellerDecisionMutation.isPending}
                      onClick={() => pendingSellerDecisionMutation.mutate({ regId: reg.id, decision: "approved" })}
                    >
                      Confirmer paiement
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      disabled={pendingSellerDecisionMutation.isPending}
                      onClick={() => pendingSellerDecisionMutation.mutate({ regId: reg.id, decision: "rejected" })}
                    >
                      Rejeter
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      <article id="vendeurs" className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Vendeurs</h2>
        <div className="mt-3 space-y-2">
          {(sellers ?? []).slice(0, 120).map((seller) => (
            <div key={seller.profile_id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {seller.business_name}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {seller.is_verified ? "Vérifié" : "Non vérifié"} &middot;{" "}
                      {seller.is_active ? "Actif" : "Désactivé"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {seller.city}
                    {seller.phone ? ` · ${seller.phone}` : ""}
                    {seller.created_at
                      ? ` · Créé le ${new Date(seller.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Commission {(seller.effective_commission_rate * 100).toFixed(2)}% | Frais{" "}
                    {seller.effective_service_fee} XOF | Abonnement {seller.effective_seller_subscription_fee} XOF
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    Type: <span className="text-brand-600">{seller.activity_type}</span> | Tier:{" "}
                    <span className="text-brand-600">{seller.storefront_tier}</span>
                    {seller.is_enterprise ? (
                      <span className="ml-1 rounded-full border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Entreprise
                      </span>
                    ) : null}
                    {seller.offers_transport ? (
                      <span className="ml-1 rounded-full border border-cyan-300 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                        Transport
                      </span>
                    ) : null}
                    {seller.service_kind ? (
                      <span className="ml-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {seller.service_kind === "pharmacy" ? "Pharmacie" : "Station"}
                      </span>
                    ) : null}
                    {" | "}
                    {seller.subscription_paid_until ? (
                      <span className={new Date(seller.subscription_paid_until) > new Date() ? "text-green-600" : "text-rose-600"}>
                        Abonnement{" "}
                        {new Date(seller.subscription_paid_until) > new Date() ? "actif jusqu'au " : "expiré le "}
                        {new Date(seller.subscription_paid_until).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="font-semibold text-rose-600">Aucun abonnement actif</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      verifySellerMutation.mutate({
                        profileId: seller.profile_id,
                        verified: !seller.is_verified,
                      })
                    }
                  >
                    {seller.is_verified ? "Retirer badge" : "Vérifier"}
                  </Button>
                  <Button
                    size="sm"
                    className="border border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                    onClick={() =>
                      grantSubscriptionMutation.mutate({
                        profileId: seller.profile_id,
                        months: 12,
                      })
                    }
                  >
                    Activer 12 mois
                  </Button>
                  {seller.storefront_tier !== "premium" ? (
                    <Button
                      size="sm"
                      className="border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      onClick={() =>
                        sellerTypeMutation.mutate({
                          profileId: seller.profile_id,
                          activityType: "enterprise",
                          storefrontTier: "premium",
                        })
                      }
                    >
                      Passer Premium
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      onClick={() =>
                        sellerTypeMutation.mutate({
                          profileId: seller.profile_id,
                          activityType: "shop",
                          storefrontTier: "basic",
                        })
                      }
                    >
                      Rétrograder Basic
                    </Button>
                  )}
                  {seller.offers_transport ? (
                    <Button
                      size="sm"
                      className="border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      disabled={transportMutation.isPending}
                      onClick={() => transportMutation.mutate({ profileId: seller.profile_id, enabled: false })}
                    >
                      Retirer Transport
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                      disabled={transportMutation.isPending}
                      onClick={() => transportMutation.mutate({ profileId: seller.profile_id, enabled: true })}
                    >
                      Marquer Transport
                    </Button>
                  )}
                  <select
                    aria-label="Service de proximité"
                    title="Pharmacie ou station-essence"
                    value={seller.service_kind ?? "none"}
                    disabled={serviceKindMutation.isPending}
                    onChange={(event) =>
                      serviceKindMutation.mutate({
                        profileId: seller.profile_id,
                        kind: event.target.value as "pharmacy" | "fuel_station" | "none",
                      })
                    }
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
                  >
                    <option value="none">Ni pharmacie ni station</option>
                    <option value="pharmacy">Pharmacie</option>
                    <option value="fuel_station">Station-essence</option>
                  </select>
                  <select
                    aria-label="Type d'activité du vendeur"
                    title="Type d'activité"
                    value={seller.activity_type}
                    onChange={(event) =>
                      sellerTypeMutation.mutate({
                        profileId: seller.profile_id,
                        activityType: event.target.value,
                        storefrontTier: seller.storefront_tier,
                      })
                    }
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
                  >
                    <option value="shop">Boutique</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="enterprise">Premium</option>
                  </select>
                  {seller.is_active ? (
                    <Button
                      size="sm"
                      className="border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      disabled={deleteSellerMutation.isPending}
                      onClick={() => deleteSellerMutation.mutate(seller.profile_id)}
                    >
                      Retirer
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="border border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                        disabled={restoreSellerMutation.isPending}
                        onClick={() => restoreSellerMutation.mutate(seller.profile_id)}
                      >
                        Remettre en ligne
                      </Button>
                      <Button
                        size="sm"
                        className="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        disabled={permanentDeleteSellerMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Supprimer DEFINITIVEMENT "${seller.business_name}" ?\n\nLe compte sera anonymise et son email libere. L'historique des commandes est conserve. Action irréversible.`,
                            )
                          ) {
                            permanentDeleteSellerMutation.mutate(seller.profile_id);
                          }
                        }}
                      >
                        Supprimer definitivement
                      </Button>
                    </>
                  )}
                </div>
              </div>
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
                  placeholder="Abonnement override XOF"
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
            </div>
          ))}
        </div>
      </article>

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
              <p className="font-medium">{item.event_type}</p>
              <p>
                {new Date(item.created_at).toLocaleString("fr-FR")} | {item.actor_email ?? "system"} | IP {item.ip_address ?? "-"}
              </p>
            </div>
          ))}
        </div>
      </article>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
