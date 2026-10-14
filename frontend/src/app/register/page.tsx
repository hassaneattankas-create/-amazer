"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Copy, Store, UtensilsCrossed } from "lucide-react";

import { PasswordInput } from "@/components/PasswordInput";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { COUNTRIES, findCountry } from "@/lib/locale";
import { useLocaleStore } from "@/store/locale-store";
import { getApiErrorMessage, getHttpResponseStatus } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { login, preRegisterSeller, register, verifyAccount, type RegisterResponse } from "@/services/auth-service";
import { setPendingSellerPreReg } from "@/lib/pending-seller";
import { getPublicFinanceSettings } from "@/services/finance-service";
import type { FinanceSettings } from "@/types/finance";
import type { SellerActivityType, StorefrontTier } from "@/types/seller";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Memes regles que le serveur, affichees en direct (pas de refus surprise a l'envoi).
const MONTH_CHOICES = [1, 3, 6, 12] as const;
const FALLBACK_WALLET = "+227 96 95 31 63";

const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: "8 caractères minimum", test: (v) => v.length >= 8 },
  { label: "Une minuscule et une majuscule", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "Un chiffre", test: (v) => /\d/.test(v) },
  { label: "Un caractère spécial (ex. ! ? @ #)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

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
    description: "Vos produits en ligne",
    icon: Store,
  },
  {
    value: "restaurant",
    title: "Restaurant",
    description: "Menu, commandes, tables",
    icon: UtensilsCrossed,
  },
  {
    value: "enterprise",
    title: "Premium",
    description: "Hôtel, transport, entreprise",
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
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const localePrefs = useLocaleStore();
  const [countryCode, setCountryCode] = useState(localePrefs.country);
  const [region, setRegion] = useState(localePrefs.region);
  // Numero complet : l'indicatif suit le pays choisi (sauf si le numero commence deja par +).
  const dialCode = findCountry(countryCode).dial;
  const phoneDigits = phoneLocal.replace(/[^\d+]/g, "");
  const fullPhone = !phoneDigits
    ? ""
    : phoneDigits.startsWith("+")
      ? phoneDigits
      : `${dialCode}${phoneDigits.replace(/^0+/, "")}`;
  const emailValid = !email.trim() || EMAIL_PATTERN.test(email.trim());
  const phoneValid = !phoneDigits || /^\+\d{8,15}$/.test(fullPhone);
  // Connexion avec l'un ou l'autre ; les deux permettent de recevoir les notifications partout.
  const identifier = email.trim() || fullPhone;
  const passwordRules = PASSWORD_RULES.map((rule) => ({ label: rule.label, ok: rule.test(password) }));
  const passwordValid = passwordRules.every((rule) => rule.ok);
  const [businessName, setBusinessName] = useState("");
  // Formule choisie sur la page « Vendre » (?type=shop|restaurant|enterprise).
  const [sellerType, setSellerType] = useState<SellerRegistrationType>(() => {
    const requested = searchParams.get("type");
    return requested === "restaurant" || requested === "enterprise" ? requested : "shop";
  });
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
  const [preRegSubmitted, setPreRegSubmitted] = useState(false);

  const next = searchParams.get("next") || "/";
  const isSellerFlow = useMemo(
    () => searchParams.get("seller") === "1" || next.startsWith("/seller"),
    [next, searchParams]
  );

  function updateSubscriptionMonths(months: number) {
    setSubscriptionMonths(Math.max(1, Math.min(12, months)));
  }

  const { data: sellerPricing, isPending: sellerPricingPending, isError: sellerPricingError } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
    enabled: isSellerFlow,
    staleTime: 60_000,
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      if (isSellerFlow) {
        // Flux vendeur : pre-inscription, pas de compte cree avant confirmation admin
        const preReg = await preRegisterSeller({
          full_name: fullName.trim(),
          identifier: identifier.trim(),
          password,
          business_name: businessName.trim() || fullName.trim(),
          activity_type: sellerType,
          storefront_tier: sellerType === "enterprise" ? "premium" : "basic",
          payment_mode: paymentMode,
          months: subscriptionMonths,
          transaction_reference: transactionRef.trim() || undefined,
        });
        // Memorise la demande sur l'appareil pour pouvoir notifier l'activation
        // du compte directement dans l'app, meme avant connexion.
        setPendingSellerPreReg({
          id: preReg.id,
          identifier: identifier.trim(),
          businessName: businessName.trim() || fullName.trim(),
        });
        setPreRegSubmitted(true);
        return;
      }
      const country = findCountry(countryCode);
      // La devise suit le pays choisi, sauf si le visiteur en a deja choisi une autre.
      const currency = localePrefs.chosen ? localePrefs.currency : country.currency;
      localePrefs.setPreferences({ country: country.code, region: region.trim(), currency }, { chosen: true });
      const reg: RegisterResponse = await register({
        identifier: identifier.trim(),
        full_name: fullName.trim(),
        password,
        email: email.trim() || undefined,
        whatsapp_phone: fullPhone || undefined,
        country_code: country.code,
        region: region.trim(),
        preferred_currency: currency,
        preferred_language: localePrefs.language,
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
        await login({ identifier: identifier.trim(), password });
      } catch (loginError) {
        if (getHttpResponseStatus(loginError) === 403) {
          setPendingVerification({ channel: "retry", masked: identifier.trim(), preview: null });
          return;
        }
        throw loginError;
      }
      const target = next.startsWith("/") ? next : "/";
      window.location.assign(target);
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Inscription impossible. Vérifiez les informations saisies."));
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
      await login({ identifier: identifier.trim(), password });
      window.location.assign(next.startsWith("/") ? next : "/");
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Vérification impossible. Vérifiez le code."));
    } finally {
      setIsLoading(false);
    }
  }

  const monthlyFee = sellerPricing ? sellerSubscriptionFee(sellerPricing, sellerType) : null;
  const totalAmount = monthlyFee !== null ? monthlyFee * subscriptionMonths : null;

  const canSubmit =
    fullName.trim().length >= 2 &&
    identifier.length >= 6 &&
    emailValid &&
    phoneValid &&
    passwordValid &&
    acceptedLegal &&
    (!isSellerFlow || ((businessName.trim().length >= 2 || fullName.trim().length >= 2) && transactionRef.trim().length >= 4));

  const canVerify = verifyCode.trim().length >= 4 && identifier.trim().length >= 6;
  const walletNumber = sellerPricing?.platform_wallet_phone || FALLBACK_WALLET;

  if (preRegSubmitted) {
    return (
      <section className="mx-auto max-w-xl px-gutter py-8">
        <article className="rounded-card border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-semibold text-ink-900">Demande envoyée</h1>
          <p className="mt-2 text-sm text-ink-700">
            Nous vérifions votre paiement sur le <span className="font-semibold">{walletNumber}</span>. Votre boutique est
            créée dès la confirmation.
          </p>
          <p className="mt-2 text-sm text-ink-600">
            Vous serez prévenu ici, même sans être connecté. Vous pourrez ensuite vous connecter avec{" "}
            <span className="font-medium text-ink-900">{identifier}</span>.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </article>
      </section>
    );
  }

  if (pendingVerification) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <article className="rounded-card border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold text-ink-900">Vérifier votre compte</h1>
          <p className="mt-2 text-sm text-ink-600">
            {pendingVerification.channel === "retry" ? (
              <>
                Saisissez le code reçu par WhatsApp ou e-mail pour{" "}
                <span className="font-medium text-ink-900">{pendingVerification.masked}</span>.
              </>
            ) : (
              <>
                Un code a été envoyé
                {pendingVerification.channel === "whatsapp"
                  ? " par WhatsApp"
                  : pendingVerification.channel === "email"
                    ? " par e-mail"
                    : ""}{" "}
                vers <span className="font-medium text-ink-900">{pendingVerification.masked}</span>.
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
              <label className="text-sm font-medium text-ink-800" htmlFor="verify-code">
                Code a 6 chiffres
              </label>
              <input
                id="verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                className="mt-1 w-full h-11 rounded-field border border-border bg-card px-3 text-sm tracking-widest"
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
              className="text-sm text-brand-600 hover:underline"
              onClick={() => {
                setPendingVerification(null);
                setVerifyCode("");
                setStatus("");
              }}
            >
              Retour a l inscription
            </button>
          </form>
          {status ? <p className="mt-3 text-sm text-ink-700">{status}</p> : null}
        </article>
      </section>
    );
  }

  return (
    <section className={`mx-auto px-gutter py-6 ${isSellerFlow ? "max-w-2xl" : "max-w-xl"}`}>
      <article className="rounded-card border border-border bg-card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-ink-900">{isSellerFlow ? "Ouvrir ma boutique AMAZER" : "Créer un compte"}</h1>

        {isSellerFlow ? (
          <>
            <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-ink-600" aria-label="Étapes">
              <li>1. Formule</li>
              <li>2. Vos informations</li>
              <li>3. Paiement</li>
            </ol>
            <h2 className="mt-5 text-sm font-semibold text-ink-900">1. Choisissez votre formule</h2>
            <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Formule">
              {SELLER_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = sellerType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setSellerType(option.value)}
                    className={`relative rounded-card border p-3 text-left transition-colors duration-fast sm:p-4 ${
                      isActive ? "border-brand-500 bg-brand-50" : "border-border bg-card hover:border-ink-400"
                    }`}
                  >
                    {isActive ? (
                      <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-brand-600 sm:h-5 sm:w-5" aria-hidden="true" />
                    ) : null}
                    <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold text-ink-900 sm:text-base">{option.title}</p>
                    <p className="hidden text-xs text-ink-600 sm:block">{option.description}</p>
                    {sellerPricing ? (
                      <p className="mt-1 text-xs font-bold text-ink-900 sm:mt-2 sm:text-sm">
                        {formatXOF(sellerSubscriptionFee(sellerPricing, option.value))}
                        <span className="block font-normal text-ink-600 sm:inline"> / mois</span>
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <h2 className="mt-6 text-sm font-semibold text-ink-900">2. Vos informations</h2>
          </>
        ) : null}

        <form onSubmit={onSubmit} className={`${isSellerFlow ? "mt-2" : "mt-6"} space-y-4`}>
          {isSellerFlow ? (
            <div>
              <label className="text-sm font-medium text-ink-800" htmlFor="business-name">
                Nom de la boutique
              </label>
              <input
                id="business-name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="mt-1 w-full h-11 rounded-field border border-border bg-card px-3 text-sm"
              />
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-ink-800" htmlFor="full-name">
              Nom complet
            </label>
            <input
              id="full-name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full h-11 rounded-field border border-border bg-card px-3 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink-800" htmlFor="country">
                Pays
              </label>
              <select
                id="country"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                autoComplete="country"
                className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.fr} ({country.dial})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink-800" htmlFor="region">
                Région ou ville
              </label>
              <input
                id="region"
                value={region}
                maxLength={120}
                autoComplete="address-level1"
                onChange={(event) => setRegion(event.target.value)}
                className="mt-1 w-full h-11 rounded-field border border-border bg-card px-3 text-sm"
                placeholder="Ex. Niamey"
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-ink-800">Comment vous joindre</legend>
            <p className="text-xs text-ink-600">
              Indiquez au moins l&apos;un des deux. Avec un e-mail, vous recevez aussi vos notifications par e-mail.
            </p>
            <div>
              <label className="text-sm font-medium text-ink-800" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                aria-invalid={touched.email && !emailValid}
                aria-describedby={touched.email && !emailValid ? "email-error" : undefined}
                className="mt-1 w-full h-11 rounded-field border border-border bg-card px-3 text-sm"
                placeholder="nom@exemple.com"
              />
              {touched.email && !emailValid ? (
                <p id="email-error" className="mt-1 text-xs text-danger">
                  Adresse e-mail invalide (exemple : nom@exemple.com).
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium text-ink-800" htmlFor="whatsapp">
                Numéro WhatsApp
              </label>
              <div className="mt-1 flex">
                <span className="inline-flex items-center rounded-l-field border border-r-0 border-border bg-surface-1 px-3 text-sm text-ink-700">
                  {dialCode}
                </span>
                <input
                  id="whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phoneLocal}
                  onChange={(event) => setPhoneLocal(event.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                  aria-invalid={touched.phone && !phoneValid}
                  aria-describedby={touched.phone && !phoneValid ? "whatsapp-error" : undefined}
                  className="w-full rounded-r-field border border-border px-3 py-2 text-sm"
                  placeholder="90 00 00 00"
                />
              </div>
              {touched.phone && !phoneValid ? (
                <p id="whatsapp-error" className="mt-1 text-xs text-danger">
                  Numéro invalide. Vérifiez le pays et le nombre de chiffres.
                </p>
              ) : null}
            </div>
          </fieldset>

          <div>
            <PasswordInput
              id="password"
              label="Mot de passe"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-rules"
            />
            <ul id="password-rules" className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
              {passwordRules.map((rule) => (
                <li key={rule.label} className={`flex items-center gap-1.5 ${rule.ok ? "text-success" : "text-ink-600"}`}>
                  <span aria-hidden="true">{rule.ok ? "✓" : "•"}</span>
                  {rule.label}
                  <span className="sr-only">{rule.ok ? " : respecté" : " : à faire"}</span>
                </li>
              ))}
            </ul>
          </div>

          {isSellerFlow ? (
            <fieldset className="space-y-4 rounded-card border border-border bg-surface-1 p-4">
              <legend className="px-1 text-sm font-semibold text-ink-900">3. Paiement de l&apos;abonnement</legend>
              <div>
                <p className="text-sm font-medium text-ink-800">Durée</p>
                <div className="mt-1 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Durée de l'abonnement">
                  {MONTH_CHOICES.map((months) => (
                    <button
                      key={months}
                      type="button"
                      role="radio"
                      aria-checked={subscriptionMonths === months}
                      onClick={() => updateSubscriptionMonths(months)}
                      className={`min-h-11 rounded-field border text-sm font-semibold ${
                        subscriptionMonths === months
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-border bg-card text-ink-800 hover:border-ink-400"
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
                      aria-checked={paymentMode === mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`min-h-11 rounded-field border text-sm font-semibold ${
                        paymentMode === mode
                          ? "border-ink-900 bg-ink-900 text-white"
                          : "border-border bg-card text-ink-800 hover:border-ink-400"
                      }`}
                    >
                      {mode === "nita" ? "Nita" : "Amana"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-field border border-border bg-card p-3 text-sm text-ink-800">
                <p>
                  Envoyez{" "}
                  <span className="text-lg font-bold text-ink-900">
                    {totalAmount !== null ? formatXOF(totalAmount) : "le montant de l'abonnement"}
                  </span>{" "}
                  par {paymentMode === "nita" ? "Nita" : "Amana"} au
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold tracking-wide text-ink-900">{walletNumber}</span>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(walletNumber.replace(/\s/g, ""))}
                    className="inline-flex min-h-9 items-center gap-1 rounded-field border border-border px-2 text-xs font-medium text-ink-700 hover:bg-surface-1"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copier
                  </button>
                </div>
                {totalAmount !== null && subscriptionMonths > 1 ? (
                  <p className="mt-1 text-xs text-ink-600">
                    {subscriptionMonths} mois × {formatXOF(monthlyFee!)}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium text-ink-800" htmlFor="transaction-ref">
                  Référence du paiement (reçue par SMS)
                </label>
                <input
                  id="transaction-ref"
                  type="text"
                  required
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm"
                />
              </div>
              <p className="text-xs text-ink-600">
                Votre boutique est créée dès que AMAZER a vérifié le paiement. Vous êtes prévenu automatiquement.
              </p>
            </fieldset>
          ) : null}

          <label className="flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(event) => setAcceptedLegal(event.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <span>
              J&apos;accepte la{" "}
              <Link href="/legal/privacy" className="font-medium text-brand-600 hover:underline">
                politique de confidentialité
              </Link>{" "}
              et les{" "}
              <Link href="/legal/terms" className="font-medium text-brand-600 hover:underline">
                conditions d&apos;utilisation
              </Link>
            </span>
          </label>

          <Button
            type="submit"
            size="lg"
            disabled={isLoading || !canSubmit}
            className="w-full"
          >
            {isLoading ? "Envoi…" : isSellerFlow ? "Envoyer ma demande" : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-ink-600">
          Déjà inscrit ?{" "}
          <Link
            href={isSellerFlow ? "/login?next=/seller" : "/login"}
            className="font-medium text-brand-600 hover:underline"
          >
            Se connecter
          </Link>
        </p>
        {status ? <p className="mt-3 text-sm text-ink-700">{status}</p> : null}
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
