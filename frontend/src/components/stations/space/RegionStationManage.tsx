"use client";

import { useId, useState } from "react";
import { Lock, RotateCcw, Trash2 } from "lucide-react";

import { stationFieldClass, stationLabelClass } from "@/components/stations/shared";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast-store";
import type { RegionStation } from "@/types/station-space";

import { useRegionActions } from "./use-region-actions";

export type RegionStationManageProps = {
  station: RegionStation;
  /** Abonnement de la marque expiré : rien n'est modifiable. */
  disabled?: boolean;
};

/** Renommer, ouvrir/fermer et supprimer une station de sa ville. */
export function RegionStationManage({ station, disabled = false }: RegionStationManageProps) {
  const uid = useId();
  // Le nom du serveur change (autre appareil, propriétaire) : on repart de lui.
  const [name, setName] = useState(station.name);
  const [syncedName, setSyncedName] = useState(station.name);
  if (syncedName !== station.name) {
    setSyncedName(station.name);
    setName(station.name);
  }
  const { updateOutlet, deleteOutlet, busy } = useRegionActions();
  const locked = busy || disabled;
  const trimmed = name.trim();

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed.length < 2) {
            toast.error("Le nom doit faire au moins 2 caractères.");
            return;
          }
          updateOutlet.mutate({ outletId: station.id, patch: { name: trimmed } });
        }}
      >
        <label className={stationLabelClass} htmlFor={`${uid}-name`}>
          Nom de la station
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${uid}-name`}
            className={`${stationFieldClass} mt-0 sm:flex-1`}
            value={name}
            maxLength={140}
            required
            disabled={locked}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" variant="outline" className="min-h-11" disabled={locked || trimmed === station.name}>
            Renommer
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={locked}
          onClick={() => {
            if (station.is_active && !window.confirm(`Fermer « ${station.name} » ? Elle n'apparaîtra plus aux clients.`)) return;
            updateOutlet.mutate({ outletId: station.id, patch: { is_active: !station.is_active } });
          }}
        >
          {station.is_active ? <Lock className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
          {station.is_active ? "Fermer la station" : "Rouvrir la station"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 text-danger hover:text-danger"
          disabled={locked}
          onClick={() => {
            if (window.confirm(`Supprimer « ${station.name} » ? Ses informations et ses gérants seront effacés.`)) deleteOutlet.mutate(station.id);
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Supprimer
        </Button>
      </div>
    </div>
  );
}
