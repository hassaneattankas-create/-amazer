"use client";

import { FormEvent, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PasswordInput } from "@/components/PasswordInput";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { isAdminEmail } from "@/lib/admin";
import { persistAppMode } from "@/lib/session-mode";
import { getAdminMe } from "@/services/admin-service";
import { getCurrentUser, login } from "@/services/auth-service";
import { requestAndRegisterNotifications } from "@/services/notification-service";
import { getSellerProfile } from "@/services/seller-service";
import { useAuthStore } from "@/store/auth-store";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const setAppMode = useAuthStore((state) => state.setAppMode);

  const next = searchParams.get("next") || "/";
  const sellerRegisterHref = "/register?next=/seller&seller=1";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await login({
        identifier,
        password,
      });
      // Demande opt-in notifications apres premiere connexion reussie.
      void requestAndRegisterNotifications();
      const adminMe = await getAdminMe().catch(() => null);
      const currentUser = await getCurrentUser().catch(() => null);
      if (adminMe?.is_admin || isAdminEmail(currentUser?.email || identifier)) {
        setAppMode("client");
        persistAppMode("client");
        window.location.assign("/admin");
        return;
      }
      const sellerProfile = await getSellerProfile().catch(() => null);
      if (sellerProfile?.id) {
        setAppMode("seller");
        persistAppMode("seller");
        // Les vendeurs sont diriges vers leur back-office boutique type Shopify.
        window.location.assign("/seller/dashboard");
        return;
      }
      setAppMode("client");
      persistAppMode("client");
      window.location.assign(next);
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Identifiants invalides ou session indisponible."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">
          Connectez-vous avec votre compte pour acceder aux pages protegees.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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

          <PasswordInput
            id="password"
            label="Mot de passe"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <p className="text-sm text-slate-600">
            Mot de passe oublie ? AMAZER ne propose pas encore la reinitialisation automatique dans l&apos;app.{" "}
            <a
              className="font-medium text-[#FF4D00] hover:underline"
              href="mailto:amazer.niger@gmail.com?subject=AMAZER%20-%20Reinitialisation%20mot%20de%20passe&body=Bonjour%2C%0D%0A%0D%0AIdentifiant%20utilise%20%28email%20ou%20WhatsApp%20%2B227%29%20%3A%0D%0A%0D%0ANom%20de%20la%20boutique%20%28si%20vendeur%29%20%3A%0D%0A"
            >
              Contactez le support
            </a>{" "}
            en indiquant l&apos;email ou le WhatsApp utilises a l&apos;inscription (ex. Karma Tech).
          </p>

          <Button
            type="submit"
            disabled={isLoading || !identifier.trim() || !password}
            className="primary-glow-btn w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </Button>
          <p className="text-sm text-slate-600">
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-medium text-[#FF4D00] hover:underline">
              Creer un compte client
            </Link>
            {" "}ou{" "}
            <Link href={sellerRegisterHref} className="font-medium text-[#FF4D00] hover:underline">
              devenir vendeur
            </Link>
            .
          </p>
          {status ? <p className="text-sm text-slate-700">{status}</p> : null}
        </form>
      </article>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-xl px-4 py-10">
          <ProductCardSkeleton />
        </section>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
