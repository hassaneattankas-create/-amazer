"use client";

import { useId, useState } from "react";

import { stationFieldClass, stationLabelClass } from "@/components/stations/shared";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast-store";
import type { FuelOutlet } from "@/types/local-services";

import { CitySelect } from "./CitySelect";
import { useOwnerOutletActions } from "./use-owner-outlet-actions";

export type OwnerStationRenameProps = {
  outlet: FuelOutlet;
  /** Villes proposées (Niger + villes des stations existantes). */
  cityChoices: string[];
};

/** Nom et ville d'une station (propriétaire seulement : le responsable de ville ne peut que renommer). */
export function OwnerStationRename({ outlet, cityChoices }: OwnerStationRenameProps) {
  const uid = useId();
  const { rename } = useOwnerOutletActions();
  // Valeurs du serveur modifiées ailleurs (autre appareil, responsable) : on repart d'elles.
  const [synced, setSynced] = useState({ name: outlet.name, city: outlet.city });
  const [name, setName] = useState(outlet.name);
  const [city, setCity] = useState(outlet.city);
  if (synced.name !== outlet.name || synced.city !== outlet.city) {
    setSynced({ name: outlet.name, city: outlet.city });
    setName(outlet.name);
    setCity(outlet.city);
  }
  const busy = rename.isPending;
  const nextName = name.trim();
  const nextCity = city.trim();
  const unchanged = nextName === outlet.name && nextCity === outlet.city;

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (nextName.length < 2) {
          toast.error("Le nom doit faire au moins 2 caractères.");
          return;
        }
        if (nextCity.length < 2) {
          toast.error("Indiquez la ville de la station.");
          return;
        }
        rename.mutate({
          id: outlet.id,
          name: nextName === outlet.name ? undefined : nextName,
          city: nextCity === outlet.city ? undefined : nextCity,
        });
      }}
    >
      <label className={stationLabelClass} htmlFor={`${uid}-name`}>
        Nom de la station
        <input
          id={`${uid}-name`}
          className={stationFieldClass}
          value={name}
          maxLength={140}
          required
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <CitySelect label="Ville" value={city} onChange={setCity} options={cityChoices} disabled={busy} />
      <div className="sm:col-span-2">
        <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busy || unchanged}>
          Enregistrer le nom et la ville
        </Button>
      </div>
    </form>
  );
}
