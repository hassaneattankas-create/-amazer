"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/lib/api-error";
import {
  addRegionStationManager,
  createRegionOutlet,
  deleteRegionOutlet,
  invalidateStationQueries,
  removeRegionStationManager,
  resolveStationReport,
  updateRegionOutlet,
} from "@/services/station-space-service";
import { toast } from "@/store/toast-store";
import type { RegionOutletCreate, RegionOutletUpdate } from "@/types/station-space";

const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));

/**
 * Actions du responsable de ville (/station-region) : stations et gérants de sa ville, retours clients.
 * Une instance par station (ou par formulaire) : `isPending` ne bloque que l'élément concerné.
 */
export function useRegionActions() {
  const queryClient = useQueryClient();
  const done = (message: string) => {
    toast.success(message);
    void invalidateStationQueries(queryClient);
  };

  const createOutlet = useMutation({
    mutationFn: (payload: RegionOutletCreate) => createRegionOutlet(payload),
    onSuccess: (station) => done(`Station « ${station.name} » ajoutée.`),
    onError,
  });
  const updateOutlet = useMutation({
    mutationFn: ({ outletId, patch }: { outletId: string; patch: RegionOutletUpdate }) => updateRegionOutlet(outletId, patch),
    onSuccess: (_station, { patch }) =>
      done(patch.is_active === undefined ? "Station renommée." : patch.is_active ? "Station ouverte." : "Station fermée."),
    onError,
  });
  const deleteOutlet = useMutation({
    mutationFn: (outletId: string) => deleteRegionOutlet(outletId),
    onSuccess: () => done("Station supprimée."),
    onError,
  });
  const addManager = useMutation({
    mutationFn: (payload: { outlet_id: string; email: string }) => addRegionStationManager(payload),
    onSuccess: () => done("Gérant ajouté : il est prévenu."),
    onError,
  });
  const removeManager = useMutation({
    mutationFn: (managerId: string) => removeRegionStationManager(managerId),
    onSuccess: () => done("Gérant retiré."),
    onError,
  });
  const resolveReport = useMutation({
    mutationFn: ({ reportId, resolution }: { reportId: string; resolution?: string }) => resolveStationReport(reportId, { resolution }),
    onSuccess: () => done("Retour marqué traité."),
    onError,
  });

  const busy =
    createOutlet.isPending ||
    updateOutlet.isPending ||
    deleteOutlet.isPending ||
    addManager.isPending ||
    removeManager.isPending ||
    resolveReport.isPending;
  return { createOutlet, updateOutlet, deleteOutlet, addManager, removeManager, resolveReport, busy };
}
