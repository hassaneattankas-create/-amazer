"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { requestPasswordReset, resetPassword } from "@/services/auth-service";

type Step = "request" | "reset";

const SUPPORT_MAILTO =
  "mailto:amazer.niger@gmail.com?subject=AMAZER%20-%20Reinitialisation%20mot%20de%20passe";

const fieldClass =
  "mt-1 w-full rounded-field border border-input bg-background px-3 py-2 text-sm text-ink-900";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const result = await requestPasswordReset(identifier.trim());
      setInfo(result.code_preview ? `${result.message} (code de test : ${result.code_preview})` : result.message);
      setStep("reset");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Impossible d'envoyer le code. Reessayez dans quelques minutes."));
    } finally {
      setIsLoading(false);
    }
  };

  const onReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await resetPassword({ identifier: identifier.trim(), code: code.trim(), new_password: newPassword });
      router.push("/login?reset=1");
    } catch (resetError) {
      setError(getApiErrorMessage(resetError, "Code invalide ou expire. Verifiez le code ou demandez-en un nouveau."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl px-gutter py-10">
      <article className="rounded-card border border-border bg-card p-6 shadow-resting">
        <h1 className="text-2xl font-semibold text-ink-900">Mot de passe oublie</h1>
        <p className="mt-2 text-sm text-ink-600">
          {step === "request"
            ? "Indiquez l'e-mail ou le numero WhatsApp de votre compte : nous vous envoyons un code a 6 chiffres."
            : "Saisissez le code recu et choisissez un nouveau mot de passe."}
        </p>

        {step === "request" ? (
          <form onSubmit={onRequest} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-ink-800" htmlFor="identifier">
                E-mail ou WhatsApp (+227)
              </label>
              <input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className={fieldClass}
                placeholder="email@domaine.com ou +22790000000"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Envoi..." : "Recevoir un code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onReset} className="mt-6 space-y-4">
            {info ? (
              <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-700" role="status">
                {info}
              </p>
            ) : null}
            <div>
              <label className="text-sm font-medium text-ink-800" htmlFor="code">
                Code a 6 chiffres
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                className={fieldClass}
              />
            </div>
            <PasswordInput
              id="new-password"
              label="Nouveau mot de passe"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="text-xs text-ink-600">
              8 caracteres minimum, avec une minuscule, une majuscule, un chiffre et un caractere special.
            </p>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Modification..." : "Changer mon mot de passe"}
            </Button>
            <button
              type="button"
              className="text-sm font-medium text-brand-600 hover:underline"
              onClick={() => {
                setStep("request");
                setCode("");
                setError("");
              }}
            >
              Renvoyer un code
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-ink-600">
          Aucun code recu ?{" "}
          <a className="font-medium text-brand-600 hover:underline" href={SUPPORT_MAILTO}>
            Contactez le support
          </a>{" "}
          avec l&apos;identifiant utilise a l&apos;inscription. ·{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Retour a la connexion
          </Link>
        </p>
      </article>
    </section>
  );
}
