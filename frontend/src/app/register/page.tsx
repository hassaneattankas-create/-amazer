"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, Store, UtensilsCrossed } from "lucide-react";

import { PasswordInput } from "@/components/PasswordInput";
import { PremiumSellerPitch } from "@/components/PremiumSellerPitch";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage, getHttpResponseStatus } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { login, register, verifyAccount, type RegisterResponse } from "@/services/auth-service";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { paySellerSubscription } from "@/services/seller-service";
import type { FinanceSettings } from "@/types/finance";
import type { SellerActivityType, StorefrontTier } from "@/types/seller";

const PASSWORD_MIN_LENGTH = 8;

type SellerRegistrationType = "shop" | "restaurant" | "enterprise";

const SELLER_TYPE_OPTIONS: Array<{
  value: SellerRegistrationType;
  title: string;
  description: string;
  icon: typeof Store;
}> = [
  {
    value: "shop",
    title: "Boutique",
    description: "Catalogue produits et stock vendeur.",
    icon: Store,
  },
  {
    value: "restaurant",
    title: "Restaurant",
    description: "Menu, commandes et reservations.",
    icon: UtensilsCrossed,
  },
  {
    value: "enterprise",
    title: "Premium",
    description: "Mini-site complet avec services et options avancees.",
    icon: Building2,
  },
];

function sellerSubscriptionFee(settings: FinanceSettings, sellerType: SellerRegistrationType): number {
  if (sellerType === "restaurant") {
    return settings.seller_subscription_fee_restaurant;
  }
  if (sellerType === "enterprise") {
    return settings.seller_subscription_fee_premium;
  }
  return settings.seller_subscription_fee_shop;
}

function buildSellerProfilePayload(
  sellerType: SellerRegistrationType,
  fullName: string,
  businessName: string,
) {
  const activityType: SellerActivityType = sellerType;
  const storefrontTier: StorefrontTier = sellerType === "enterprise" ? "premium" : "basic";
  return {
    business_name: businessName.trim() || fullName.trim(),
    activity_type: activityType,
    storefront_tier: storefrontTier,
    city: "Niamey",
  };
}

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [sellerType, setSellerType] = useState<SellerRegistrationType>("shop");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<{
    channel: string;
    masked: string;
    preview: string | null;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [paymentMode, setPaymentMode] = useState<"nita" | "amana">("nita");
  const [subscriptionMonths, setSubscriptionMonths] = useState(1);
  const [transactionRef, setTransactionRef] = useState("");

  const paymentRef = useRef<{
    payment_mode: "nita" | "amana";
    months: number;
    transaction_reference: string;
  }>({ payment_mode: "nita", months: 1, transaction_reference: "" });

  const next = searchParams.get("next") || "/";
  const isSellerFlow = useMemo(
    () => searchParams.get("seller") === "1" || next.startsWith("/seller"),
    [next, searchParams]
  );

  function updatePaymentMode(mode: "nita" | "amana") {
    setPaymentMode(mode);
    paymentRef.current.payment_mode = mode;
  }
  function updateSubscriptionMonths(months: number) {
    const clamped = Math.max(1, Math.min(12, months));
    setSubscriptionMonths(clamped);
    paymentRef.current.months = clamped;
  }
  function updateTransactionRef(ref: string) {
    setTransactionRef(ref);
    paymentRef.current.transaction_reference = ref;
  }

  const { data: sellerPricing, isPending: sellerPricingPending, isError: sellerPricingError } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
    enabled: isSellerFlow,
    staleTime: 60_000,
  });

  async function finalizeRedirect() {
    if (isSellerFlow) {
      try {
        await paySellerSubscription({
          payment_mode: paymentRef.current.payment_mode,
          months: paymentRef.current.months,
          transaction_reference: paymentRef.current.transaction_reference.trim() || undefined,
        });
      } catch {
        // La demande peut etre resoumise depuis le tableau de bord vendeur si elle echoue.
      }
    }
    const sellerTarget = `/seller?welcome=1&type=${sellerType}`;
    const target = isSellerFlow ? sellerTarget : next.startsWith("/") ? next : "/";
    window.location.assign(target);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      const reg: RegisterResponse = await register({
        identifier: identifier.trim(),
        full_name: fullName.trim(),
        password,
        seller_profile: isSellerFlow
          ? buildSellerProfilePayload(sellerType, fullName, businessName)
          : undefined,
      });
      if (reg.verification_channel && reg.verification_channel !== "none") {
        setPendingVerification({
          channel: reg.verification_channel,
          masked: reg.verification_destination_masked,
          preview: reg.verification_code_preview,
        });
        return;
      }
      try {
        await login({
          identifier: identifier.trim(),
          password,
        });
      } catch (loginError) {
        if (getHttpResponseStatus(loginError) === 403) {
          setPendingVerification({
            channel: "retry",
            masked: identifier.trim(),
            preview: null,
          });
          return;
        }
        throw loginError;
      }
      await finalizeRedirect();
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Inscription impossible. Verifiez les informations saisies."));
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await verifyAccount({ identifier: identifier.trim(), code: verifyCode });
      await login({
        identifier: identifier.trim(),
        password,
      });
      await finalizeRedirect();
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Verification impossible. Verifiez le code."));
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit =
    fullName.trim().length >= 2 &&
    identifier.trim().length >= 6 &&
    password.length >= PASSWORD_MIN_LENGTH &&
    acceptedLegal &&
    (!isSellerFlow || (businessName.trim().length >= 2 || fullName.trim().length >= 2));

  const canVerify = verifyCode.trim().length >= 4 && identifier.trim().length >= 6;

  if (pendingVerification) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h1 className="luxury-title text-3xl font-semibold">Verifier votre compte</h1>
          <p className="mt-2 text-sm text-slate-600">
            {pendingVerification.channel === "retry" ? (
              <>
                Saisissez le code recu par WhatsApp ou e-mail pour{" "}
                <span className="font-medium text-slate-900">{pendingVerification.masked}</span>.
              </>
            ) : (
              <>
                Un code a ete envoye
                {pendingVerification.channel === "whatsapp"
                  ? " par WhatsApp"
                  : pendingVerification.channel === "email"
                    ? " par e-mail"
                    : ""}{" "}
                vers <span className="font-medium text-slate-900">{pendingVerification.masked}</span>.
              </>
            )}
          </p>
          {pendingVerification.preview ? (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Code de developpement (non visible en production): {pendingVerification.preview}
            </p>
          ) : null}
          <form onSubmit={onVerifySubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="verify-code">
                Code a 6 chiffres
              </label>
              <input
                id="verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest"
                placeholder="000000"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !canVerify}
              className="primary-glow-btn w-full text-white"
            >
              {isLoading ? "Verification..." : "Activer mon compte"}
            </Button>
            <button
              type="button"
              className="text-sm text-[#FF4D00] hover:underline"
              onClick={() => {
                setPendingVerification(null);
                setVerifyCode("");
                setStatus("");
              }}
            >
              Retour a l inscription
            </button>
          </form>
          {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">
          {isSellerFlow ? "Compte vendeur" : "Creer un compte"}
        </h1>
        {!isSellerFlow ? (
          <p className="mt-1 text-sm text-slate-500">
            Vendeur ?{" "}
            <Link href="/vendre" className="font-medium text-[#FF4D00] hover:underline">
              Creer un compte vendeur
            </Link>
          </p>
        ) : null}

        <PremiumSellerPitch variant="compact" className="mt-4" showEspaceVendeurLink={false} />

        {isSellerFlow ? (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {SELLER_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = sellerType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSellerType(option.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? "border-[#FF4D00]/45 bg-orange-50 shadow-[0_8px_30px_rgba(255,77,0,0.12)]"
                      : "border-slate-200 bg-white hover:border-[#FF4D00]/30"
                  }`}
                >
                  <Icon className="h-5 w-5 text-[#FF4D00]" />
                  <p className="mt-3 font-semibold text-slate-900">{option.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                  {sellerPricingPending ? (
                    <p className="mt-2 text-xs text-slate-500">Tarif vendeur&nbsp;: chargement...</p>
                  ) : sellerPricingError || !sellerPricing ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Tarif vendeur&nbsp;: momentanément indisponible
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">
                      Abonnement vendeur&nbsp;:{" "}
                      <span className="text-[#FF4D00]">
                        {formatXOF(sellerSubscriptionFee(sellerPricing, option.value))}
                      </span>
                      <span className="font-normal text-slate-600"> / mois</span>
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
        {isSellerFlow ? (
          <p className="mt-3 text-xs text-slate-500">
            Remplis le formulaire, envoie le virement et soumets. L&apos;admin valide — tu recois une notification.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isSellerFlow ? (
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="business-name">
                Nom de la boutique
                <span className="ml-1 text-xs font-normal text-slate-500">(optionnel)</span>
              </label>
              <input
                id="business-name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ex: Boutique Amazer, Restaurant Amazer... sinon ton nom sera utilise"
              />
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="full-name">
              Nom complet
            </label>
            <input
              id="full-name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="identifier">
              E-mail ou WhatsApp (+227)
            </label>
            <input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="email@domaine.com ou +22790000000"
            />
          </div>

          <div>
            <PasswordInput
              id="password"
              label="Mot de passe"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Minimum {PASSWORD_MIN_LENGTH} caracteres.
            </p>
          </div>

          {isSellerFlow ? (
            <div className="space-y-3 rounded-2xl border border-[#FF4D00]/25 bg-orange-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Paiement de l&apos;abonnement vendeur</p>
              {sellerPricing ? (
                <p className="text-xs text-slate-600">
                  Montant total :{" "}
                  <span className="font-semibold text-[#FF4D00]">
                    {formatXOF(sellerSubscriptionFee(sellerPricing, sellerType) * subscriptionMonths)}
                  </span>{" "}
                  pour {subscriptionMonths} mois.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Mode de paiement</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => updatePaymentMode(e.target.value as "nita" | "amana")}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="nita">Versement via Nita</option>
                    <option value="amana">Versement via Amana</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Nombre de mois</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={subscriptionMonths}
                    onChange={(e) => updateSubscriptionMonths(Number(e.target.value))}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Reference de transaction
                    <span className="ml-1 font-normal text-slate-400">(optionnelle)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: TXN123456"
                    value={transactionRef}
                    onChange={(e) => updateTransactionRef(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Envoie le montant ci-dessus via {paymentMode === "nita" ? "Nita" : "Amana"} au numero AMAZER,
                saisis la reference et soumets. L&apos;admin validera et tu recevras une notification.
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(event) => setAcceptedLegal(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              J accepte la{" "}
              <Link href="/legal/privacy" className="font-medium text-[#FF4D00] hover:underline">
                politique de confidentialite
              </Link>{" "}
              et les{" "}
              <Link href="/legal/terms" className="font-medium text-[#FF4D00] hover:underline">
                conditions d utilisation
              </Link>
              .
            </span>
          </label>

          <Button
            type="submit"
            disabled={isLoading || !canSubmit}
            className="primary-glow-btn w-full text-white"
          >
            {isLoading ? "Traitement..." : isSellerFlow ? "Creer mon compte et soumettre le paiement" : "Creer mon compte"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Deja inscrit ?{" "}
          <Link
            href={isSellerFlow ? "/login?next=/seller" : "/login"}
            className="font-medium text-[#FF4D00] hover:underline"
          >
            Se connecter
          </Link>
        </p>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-xl px-4 py-10">
          <ProductCardSkeleton />
        </section>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
