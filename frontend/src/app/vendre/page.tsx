"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rocket, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { persistAppMode } from "@/lib/session-mode";
import { login, register } from "@/services/auth-service";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { upsertSellerProfile } from "@/services/seller-service";
import { useAuthStore } from "@/store/auth-store";

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

export default function VendrePage() {
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const setAppMode = useAuthStore((state) => state.setAppMode);
  const [form, setForm] = useState({
    full_name: "",
    identifier: "",
    password: "",
    business_name: "",
    city: "Niamey",
    phone: "",
    address: "",
  });

  const { data: pricing } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);
    try {
      await register({
        identifier: form.identifier.trim(),
        full_name: form.full_name.trim(),
        password: form.password,
      });
      await login({ identifier: form.identifier.trim(), password: form.password });
      await upsertSellerProfile({
        business_name: form.business_name.trim(),
        city: form.city.trim() || "Niamey",
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setAppMode("seller");
      persistAppMode("seller");
      setStatus("Compte vendeur cree et active. Redirection...");
      window.location.assign("/seller");
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Activation vendeur impossible."));
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit =
    form.full_name.trim().length >= 2 &&
    form.identifier.trim().length >= 6 &&
    form.phone.trim().length >= 8 &&
    PASSWORD_POLICY.test(form.password) &&
    form.business_name.trim().length >= 2;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-gradient-to-br from-white to-orange-50 p-6">
        <h1 className="luxury-title inline-flex items-center gap-2 text-3xl font-semibold">
          <Store className="h-6 w-6 text-[#FF4D00]" />
          Ouvrir ma Boutique vendeur
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Activation instantanee: pas de candidature, acces direct au dashboard vendeur.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
          <li>Creer votre compte vendeur</li>
          <li>Configurer votre boutique</li>
          <li>Publier votre premier produit</li>
        </ol>
      </header>

      {pricing ? (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Tarifs plateforme en vigueur</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Commission active: {(pricing.commission_rate * 100).toFixed(1)}%</li>
            <li>Frais de plateforme: {formatXOF(pricing.service_fee)} / commande</li>
            <li>Livraison urbaine: {formatXOF(pricing.urban_delivery_fee)}</li>
            <li>Livraison peripherique: {formatXOF(pricing.peripheral_delivery_fee)}</li>
          </ul>
        </article>
      ) : null}

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Creation Compte Vendeur</h2>
        <p className="mt-2 text-sm text-slate-600">
          Votre boutique sera active immediatement. Le badge de confiance est attribue plus tard apres verification admin.
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={form.full_name}
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
              placeholder="Nom complet"
            />
            <Input
              type="text"
              value={form.identifier}
              onChange={(event) => setForm((prev) => ({ ...prev, identifier: event.target.value }))}
              placeholder="Email ou WhatsApp (+227...)"
            />
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Mot de passe fort"
            />
            <Input
              value={form.business_name}
              onChange={(event) => setForm((prev) => ({ ...prev, business_name: event.target.value }))}
              placeholder="Nom de la boutique"
            />
            <Input
              value={form.city}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              placeholder="Ville"
            />
            <Input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Telephone WhatsApp (+227...)"
            />
            <Input
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="Adresse"
              className="sm:col-span-2"
            />
          </div>

          <Button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="primary-glow-btn mt-2 bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            <Rocket className="h-4 w-4" />
            {isLoading ? "Activation..." : "Activer ma boutique maintenant"}
          </Button>
        </form>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}
