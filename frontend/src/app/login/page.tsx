"use client";

import { FormEvent, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { persistAppMode } from "@/lib/session-mode";
import { login } from "@/services/auth-service";
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await login({
        identifier,
        password,
      });
      const sellerProfile = await getSellerProfile().catch(() => null);
      if (sellerProfile?.id) {
        setAppMode("seller");
        persistAppMode("seller");
        window.location.assign(next.startsWith("/seller") ? next : "/seller");
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

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

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
              Creer un compte
            </Link>
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
