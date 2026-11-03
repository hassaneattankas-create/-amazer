"use client";

import { Pause, Play, Trash2 } from "lucide-react";

import {
  DeliveryForm,
  FuelAvailabilityEditor,
  ManagersEditor,
  StationInfoForm,
  StationPositionEditor,
  useStationActions,
} from "@/components/stations/shared";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { plural } from "@/components/stations/space/space-text";
import type { FuelOutlet } from "@/types/local-services";

import { OwnerStationRename } from "./OwnerStationRename";
import { useOwnerOutletActions } from "./use-owner-outlet-actions";

const CLOSED_REASON = "Station fermée : rouvrez-la pour la mettre à jour.";

/** Contenu d'une station côté propriétaire : sous-sections repliables, comme chez le gérant. */
export function OwnerStationPanel({ outlet, cityChoices }: { outlet: FuelOutlet; cityChoices: string[] }) {
  const station = useStationActions(outlet.id);
  const owner = useOwnerOutletActions();
  const closed = !outlet.is_active;
  const managerBusy = owner.addManager.isPending || owner.removeManager.isPending;
  const stateBusy = owner.setActive.isPending || owner.removeStation.isPending;

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-600">
        30 derniers jours : {plural(outlet.routes_30d ?? 0, "itinéraire")} · {plural(outlet.calls_30d ?? 0, "appel")} · {plural(outlet.gas_orders_30d ?? 0, "commande")} de gaz
      </p>
      <Accordion single defaultOpen="fuel">
        <AccordionItem id="fuel" variant="row" headingLevel={5} title="Disponibilités">
          <FuelAvailabilityEditor
            stationName={outlet.name}
            fuel={outlet.fuel}
            fuelFresh={outlet.fuel_fresh}
            fuelUpdatedAt={outlet.fuel_updated_at}
            busy={station.busy}
            disabled={closed}
            disabledReason={CLOSED_REASON}
            layout="stacked"
            onSetFuel={(fuel, state) => station.setFuel.mutateAsync({ fuel, state })}
            onConfirm={() => station.confirm.mutate()}
          />
        </AccordionItem>
        <AccordionItem
          id="managers"
          variant="row"
          headingLevel={5}
          title="Gérants"
          meta={outlet.managers.length ? String(outlet.managers.length) : "Aucun"}
          tone={outlet.managers.length ? "default" : "warning"}
        >
          <ManagersEditor
            managers={outlet.managers}
            stationName={outlet.name}
            busy={managerBusy}
            onAdd={(email) => owner.addManager.mutateAsync({ outlet_id: outlet.id, email })}
            onRemove={(id) => owner.removeManager.mutate(id)}
            emptyText="Aucun gérant : les relances arrivent au responsable de la ville, sinon à vous."
          />
        </AccordionItem>
        <AccordionItem id="info" variant="row" headingLevel={5} title="Informations et horaires">
          <StationInfoForm info={outlet.info} busy={station.busy} onSave={station.saveInfo.mutateAsync} />
        </AccordionItem>
        <AccordionItem id="position" variant="row" headingLevel={5} title="Position Google Maps" meta={outlet.info.latitude == null ? "À enregistrer" : undefined} tone="warning">
          <StationPositionEditor
            latitude={outlet.info.latitude}
            longitude={outlet.info.longitude}
            mapsUrl={outlet.info.maps_url || outlet.maps_url}
            busy={station.busy}
            onSave={station.saveInfo.mutateAsync}
          />
        </AccordionItem>
        <AccordionItem id="rename" variant="row" headingLevel={5} title="Nom et ville">
          <OwnerStationRename outlet={outlet} cityChoices={cityChoices} />
        </AccordionItem>
        <AccordionItem id="delivery" variant="row" headingLevel={5} title="Enregistrer une livraison">
          <DeliveryForm
            busy={station.busy}
            disabled={closed}
            onSubmit={station.recordDelivery.mutateAsync}
            onMarkAvailable={(fuel) => station.setFuel.mutate({ fuel, state: "available" })}
          />
        </AccordionItem>
      </Accordion>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={stateBusy}
          onClick={() => owner.setActive.mutate({ id: outlet.id, active: closed, name: outlet.name })}
        >
          {closed ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          {closed ? "Rouvrir la station" : "Indiquer fermée"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 text-danger hover:text-danger"
          disabled={stateBusy}
          onClick={() => {
            if (window.confirm(`Supprimer la station « ${outlet.name} » ? Son historique reste dans le journal.`)) {
              owner.removeStation.mutate({ id: outlet.id, name: outlet.name });
            }
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Supprimer
        </Button>
      </div>
    </div>
  );
}
