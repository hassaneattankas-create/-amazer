"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Store, UtensilsCrossed } from "lucide-react";

import { PremiumSellerPitch } from "@/components/PremiumSellerPitch";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { login, register } from "@/services/auth-service";
import type { SellerActivityType, StorefrontTier } from "@/types/seller";

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

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

  const next = searchParams.get("next") || "/";
  const isSellerFlow = useMemo(
    () => searchParams.get("seller") === "1" || next.startsWith("/seller"),
    [next, searchParams]
  );

  async function finalizeRedirect() {
    const sellerTarget = `/seller?welcome=1&type=${sellerType}`;
    const target = isSellerFlow ? sellerTarget : next.startsWith("/") ? next : "/";
    window.location.assign(target);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await register({
        identifier: identifier.trim(),
        full_name: fullName.trim(),
        password,
        seller_profile: isSellerFlow
          ? buildSellerProfilePayload(sellerType, fullName, businessName)
          : undefined,
      });
      await login({
        identifier: identifier.trim(),
        password,
      });
      await finalizeRedirect();
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Inscription impossible. Verifiez les informations saisies."));
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit =
    fullName.trim().length >= 2 &&
    identifier.trim().length >= 6 &&
    PASSWORD_POLICY.test(password) &&
    acceptedLegal &&
    (!isSellerFlow || (businessName.trim().length >= 2 || fullName.trim().length >= 2));

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">
          {isSellerFlow ? "Creer un compte vendeur" : "Creer un compte"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isSellerFlow
            ? "Choisis d'abord le type de boutique, puis tu seras redirige directement vers la configuration vendeur."
            : "Renseignez des informations exactes. La connexion est ouverte des que le compte est cree."}
          {!isSellerFlow ? (
            <>
              {" "}
              Pour les vendeurs, passez par la rubrique{" "}
              <Link href="/vendre" className="font-medium text-[#FF4D00] hover:underline">
                Devenir vendeur
              </Link>
              .
            </>
          ) : null}
        </p>

        <PremiumSellerPitch variant="compact" className="mt-5" showEspaceVendeurLink={!isSellerFlow} />

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
                </button>
              );
            })}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isSellerFlow ? (
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="business-name">
                Nom de la boutique
              </label>
              <input
                id="business-name"
                required={isSellerFlow}
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ex: Boutique Amazer, Restaurant Amazer..."
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
            <label className="text-sm font-medium text-slate-800" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Minimum 8 caracteres avec majuscule, minuscule, chiffre et caractere special.
            </p>
          </div>

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
            {isLoading ? "Traitement..." : isSellerFlow ? "Creer mon compte vendeur" : "Creer mon compte"}
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
