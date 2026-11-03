"use client";

import { useQuery } from "@tanstack/react-query";

import { ActivityList, DeliveryForm, DeliveryList, ReportList, type useStationActions } from "@/components/stations/shared";
import { listOutletActivity, listOutletDeliveries, listOutletReports, stationKeys } from "@/services/station-space-service";

type StationActions = ReturnType<typeof useStationActions>;
type OutletProps = { outletId: string; actions: StationActions; disabled: boolean };

/** Livraisons : formulaire d'enregistrement puis liste des 30 derniers jours. */
export function OutletDeliveries({ outletId, actions, disabled }: OutletProps) {
  const query = useQuery({ queryKey: stationKeys.outletDeliveries(outletId), queryFn: () => listOutletDeliveries(outletId) });
  return (
    <div className="space-y-4">
      <DeliveryForm
        busy={actions.busy}
        disabled={disabled}
        onSubmit={actions.recordDelivery.mutateAsync}
        onMarkAvailable={(fuel) => actions.setFuel.mutate({ fuel, state: "available" })}
      />
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm font-semibold text-ink-900">30 derniers jours</p>
        <DeliveryList
          items={query.data}
          isLoading={query.isPending}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyText="Aucune livraison enregistrée. Notez chaque camion reçu : le propriétaire suit les volumes."
        />
      </div>
    </div>
  );
}

/** Retours clients de la station (30 jours) : « Marquer traité » avec une note facultative. */
export function OutletReports({ outletId, actions, disabled }: OutletProps) {
  const query = useQuery({ queryKey: stationKeys.outletReports(outletId), queryFn: () => listOutletReports(outletId) });
  return (
    <ReportList
      items={query.data}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      busy={actions.busy}
      onResolve={disabled ? undefined : (reportId, resolution) => actions.resolveReport.mutateAsync({ reportId, resolution })}
      emptyText="Aucun retour client ces 30 derniers jours."
    />
  );
}

/** Historique de la station : qui a changé quoi, et quand. */
export function OutletActivity({ outletId }: { outletId: string }) {
  const query = useQuery({ queryKey: stationKeys.outletActivity(outletId), queryFn: () => listOutletActivity(outletId) });
  return (
    <ActivityList
      items={query.data}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      showOutlet={false}
      emptyText="Aucune activité ces 90 derniers jours."
    />
  );
}
