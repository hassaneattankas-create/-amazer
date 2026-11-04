"use client";

import { AlertTriangle, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/local-services";
import { cn } from "@/lib/utils";
import { FUEL_LABELS, type FuelDashboard } from "@/types/local-services";

const MAX_ALERTS = 6;

export type OwnerSummaryStripProps = {
  dashboard: FuelDashboard | undefined;
  openReports: number | undefined;
  /** Échec du tableau de bord (3 premiers chiffres) ou des retours clients (dernier chiffre). */
  dashboardError: boolean;
  reportsError: boolean;
  onRetry: () => void;
};

/** Bandeau toujours visible : 4 chiffres clés du réseau. */
export function OwnerSummaryStrip({ dashboard, openReports, dashboardError, reportsError, onRetry }: OwnerSummaryStripProps) {
  const tiles = [
    { label: "Stations à jour", value: dashboard ? `${dashboard.fresh} / ${dashboard.stations}` : undefined, warn: false, failed: dashboardError },
    { label: "À renseigner", value: dashboard?.to_confirm, warn: (dashboard?.to_confirm ?? 0) > 0, failed: dashboardError },
    { label: "Sans gérant", value: dashboard?.without_manager, warn: (dashboard?.without_manager ?? 0) > 0, failed: dashboardError },
    { label: "Retours ouverts", value: openReports, warn: (openReports ?? 0) > 0, failed: reportsError },
  ];
  const failed = tiles.some((tile) => tile.value === undefined && tile.failed);
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Résumé du réseau">
        {tiles.map((tile) => (
          <div key={tile.label} className={cn("rounded-field border border-border p-3", tile.warn ? "bg-warning/10" : "bg-card")}>
            <dt className="text-xs text-ink-600">{tile.label}</dt>
            <dd className="text-xl font-semibold text-ink-900">
              {tile.value !== undefined ? (
                tile.value
              ) : tile.failed ? (
                <span aria-label="Indisponible">–</span>
              ) : (
                <span role="status" className="inline-block h-6 w-10 animate-pulse rounded-field bg-surface-2">
                  <span className="sr-only">Chargement</span>
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {failed ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p className="text-ink-800">Chiffres indisponibles pour le moment.</p>
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AlertList({ title, items }: { title: string; items: { key: string; text: string; danger: boolean }[] }) {
  if (!items.length) return null;
  const shown = items.slice(0, MAX_ALERTS);
  return (
    <div>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <ul className="mt-1 space-y-1 text-sm text-ink-800">
        {shown.map((item) => (
          <li key={item.key} className="flex items-start gap-1.5">
            {item.danger ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            ) : (
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            )}
            {item.text}
          </li>
        ))}
      </ul>
      {items.length > MAX_ALERTS ? <p className="mt-1 text-xs text-ink-600">et {items.length - MAX_ALERTS} autres</p> : null}
    </div>
  );
}

export type OwnerOverviewProps = {
  dashboard: FuelDashboard | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

/** Vue d'ensemble : trafic des 30 derniers jours et alertes (ruptures longues, stations à relancer). */
export function OwnerOverview({ dashboard, isLoading, isError, onRetry }: OwnerOverviewProps) {
  const now = useNow();
  if (!dashboard) {
    if (isLoading) return <div className="h-32 animate-pulse rounded-field bg-surface-2" aria-busy="true" aria-label="Chargement" />;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-field bg-surface-1 p-3 text-sm">
        <p className="text-ink-800">{isError ? "Tableau de bord indisponible pour le moment." : "Aucune donnée."}</p>
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
          Réessayer
        </Button>
      </div>
    );
  }
  const traffic = [
    { label: "Itinéraires", value: dashboard.routes_30d },
    { label: "Appels", value: dashboard.calls_30d },
    { label: "Commandes de gaz", value: dashboard.gas_orders_30d },
    { label: "Livraisons", value: dashboard.deliveries_30d },
  ];
  const outages = dashboard.long_outages.map((o) => ({
    key: `${o.id}-${o.fuel}`,
    text: `${o.name} (${o.city}) · ${FUEL_LABELS[o.fuel]} en rupture ${timeAgo(o.since, now) ?? ""}`,
    danger: true,
  }));
  const stale = dashboard.stale.map((s) => ({
    key: s.id,
    text: `${s.name} (${s.city}) · ${s.fuel_updated_at ? `mise à jour ${timeAgo(s.fuel_updated_at, now)}` : "jamais renseignée"}`,
    danger: false,
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink-900">Trafic des 30 derniers jours</p>
        <dl className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {traffic.map((item) => (
            <div key={item.label} className="rounded-field bg-surface-1 p-3">
              <dt className="text-xs text-ink-600">{item.label}</dt>
              <dd className="text-lg font-semibold text-ink-900">{item.value.toLocaleString("fr-FR")}</dd>
            </div>
          ))}
        </dl>
      </div>
      <AlertList title="Ruptures depuis plus de 24 h" items={outages} />
      <AlertList title="Stations à renseigner" items={stale} />
      {!outages.length && !stale.length ? <p className="text-sm text-ink-700">Aucune alerte : toutes les stations sont à jour.</p> : null}
    </div>
  );
}
