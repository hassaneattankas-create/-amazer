"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/lib/api-error";
import { updateManagedOutlet } from "@/services/local-services-service";
import { createOutletDelivery, invalidateStationQueries, resolveStationReport, updateManagedOutletInfo } from "@/services/station-space-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, FUEL_STATE_LABELS, type FuelKey, type FuelState } from "@/types/local-services";
import type { DeliveryInput, StationInfoUpdate } from "@/types/station-space";

const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));

/**
 * Actions d'une station via /station-manager (autorisées au gérant, au responsable de la ville et au propriétaire).
 * Chaque succès affiche un message court et invalide toutes les vues station (invalidateStationQueries).
 * Utiliser `.mutate` pour les boutons, `.mutateAsync` pour les props `onSave`/`onSubmit` des éditeurs partagés.
 */
export function useStationActions(outletId: string) {
  const queryClient = useQueryClient();
  const done = (message: string) => {
    toast.success(message);
    void invalidateStationQueries(queryClient);
  };

  const setFuel = useMutation({
    mutationFn: ({ fuel, state }: { fuel: FuelKey; state: FuelState }) => updateManagedOutlet(outletId, { fuel: { [fuel]: state } }),
    onSuccess: (_data, vars) => done(`${FUEL_LABELS[vars.fuel]} : ${FUEL_STATE_LABELS[vars.state]}.`),
    onError,
  });
  const confirm = useMutation({
    mutationFn: () => updateManagedOutlet(outletId, { confirm: true }),
    onSuccess: () => done("Disponibilités confirmées."),
    onError,
  });
  const saveInfo = useMutation({
    mutationFn: (patch: StationInfoUpdate) => updateManagedOutletInfo(outletId, patch),
    onSuccess: (_data, patch) =>
      done(patch.maps_link !== undefined || patch.latitude !== undefined ? "Position enregistrée : l'itinéraire mène à la station." : "Informations enregistrées."),
    onError,
  });
  const recordDelivery = useMutation({
    mutationFn: (input: DeliveryInput) => createOutletDelivery(outletId, input),
    onSuccess: () => done("Livraison enregistrée."),
    onError,
  });
  const resolveReport = useMutation({
    mutationFn: ({ reportId, resolution }: { reportId: string; resolution?: string }) => resolveStationReport(reportId, { resolution }),
    onSuccess: () => done("Retour marqué traité."),
    onError,
  });

  const busy = setFuel.isPending || confirm.isPending || saveInfo.isPending || recordDelivery.isPending || resolveReport.isPending;
  return { setFuel, confirm, saveInfo, recordDelivery, resolveReport, busy };
}
