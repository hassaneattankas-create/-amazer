"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { login, register } from "@/services/auth-service";
import { upsertSellerProfile } from "@/services/seller-service";

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSeller, setIsSeller] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Niamey");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await register({
        email: email.trim(),
        full_name: fullName.trim(),
        password,
      });

      await login({
        email: email.trim(),
        password,
      });

      if (isSeller) {
        await upsertSellerProfile({
          business_name: businessName.trim(),
          phone: phone.trim() || undefined,
          city: city.trim() || "Niamey",
          address: address.trim() || undefined,
        });
        router.push("/seller");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Inscription impossible. Verifiez les informations saisies."));
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit =
    fullName.trim().length >= 2 &&
    email.trim().length >= 5 &&
    PASSWORD_POLICY.test(password) &&
    (!isSeller || businessName.trim().length >= 2);

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Creer un compte</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vos informations sont protegees. Choisissez un compte client ou vendeur.
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
            Je suis vendeur et je veux creer ma boutique
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
            {isLoading ? "Creation..." : "Creer mon compte"}
          </Button>

          <p className="text-sm text-slate-600">
            Deja inscrit ?{" "}
            <Link href="/login" className="font-medium text-[#FF4D00] hover:underline">
              Se connecter
            </Link>
          </p>
          {status ? <p className="text-sm text-slate-700">{status}</p> : null}
        </form>
      </article>
    </section>
  );
}
