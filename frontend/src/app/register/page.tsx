"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { login, register } from "@/services/auth-service";

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function finalizeRedirect() {
    const url = new URL(window.location.href);
    const next = url.searchParams.get("next") || "/";
    const target = next.startsWith("/") ? next : "/";
    window.location.assign(target);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      const response = await register({
        identifier: identifier.trim(),
        full_name: fullName.trim(),
        password,
      });
      void response;
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
    acceptedLegal;

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Creer un compte</h1>
        <p className="mt-2 text-sm text-slate-600">
          Renseignez des informations exactes. La connexion est ouverte des que le compte est cree.
          Pour les vendeurs, passez par la rubrique{" "}
          <Link href="/vendre" className="font-medium text-[#FF4D00] hover:underline">
            Devenir vendeur
          </Link>
          .
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            {isLoading ? "Traitement..." : "Creer mon compte"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Deja inscrit ?{" "}
          <Link href="/login" className="font-medium text-[#FF4D00] hover:underline">
            Se connecter
          </Link>
        </p>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}
