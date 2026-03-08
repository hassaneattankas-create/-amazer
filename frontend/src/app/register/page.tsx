"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { login, register, type RegisterResponse, verifyAccount } from "@/services/auth-service";

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSeller, setIsSeller] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Niamey");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registrationMeta, setRegistrationMeta] = useState<RegisterResponse | null>(null);

  async function finalizeRedirect() {
    window.location.assign(isSeller ? "/seller/dashboard" : "/");
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
        seller_profile: isSeller
          ? {
              business_name: businessName.trim(),
              phone: phone.trim() || undefined,
              city: city.trim() || "Niamey",
              address: address.trim() || undefined,
            }
          : undefined,
      });
      if (response.verification_channel === "none") {
        await login({
          identifier: identifier.trim(),
          password,
        });
        await finalizeRedirect();
        return;
      }
      setRegistrationMeta(response);
      setStatus(
        `Code envoye via ${response.verification_channel} vers ${response.verification_destination_masked}.`
      );
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Inscription impossible. Verifiez les informations saisies."));
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await verifyAccount({
        identifier: identifier.trim(),
        code: verificationCode,
      });
      await login({
        identifier: identifier.trim(),
        password,
      });
      await finalizeRedirect();
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Verification impossible. Verifiez le code recu."));
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit =
    fullName.trim().length >= 2 &&
    identifier.trim().length >= 6 &&
    PASSWORD_POLICY.test(password) &&
    (!isSeller || businessName.trim().length >= 2);

  const canVerify = verificationCode.trim().length >= 4;

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Creer un compte</h1>
        <p className="mt-2 text-sm text-slate-600">
          Verification obligatoire par code avant la premiere connexion.
        </p>

        {!registrationMeta ? (
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

            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isSeller}
                onChange={(event) => setIsSeller(event.target.checked)}
              />
              Je suis vendeur et je veux creer ma boutique automatiquement
            </label>

            {isSeller ? (
              <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
                <div>
                  <label className="text-sm font-medium text-slate-800" htmlFor="business-name">
                    Nom de la boutique
                  </label>
                  <input
                    id="business-name"
                    required
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-800" htmlFor="phone">
                    Telephone
                  </label>
                  <input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-800" htmlFor="city">
                    Ville
                  </label>
                  <input
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-800" htmlFor="address">
                    Adresse
                  </label>
                  <input
                    id="address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="primary-glow-btn w-full text-white"
            >
              {isLoading ? "Traitement..." : "Creer mon compte"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-6 space-y-4">
            <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700">
              <p>
                Code envoye vers <strong>{registrationMeta.verification_destination_masked}</strong> via{" "}
                <strong>{registrationMeta.verification_channel}</strong>.
              </p>
              {registrationMeta.verification_code_preview ? (
                <p className="mt-2 text-xs text-slate-500">
                  Code de test local: {registrationMeta.verification_code_preview}
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="verification-code">
                Code de verification
              </label>
              <input
                id="verification-code"
                required
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="000000"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !canVerify}
              className="primary-glow-btn w-full text-white"
            >
              {isLoading ? "Verification..." : "Valider mon compte"}
            </Button>
          </form>
        )}

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
