"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/lib/api-error";
import {
  addFuelManager,
  addRegionManager,
  bulkUpdateOutlets,
  createOutlet,
  deleteOutlet,
  removeFuelManager,
  removeRegionManager,
  updateOutlet,
} from "@/services/local-services-service";
import { invalidateStationQueries, resolveSellerStationReport } from "@/services/station-space-service";
import { toast } from "@/store/toast-store";
import type { FuelOutletInput, FuelStatus } from "@/types/local-services";

const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));

/**
 * Actions réservées au propriétaire de la marque (routes /seller) : stations, gérants, responsables de ville,
 * mise à jour groupée et retours clients. Chaque succès affiche un message court et rafraîchit les trois niveaux.
 */
export function useOwnerOutletActions() {
  const queryClient = useQueryClient();
  const done = (message: string) => {
    toast.success(message);
    void invalidateStationQueries(queryClient);
  };

  const createStation = useMutation({
    mutationFn: (input: FuelOutletInput) => createOutlet(input),
    onSuccess: (outlet) => done(`Station « ${outlet.name} » ajoutée.`),
    onError,
  });
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean; name: string }) => updateOutlet(id, { is_active: active }),
    onSuccess: (_data, vars) => done(vars.active ? `${vars.name} est rouverte.` : `${vars.name} est indiquée fermée.`),
    onError,
  });
  const rename = useMutation({
    mutationFn: ({ id, name, city }: { id: string; name?: string; city?: string }) => updateOutlet(id, { name, city }),
    onSuccess: (outlet) => done(`Station « ${outlet.name} » (${outlet.city}) enregistrée.`),
    onError,
  });
  const removeStation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deleteOutlet(id),
    onSuccess: (_data, vars) => done(`Station « ${vars.name} » supprimée.`),
    onError,
  });
  const addManager = useMutation({
    mutationFn: (payload: { outlet_id: string; email: string }) => addFuelManager(payload),
    onSuccess: () => done("Gérant ajouté. Il a reçu une notification."),
    onError,
  });
  const removeManager = useMutation({
    mutationFn: (managerId: string) => removeFuelManager(managerId),
    onSuccess: () => done("Gérant retiré."),
    onError,
  });
  const addCityManager = useMutation({
    mutationFn: (payload: { city: string; email: string }) => addRegionManager(payload),
    onSuccess: () => done("Responsable ajouté. Il a reçu une notification."),
    onError,
  });
  const removeCityManager = useMutation({
    mutationFn: (managerId: string) => removeRegionManager(managerId),
    onSuccess: () => done("Responsable retiré."),
    onError,
  });
  const bulk = useMutation({
    mutationFn: (payload: { fuel?: FuelStatus; confirm?: boolean; city?: string; done: string }) =>
      bulkUpdateOutlets({ fuel: payload.fuel, confirm: payload.confirm, city: payload.city }),
    onSuccess: (_rows, vars) => done(vars.done),
    onError,
  });
  const resolveReport = useMutation({
    mutationFn: ({ reportId, resolution }: { reportId: string; resolution?: string }) => resolveSellerStationReport(reportId, { resolution }),
    onSuccess: () => done("Retour marqué traité."),
    onError,
  });

  return { createStation, setActive, rename, removeStation, addManager, removeManager, addCityManager, removeCityManager, bulk, resolveReport };
}
