"use client";

import { FormEvent, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { login } from "@/services/auth-service";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const next = searchParams.get("next") || "/dashboard";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await login({ email, password });
      router.push(next);
      router.refresh();
    } catch {
      setStatus("Identifiants invalides ou session indisponible.");
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
            <label className="text-sm font-medium text-slate-800" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            disabled={isLoading || !email || !password}
            className="primary-glow-btn w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </Button>
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
