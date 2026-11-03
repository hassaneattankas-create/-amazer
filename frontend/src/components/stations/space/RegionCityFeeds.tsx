"use client";

import { useQuery } from "@tanstack/react-query";

import { ActivityList, ReportList } from "@/components/stations/shared";
import { listRegionActivity, listRegionReports, stationKeys } from "@/services/station-space-service";
import type { RegionCity } from "@/types/station-space";

import { useRegionActions } from "./use-region-actions";

type CityProps = { city: RegionCity };

/** Journal de la ville : ce que font les gérants (et le propriétaire) station par station. */
export function RegionActivity({ city }: CityProps) {
  const query = useQuery({
    queryKey: stationKeys.regionActivity(city.vendor_id, city.city),
    queryFn: () => listRegionActivity({ vendor_id: city.vendor_id, city: city.city }),
  });
  return (
    <ActivityList
      items={query.data}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      showOutlet
      filters={{ outlet: true }}
      emptyText={`Aucune activité à ${city.city} ces 90 derniers jours. Désignez un gérant par station pour que les mises à jour arrivent.`}
    />
  );
}

/** Retours clients des stations de la ville (30 jours), non traités d'abord. */
export function RegionReports({ city }: CityProps) {
  const query = useQuery({
    queryKey: stationKeys.regionReports(city.vendor_id, city.city),
    queryFn: () => listRegionReports({ vendor_id: city.vendor_id, city: city.city }),
  });
  const { resolveReport } = useRegionActions();
  return (
    <ReportList
      items={query.data}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      showOutlet
      busy={resolveReport.isPending}
      onResolve={city.can_update ? (reportId, resolution) => resolveReport.mutateAsync({ reportId, resolution }) : undefined}
      emptyText="Aucun retour client ces 30 derniers jours."
    />
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-field bg-surface-1 p-3">
      <p className="text-xs font-medium text-ink-600">{label}</p>
      <p className="text-lg font-semibold text-ink-900">{value}</p>
      {hint ? <p className="text-xs text-ink-600">{hint}</p> : null}
    </div>
  );
}

/** Résumé chiffré de la ville : fraîcheur, ruptures, gérants, trafic 30 jours. */
export function RegionSummary({ city }: CityProps) {
  const t = city.totals;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="À jour" value={`${t.fresh}/${t.stations}`} />
        <Tile label="À confirmer" value={String(t.to_confirm)} />
        <Tile label="En rupture" value={String(t.out)} hint="au moins un carburant" />
        <Tile label="Sans gérant" value={String(t.without_manager)} />
        <Tile label="Retours ouverts" value={String(t.open_reports)} />
      </div>
      <p className="text-sm text-ink-700">
        <span className="font-semibold text-ink-900">30 jours : </span>
        {t.routes_30d} itinéraires · {t.calls_30d} appels · {t.gas_orders_30d} commandes de gaz
      </p>
    </div>
  );
}
