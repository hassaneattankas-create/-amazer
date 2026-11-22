"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bus } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { setAdminSellerBilling } from "@/services/finance-service";
import type { AdminSeller, FinanceSettings, TransportBillingMode } from "@/types/finance";

const MODES: Array<{ value: TransportBillingMode; label: string; hint: string }> = [
  { value: "subscription", label: "Abonnement", hint: "Prix mensuel selon le nombre de lignes, aucune part sur les billets." },
  { value: "commission", label: "Commission par billet", hint: "Pas d'abonnement : AMAZER touche un pourcentage de chaque billet confirmé." },
  { value: "both", label: "Les deux", hint: "Abonnement mensuel et commission sur chaque billet." },
];

const fieldClass = "mt-1 h-10 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

/** Fiche vendeur (transport) : l'admin choisit comment la compagnie paie AMAZER. */
export function TransportBillingControl({ seller, defaultPercent }: { seller: AdminSeller; defaultPercent: number }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<TransportBillingMode>(seller.billing_mode ?? "subscription");
  const [percent, setPercent] = useState(seller.ticket_commission_percent != null ? String(seller.ticket_commission_percent) : "");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useMutation({
    mutationFn: () => setAdminSellerBilling(seller.profile_id, mode, mode === "subscription" || percent.trim() === "" ? null : Number(percent)),
    onSuccess: () => {
      setStatus({ ok: true, text: "Facturation enregistrée." });
      void queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-transport-commissions"] });
    },
    onError: (error) => setStatus({ ok: false, text: getApiErrorMessage(error, "Enregistrement impossible.") }),
  });
  const chosen = MODES.find((item) => item.value === mode) ?? MODES[0];
  const changed = mode !== (seller.billing_mode ?? "subscription") || percent !== (seller.ticket_commission_percent != null ? String(seller.ticket_commission_percent) : "");

  return (
    <div className="mt-3 rounded-field border border-border bg-surface-1 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Bus className="h-4 w-4 text-brand-600" aria-hidden="true" />
        Facturation de la compagnie · {seller.transport_lines ?? 0} ligne{(seller.transport_lines ?? 0) > 1 ? "s" : ""}
      </p>
      <p className="mt-0.5 text-xs text-ink-600">
        Actuellement : {MODES.find((item) => item.value === (seller.billing_mode ?? "subscription"))?.label}
        {seller.billing_mode !== "commission" ? ` · abonnement ${formatXOF(seller.effective_seller_subscription_fee)} / mois` : ""}
        {seller.billing_mode && seller.billing_mode !== "subscription" ? ` · ${seller.effective_ticket_commission_percent ?? defaultPercent} % par billet` : ""}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink-700">
          Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as TransportBillingMode)} className={fieldClass}>
            {MODES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {mode !== "subscription" ? (
          <label className="text-xs font-medium text-ink-700">
            Commission par billet (%)
            <input
              type="number"
              min={0}
              max={90}
              step="0.5"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              placeholder={`${defaultPercent} (taux général)`}
              className={fieldClass}
            />
          </label>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ink-600">{chosen.hint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!changed || save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex min-h-10 items-center rounded-field bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {save.isPending ? "Enregistrement…" : "Appliquer à cette compagnie"}
        </button>
        {status ? (
          <span role={status.ok ? "status" : "alert"} className={`text-xs ${status.ok ? "text-success" : "text-danger"}`}>
            {status.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function NumberRow({
  label,
  value,
  suffix,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  helper: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm font-medium text-ink-800">
      {label}
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="h-10 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
        />
        <span className="shrink-0 text-sm text-ink-600">{suffix}</span>
      </span>
      <span className="mt-1 block text-xs font-normal text-ink-600">{helper}</span>
    </label>
  );
}

/** Réglages : prix des compagnies de transport (abonnement par lignes) et commission par billet. */
export function TransportPricingCard({ settings, onChange }: { settings: FinanceSettings; onChange: (patch: Partial<FinanceSettings>) => void }) {
  const base = settings.transport_base_subscription ?? 15000;
  const included = settings.transport_included_lines ?? 5;
  const perLine = settings.transport_extra_line_price ?? 1000;
  const percent = settings.transport_ticket_commission_percent ?? 8;
  const priceFor = (lines: number) => base + Math.max(0, lines - included) * perLine;

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Bus className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Compagnies de transport : prix
      </h3>
      <p className="mt-1 text-sm text-ink-600">
        Le mode de chaque compagnie (abonnement, commission par billet ou les deux) se choisit sur sa fiche, onglet « Vendeurs ».
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <NumberRow
          label="Abonnement de base"
          value={base}
          suffix="XOF / mois"
          helper="Prix mensuel d'une compagnie, lignes comprises."
          onChange={(value) => onChange({ transport_base_subscription: value })}
        />
        <NumberRow
          label="Lignes comprises"
          value={included}
          suffix="lignes"
          helper="Une ligne = un trajet publié (ex. Niamey - Zinder)."
          onChange={(value) => onChange({ transport_included_lines: Math.round(value) })}
        />
        <NumberRow
          label="Prix par ligne en plus"
          value={perLine}
          suffix="XOF / mois"
          helper="Au-delà des lignes comprises."
          onChange={(value) => onChange({ transport_extra_line_price: value })}
        />
        <NumberRow
          label="Commission par billet (taux général)"
          value={percent}
          suffix="%"
          helper="Compagnies en mode « commission » ou « les deux ». Un taux propre peut être fixé sur la fiche."
          onChange={(value) => onChange({ transport_ticket_commission_percent: Math.min(90, value) })}
        />
      </div>
      <div className="mt-3 rounded-field bg-surface-1 p-3 text-sm text-ink-800">
        <p className="font-semibold text-ink-900">Aperçu de l&apos;abonnement mensuel</p>
        <p>
          5 lignes : {formatXOF(priceFor(5))} · 8 lignes : {formatXOF(priceFor(8))} · 12 lignes : {formatXOF(priceFor(12))} · 20 lignes :{" "}
          {formatXOF(priceFor(20))}
        </p>
        <p className="mt-1">
          Commission : un billet de 10 000 XOF rapporte {formatXOF(Math.round((10000 * percent) / 100))} à AMAZER.
        </p>
      </div>
    </section>
  );
}
