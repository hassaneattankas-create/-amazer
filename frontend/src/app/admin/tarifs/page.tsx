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
  setAdminSellerEnterprise,
  toggleLaunchMode,
  updateAdminFinanceSettings,
  updateAdminSellerPricing,
  updateAdminSellerType,
  verifyAdminFinancePin,
  verifyAdminSeller,
} from "@/services/finance-service";
import { hasAdminFinanceVerified } from "@/lib/api";
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
      setStatus("Verification admin valide. Acces tarifs autorise.");
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
      setStatus("Vendeur retire (desactive). Tu peux le remettre en ligne a tout moment.");
    },
    onError: () => setStatus("Retrait du vendeur impossible."),
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
  const enterpriseMutation = useMutation({
    mutationFn: ({ profileId, enabled }: { profileId: string; enabled: boolean }) =>
      setAdminSellerEnterprise(profileId, enabled),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus(
        vars.enabled
          ? "Vendeur passe en Premium Entreprise. Reservations, import et export debloques."
          : "Premium Entreprise retire.",
      );
    },
    onError: () => setStatus("Impossible de changer le niveau Entreprise."),
  });
  const permanentDeleteSellerMutation = useMutation({
    mutationFn: permanentlyDeleteAdminSeller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Vendeur supprime definitivement. Son email est de nouveau disponible.");
    },
    onError: () => setStatus("Suppression definitive impossible."),
  });

  const verifySellerMutation = useMutation({
    mutationFn: ({ profileId, verified }: { profileId: string; verified: boolean }) =>
      verifyAdminSeller(profileId, verified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Statut vendeur mis a jour.");
    },
    onError: () => setStatus("Verification vendeur impossible."),
  });
  const grantSubscriptionMutation = useMutation({
    mutationFn: ({ profileId, months }: { profileId: string; months: number }) =>
      grantAdminSellerSubscription(profileId, months),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-history"] });
      setStatus("Abonnement accorde. La boutique est maintenant visible.");
    },
    onError: () => setStatus("Impossible d'accorder l'abonnement."),
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
    onError: () => setStatus("Impossible de traiter la demande."),
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
      setStatus("Tarification boutique mise a jour.");
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
          <a href="#inscriptions" className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-[#FF4D00] font-medium hover:bg-orange-100">
            Inscriptions en attente {pendingSellers?.length ? `(${pendingSellers.length})` : ""}
          </a>
          <a href="#vendeurs" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">
            Vendeurs {sellers?.length ? `(${sellers.length})` : ""}
          </a>
          <a href="#quartiers" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Frais quartiers</a>
          <a href="#audit" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Historique</a>
          <Link href="/admin/catalog" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Categories</Link>
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
              label="Livraison peripherique"
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
          </div>
          <div className="grid gap-3 sm:grid-cols-1">
            <div>
              <p className="text-sm font-medium text-slate-800">Numero wallet AMAZER (Nita / Amana)</p>
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
              <p className="text-sm font-medium text-slate-800">Telephone support</p>
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => saveMutation.mutate(effective)} className="bg-[#FF4D00] text-white hover:bg-[#e74700]">
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
            <span className="ml-1 rounded-full bg-[#FF4D00] px-2 py-0.5 text-xs text-white">
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
                      <p className="mt-0.5 text-xs text-amber-600">Aucune reference fournie</p>
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
                    Type: <span className="text-[#FF4D00]">{seller.activity_type}</span> | Tier:{" "}
                    <span className="text-[#FF4D00]">{seller.storefront_tier}</span>
                    {seller.is_enterprise ? (
                      <span className="ml-1 rounded-full border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Entreprise
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
                  {seller.is_enterprise ? (
                    <Button
                      size="sm"
                      className="border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      disabled={enterpriseMutation.isPending}
                      onClick={() => enterpriseMutation.mutate({ profileId: seller.profile_id, enabled: false })}
                    >
                      Retirer Entreprise
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                      disabled={enterpriseMutation.isPending}
                      onClick={() => enterpriseMutation.mutate({ profileId: seller.profile_id, enabled: true })}
                    >
                      Passer Premium Entreprise
                    </Button>
                  )}
                  <select
                    aria-label="Type d'activite du vendeur"
                    title="Type d'activite"
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
                    <option value="transport">Transport</option>
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
                              `Supprimer DEFINITIVEMENT "${seller.business_name}" ?\n\nLe compte sera anonymise et son email libere. L'historique des commandes est conserve. Action irreversible.`,
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
