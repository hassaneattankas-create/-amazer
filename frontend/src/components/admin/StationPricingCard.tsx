"use client";

import { Fuel } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import type { FinanceSettings } from "@/types/finance";

type StationKey =
  | "fuel_base_subscription"
  | "fuel_included_outlets"
  | "fuel_tier1_until"
  | "fuel_tier1_price"
  | "fuel_tier2_until"
  | "fuel_tier2_price"
  | "fuel_tier3_price"
  | "fuel_network_flat";

const DEFAULTS: Record<StationKey, number> = {
  fuel_base_subscription: 0,
  fuel_included_outlets: 3,
  fuel_tier1_until: 10,
  fuel_tier1_price: 2000,
  fuel_tier2_until: 30,
  fuel_tier2_price: 1500,
  fuel_tier3_price: 1000,
  fuel_network_flat: 50000,
};

const EXAMPLES = [3, 5, 12, 40];

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

/** Même calcul que le serveur (services/fuel_network_pricing.py) pour l'aperçu des prix. */
export function stationNetworkPrice(values: Record<StationKey, number>, premiumFee: number, stations: number): number {
  const base = values.fuel_base_subscription > 0 ? values.fuel_base_subscription : premiumFee;
  const included = Math.max(0, Math.floor(values.fuel_included_outlets));
  const tier1 = Math.max(Math.floor(values.fuel_tier1_until), included);
  const tier2 = Math.max(Math.floor(values.fuel_tier2_until), tier1 + 1);
  let extra = 0;
  for (let rank = 1; rank <= stations; rank += 1) {
    if (rank <= included) continue;
    extra += rank <= tier1 ? values.fuel_tier1_price : rank <= tier2 ? values.fuel_tier2_price : values.fuel_tier3_price;
  }
  const raw = base + extra;
  const flat = values.fuel_network_flat;
  return flat > 0 && raw > Math.max(flat, base) ? Math.max(flat, base) : raw;
}

/** Réglages des stations-essence : abonnement de base, stations incluses, paliers et forfait national. */
export function StationPricingCard({
  settings,
  premiumFee,
  onChange,
}: {
  settings: FinanceSettings;
  premiumFee: number;
  onChange: (patch: Partial<FinanceSettings>) => void;
}) {
  const values = Object.fromEntries(
    (Object.keys(DEFAULTS) as StationKey[]).map((key) => [key, Number(settings[key] ?? DEFAULTS[key])])
  ) as Record<StationKey, number>;
  const included = Math.max(0, Math.floor(values.fuel_included_outlets));
  const tier1 = Math.max(Math.floor(values.fuel_tier1_until), included);
  const tier2 = Math.max(Math.floor(values.fuel_tier2_until), tier1 + 1);

  const field = (key: StationKey, label: string, suffix: string, helper?: string) => (
    <label key={key} className="block text-sm font-medium text-ink-800">
      {label}
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={fieldClass}
          value={values[key]}
          onChange={(event) => onChange({ [key]: Math.max(0, Number(event.target.value) || 0) })}
        />
        <span className="shrink-0 text-xs text-ink-600">{suffix}</span>
      </span>
      {helper ? <span className="mt-1 block text-xs font-normal text-ink-600">{helper}</span> : null}
    </label>
  );

  return (
    <section aria-labelledby="station-pricing-title" className="space-y-4 rounded-card border border-border bg-surface-1 p-4">
      <h3 id="station-pricing-title" className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Fuel className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Stations-essence : abonnement et paliers
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "fuel_base_subscription",
          "Abonnement de base d'une marque",
          "XOF / mois",
          `0 = même prix que l'abonnement Premium (${formatXOF(premiumFee)}).`
        )}
        {field("fuel_included_outlets", "Stations comprises dans l'abonnement", "stations", "Aucun supplément jusqu'à ce nombre.")}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink-900">Prix par station supplémentaire (dégressif)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("fuel_tier1_until", `Palier 1 : de la ${included + 1}e station jusqu'à la`, "e station")}
          {field("fuel_tier1_price", "Prix de chaque station du palier 1", "XOF / mois")}
          {field("fuel_tier2_until", `Palier 2 : de la ${tier1 + 1}e station jusqu'à la`, "e station")}
          {field("fuel_tier2_price", "Prix de chaque station du palier 2", "XOF / mois")}
          {field("fuel_tier3_price", `Palier 3 : à partir de la ${tier2 + 1}e station`, "XOF / mois")}
          {field(
            "fuel_network_flat",
            "Forfait national (plafond, stations illimitées)",
            "XOF / mois",
            "Le total d'une marque ne dépasse jamais ce montant. 0 = pas de plafond."
          )}
        </div>
      </div>

      <div className="rounded-field bg-card p-3 text-sm text-ink-800">
        <p className="font-semibold text-ink-900">Aperçu du prix mensuel d&apos;une marque</p>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {EXAMPLES.map((count) => (
            <li key={count}>
              {count} stations : <strong>{formatXOF(stationNetworkPrice(values, premiumFee, count))}</strong>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-600">
          Un prix négocié pour une marque (fiche vendeur › « Tarif personnalisé ») remplace tout ce calcul. Pensez à « Enregistrer ».
        </p>
      </div>
    </section>
  );
}
