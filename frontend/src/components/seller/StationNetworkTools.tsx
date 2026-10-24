"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Crown, Download, Lock, Trash2, Users } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { timeAgo } from "@/lib/local-services";
import {
  addRegionManager,
  downloadFuelExport,
  getFuelDashboard,
  getFuelPlan,
  listMyOutlets,
  listRegionManagers,
  removeRegionManager,
} from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, type FuelPlan } from "@/types/local-services";

function Feature({ on, label, from }: { on: boolean; label: string; from?: string }) {
  return (
    <li className="flex items-start gap-2">
      {on ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
      )}
      <span className={on ? "text-ink-900" : "text-ink-600"}>
        {label}
        {!on && from ? <span className="text-ink-600"> · {from}</span> : null}
      </span>
    </li>
  );
}

function NetworkDashboard() {
  const { data, isPending, isError } = useQuery({ queryKey: ["fuel-dashboard"], queryFn: getFuelDashboard, refetchOnWindowFocus: true });
  if (isPending) return <div className="h-32 animate-pulse rounded-field bg-surface-3" aria-busy="true" />;
  if (isError) return <p className="text-sm text-danger">Tableau de bord indisponible pour le moment.</p>;
  const tiles = [
    { label: "Stations à jour", value: `${data.fresh} / ${data.stations}`, warn: false },
    { label: "Non confirmées", value: String(data.to_confirm), warn: data.to_confirm > 0 },
    { label: "Sans gérant", value: String(data.without_manager), warn: data.without_manager > 0 },
    { label: "Signalements (30 j)", value: String(data.reports_30d), warn: data.reports_30d > 0 },
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className={`rounded-field p-3 ${tile.warn ? "bg-warning/10" : "bg-surface-1"}`}>
            <dt className="text-xs text-ink-600">{tile.label}</dt>
            <dd className="text-xl font-semibold text-ink-900">{tile.value}</dd>
          </div>
        ))}
      </dl>
      {data.long_outages.length ? (
        <div>
          <p className="text-sm font-semibold text-ink-900">Ruptures depuis plus de 24 h</p>
          <ul className="mt-1 space-y-1 text-sm text-ink-800">
            {data.long_outages.map((o) => (
              <li key={`${o.id}-${o.fuel}`} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                {o.name} ({o.city}) · {FUEL_LABELS[o.fuel]} : rupture signalée {timeAgo(o.since)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.stale.length ? (
        <div>
          <p className="text-sm font-semibold text-ink-900">À relancer</p>
          <p className="text-sm text-ink-700">
            {data.stale
              .slice(0, 12)
              .map((s) => `${s.name} (${s.fuel_updated_at ? timeAgo(s.fuel_updated_at) : "jamais"})`)
              .join(" · ")}
            {data.stale.length > 12 ? ` · et ${data.stale.length - 12} autres` : ""}
          </p>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-72 text-left text-sm">
          <thead className="text-xs text-ink-600">
            <tr>
              <th className="py-1 pr-3 font-medium">Ville</th>
              <th className="py-1 pr-3 font-medium">Stations</th>
              <th className="py-1 pr-3 font-medium">Non confirmées</th>
              <th className="py-1 font-medium">Ruptures</th>
            </tr>
          </thead>
          <tbody>
            {data.cities.map((c) => (
              <tr key={c.city} className="border-t border-border text-ink-900">
                <td className="py-1.5 pr-3">{c.city}</td>
                <td className="py-1.5 pr-3">{c.stations}</td>
                <td className="py-1.5 pr-3">{c.to_confirm}</td>
                <td className="py-1.5">{c.out}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegionManagers() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const { data: managers = [] } = useQuery({ queryKey: ["fuel-region-managers"], queryFn: listRegionManagers });
  const { data: outlets = [] } = useQuery({ queryKey: ["fuel-outlets"], queryFn: listMyOutlets });
  const cities = Array.from(new Set(outlets.map((o) => o.city))).sort((a, b) => a.localeCompare(b, "fr"));
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));
  const add = useMutation({
    mutationFn: () => addRegionManager({ city: city || cities[0] || "", email: email.trim() }),
    onSuccess: (list) => {
      queryClient.setQueryData(["fuel-region-managers"], list);
      void queryClient.invalidateQueries({ queryKey: ["fuel-dashboard"] });
      toast.success("Responsable ajouté. Il a reçu une notification.");
      setEmail("");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: removeRegionManager,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fuel-region-managers"] });
      toast.success("Responsable retiré.");
    },
    onError,
  });

  return (
    <div className="space-y-2 text-sm">
      <p className="text-ink-700">
        Un responsable met à jour toutes vos stations d&apos;une ville et reçoit les relances des stations sans gérant.
      </p>
      {managers.length ? (
        <ul className="space-y-1">
          {managers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-ink-800">
                <strong>{m.city}</strong> · {m.full_name} · {m.email}
              </span>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Retirer ${m.full_name} (${m.city}) ?`)) remove.mutate(m.id);
                }}
                aria-label={`Retirer ${m.full_name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-field text-ink-600 hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="grid gap-2 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) add.mutate();
        }}
      >
        <label className="block text-xs text-ink-700">
          Ville
          <select
            value={city || cities[0] || ""}
            onChange={(event) => setCity(event.target.value)}
            className="mt-1 h-11 w-full rounded-field border border-border bg-card px-2 text-base text-ink-900"
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-ink-700">
          E-mail de son compte AMAZER
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900"
          />
        </label>
        <button type="submit" disabled={add.isPending || !cities.length} className="min-h-11 self-end rounded-field bg-ink-900 px-3 font-semibold text-white disabled:opacity-60">
          {add.isPending ? "Ajout…" : "Ajouter un responsable"}
        </button>
      </form>
    </div>
  );
}

function ExportButtons() {
  const [busy, setBusy] = useState(false);
  const download = async (kind: "history" | "stats") => {
    setBusy(true);
    try {
      const blob = await downloadFuelExport(kind);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = kind === "history" ? "amazer-stations-historique.csv" : "amazer-stations-statistiques.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Export impossible. Réessayez."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {(["history", "stats"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          disabled={busy}
          onClick={() => void download(kind)}
          className="inline-flex min-h-11 items-center gap-2 rounded-field border border-border bg-card px-3 text-sm font-semibold text-ink-900 hover:bg-surface-1 disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {kind === "history" ? "Historique (12 mois)" : "Statistiques (12 mois)"}
        </button>
      ))}
    </div>
  );
}

function PlanSummary({ plan }: { plan: FuelPlan }) {
  const network = `à partir de ${plan.network_from} stations`;
  const enterprise = `à partir de ${plan.enterprise_from} stations`;
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <Crown className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Palier {plan.name} · {plan.stations} station{plan.stations > 1 ? "s" : ""}
      </h2>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        <Feature on label="Gérants par station et relances automatiques" />
        <Feature on label="Rapport mensuel et historique" />
        <Feature on={plan.network_tools} label="Tableau de bord du réseau" from={network} />
        <Feature on={plan.network_tools} label="Responsables par ville" from={network} />
        <Feature on={plan.export} label="Export Excel sur 12 mois" from={enterprise} />
      </ul>
    </div>
  );
}

/** Outils du réseau de stations, débloqués selon le palier (nombre de stations). */
export function StationNetworkTools() {
  const { data: plan } = useQuery({ queryKey: ["fuel-plan"], queryFn: getFuelPlan });
  if (!plan || plan.stations === 0) return null;
  return (
    <section aria-label="Outils du réseau" className="space-y-4 rounded-card border border-border bg-card p-4 shadow-resting">
      <PlanSummary plan={plan} />
      {plan.network_tools ? (
        <>
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-base font-semibold text-ink-900">Tableau de bord du réseau</h3>
            <NetworkDashboard />
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-ink-900">
              <Users className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Responsables par ville
            </h3>
            <RegionManagers />
          </div>
        </>
      ) : null}
      {plan.export ? (
        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-base font-semibold text-ink-900">Export Excel</h3>
          <ExportButtons />
        </div>
      ) : null}
    </section>
  );
}
