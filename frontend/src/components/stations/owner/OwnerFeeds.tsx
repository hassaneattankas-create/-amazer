"use client";

import { useQuery } from "@tanstack/react-query";

import { ActivityList, DeliveryList, ReportList } from "@/components/stations/shared";
import { listMyStationReports } from "@/services/local-services-service";
import { listFuelActivity, listFuelDeliveries, stationKeys } from "@/services/station-space-service";
import type { FuelActivityFilters } from "@/types/station-space";

import { useOwnerOutletActions } from "./use-owner-outlet-actions";

/** Le journal est filtré côté client (ville, rôle) sur les 200 dernières actions. */
const ACTIVITY_FILTERS: FuelActivityFilters = { limit: 200 };

export const ownerReportsQuery = { queryKey: ["station-reports"] as const, queryFn: listMyStationReports };

/** Activité de toute la marque : propriétaire, responsables de ville et gérants. */
export function OwnerActivity() {
  const query = useQuery({ queryKey: stationKeys.fuelActivity(ACTIVITY_FILTERS), queryFn: () => listFuelActivity(ACTIVITY_FILTERS) });
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">Tout ce que font vos responsables et gérants, sur 90 jours.</p>
      <ActivityList
        items={query.data}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        showOutlet
        showCity
        filters={{ city: true, role: true }}
        emptyText="Aucune activité ces 90 derniers jours. Elle apparaîtra dès la première mise à jour d'une station."
      />
    </div>
  );
}

/** Retours clients des 30 derniers jours, non traités d'abord. */
export function OwnerReports() {
  const query = useQuery(ownerReportsQuery);
  const { resolveReport } = useOwnerOutletActions();
  return (
    <ReportList
      items={query.data}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      showOutlet
      busy={resolveReport.isPending}
      onResolve={(reportId, resolution) => resolveReport.mutateAsync({ reportId, resolution })}
      emptyText="Aucun retour client ces 30 derniers jours."
    />
  );
}

/** Livraisons reçues par toutes les stations (30 jours), en lecture seule. */
export function OwnerDeliveries() {
  const query = useQuery({ queryKey: stationKeys.fuelDeliveries(), queryFn: () => listFuelDeliveries() });
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">Enregistrées par les gérants ; vous pouvez en ajouter depuis chaque station.</p>
      <DeliveryList
        items={query.data}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        showOutlet
        emptyText="Aucune livraison enregistrée ces 30 derniers jours."
      />
    </div>
  );
}
