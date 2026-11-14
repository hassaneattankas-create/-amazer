"use client";

import { useState } from "react";

import { FuelAvailabilityEditor, ManagersEditor, MeterReadingsPanel, StationDutyEditor, StationInfoForm, StationPositionEditor, useStationActions } from "@/components/stations/shared";
import { cn } from "@/lib/utils";
import type { RegionCity, RegionStation } from "@/types/station-space";

import { OutletDeliveries } from "./OutletFeeds";
import { RegionStationManage } from "./RegionStationManage";
import { useRegionActions } from "./use-region-actions";

type Tab = "fuel" | "managers" | "info" | "sales" | "deliveries" | "manage";

const TABS: { id: Tab; label: string }[] = [
  { id: "fuel", label: "Disponibilités" },
  { id: "managers", label: "Gérants" },
  { id: "info", label: "Infos et position" },
  { id: "sales", label: "Ventes" },
  { id: "deliveries", label: "Livraisons" },
  { id: "manage", label: "Gestion" },
];

export type RegionStationPanelProps = { station: RegionStation; city: RegionCity };

/**
 * Une station vue par le responsable de ville. Sélecteur de sections (plutôt qu'un 3e niveau d'accordéon)
 * pour garder toute la largeur utile sur mobile.
 */
export function RegionStationPanel({ station, city }: RegionStationPanelProps) {
  const [tab, setTab] = useState<Tab>("fuel");
  const actions = useStationActions(station.id);
  const region = useRegionActions();
  const writable = city.can_update && station.is_active;
  const panelId = `station-${station.id}-section`;

  return (
    <div className="space-y-3">
      {city.can_update && !station.is_active ? (
        <p className="rounded-field bg-warning/10 p-3 text-sm text-ink-800">Station fermée : rouvrez-la dans « Gestion » pour la mettre à jour.</p>
      ) : null}

      <div role="group" aria-label={`Sections de « ${station.name} »`} className="grid grid-cols-2 gap-1 rounded-field bg-surface-1 p-1 sm:grid-cols-3">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={tab === entry.id}
            aria-controls={panelId}
            onClick={() => setTab(entry.id)}
            className={cn(
              "min-h-11 rounded-field px-2 text-sm transition-colors duration-fast last:col-span-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:last:col-span-1",
              tab === entry.id ? "bg-card font-semibold text-ink-900 shadow-hairline" : "text-ink-700 hover:bg-surface-2",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div id={panelId}>
        {tab === "fuel" ? (
          <FuelAvailabilityEditor
            layout="stacked"
            stationName={station.name}
            fuel={station.fuel}
            fuelFresh={station.fuel_fresh}
            fuelUpdatedAt={station.fuel_updated_at}
            busy={actions.busy}
            disabled={!writable}
            onSetFuel={(fuel, state) => actions.setFuel.mutateAsync({ fuel, state })}
            onConfirm={() => actions.confirm.mutate()}
          />
        ) : null}

        {tab === "managers" ? (
          <ManagersEditor
            managers={station.managers}
            stationName={station.name}
            busy={region.busy}
            disabled={!city.can_update}
            onAdd={(email) => region.addManager.mutateAsync({ outlet_id: station.id, email })}
            onRemove={(managerId) => region.removeManager.mutate(managerId)}
            emptyText="Aucun gérant : désignez la personne qui met la station à jour."
          />
        ) : null}

        {tab === "info" ? (
          <div className="space-y-4">
            <StationInfoForm info={station.info} busy={actions.busy} disabled={!writable} onSave={actions.saveInfo.mutateAsync} />
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-semibold text-ink-900">Garde</p>
              <StationDutyEditor info={station.info} busy={actions.busy} disabled={!writable} onSave={actions.saveInfo.mutateAsync} />
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-semibold text-ink-900">Position Google Maps</p>
              <StationPositionEditor
                latitude={station.info.latitude}
                longitude={station.info.longitude}
                mapsUrl={station.info.maps_url}
                busy={actions.busy}
                disabled={!writable}
                onSave={actions.saveInfo.mutateAsync}
              />
            </div>
          </div>
        ) : null}

        {tab === "sales" ? <MeterReadingsPanel outletId={station.id} disabled={!writable} /> : null}
        {tab === "deliveries" ? <OutletDeliveries outletId={station.id} actions={actions} disabled={!writable} /> : null}

        {tab === "manage" ? <RegionStationManage station={station} disabled={!city.can_update} /> : null}
      </div>
    </div>
  );
}
