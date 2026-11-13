"use client";

import { Clock3, Flag, Fuel, MapPin, Moon, Store, Truck } from "lucide-react";

import { FuelAvailabilityEditor, StationDutyEditor, StationInfoForm, StationPositionEditor, stationFreshness, useStationActions } from "@/components/stations/shared";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { useNow } from "@/hooks/use-now";
import type { ManagedOutlet } from "@/types/local-services";

import { OutletActivity, OutletDeliveries, OutletReports } from "./OutletFeeds";

/** Contenu d'une station du gérant : sections repliables (dont la garde), disponibilités ouvertes d'abord. */
function ManagedStationPanel({ outlet }: { outlet: ManagedOutlet }) {
  const actions = useStationActions(outlet.id);
  const disabled = !outlet.can_update;
  const icon = "h-4 w-4";
  const hasPosition = outlet.info.latitude != null && outlet.info.longitude != null;

  return (
    <div className="space-y-3">
      {disabled ? (
        <p className="rounded-field bg-warning/10 p-3 text-sm text-ink-800">
          Mises à jour suspendues : la station est fermée ou l&apos;abonnement de la marque a expiré. Prévenez votre responsable.
        </p>
      ) : null}
      <Accordion single defaultOpen="fuel">
        <AccordionItem id="fuel" variant="row" headingLevel={4} title="Disponibilités" icon={<Fuel className={icon} />}>
          <FuelAvailabilityEditor
            layout="stacked"
            stationName={outlet.name}
            fuel={outlet.fuel}
            fuelFresh={outlet.fuel_fresh}
            fuelUpdatedAt={outlet.fuel_updated_at}
            busy={actions.busy}
            disabled={disabled}
            onSetFuel={(fuel, state) => actions.setFuel.mutateAsync({ fuel, state })}
            onConfirm={() => actions.confirm.mutate()}
          />
        </AccordionItem>
        <AccordionItem id="info" variant="row" headingLevel={4} title="Informations et horaires" icon={<Store className={icon} />}>
          <StationInfoForm info={outlet.info} busy={actions.busy} disabled={disabled} onSave={actions.saveInfo.mutateAsync} />
        </AccordionItem>
        <AccordionItem id="duty" variant="row" headingLevel={4} title="Garde" icon={<Moon className={icon} />} meta={outlet.info.on_duty_now ? "De garde" : undefined}>
          <StationDutyEditor info={outlet.info} busy={actions.busy} disabled={disabled} onSave={actions.saveInfo.mutateAsync} />
        </AccordionItem>
        <AccordionItem
          id="position"
          variant="row"
          headingLevel={4}
          title="Position Google Maps"
          icon={<MapPin className={icon} />}
          meta={hasPosition ? undefined : "À enregistrer"}
          tone="warning"
        >
          <StationPositionEditor
            latitude={outlet.info.latitude}
            longitude={outlet.info.longitude}
            mapsUrl={outlet.info.maps_url}
            busy={actions.busy}
            disabled={disabled}
            onSave={actions.saveInfo.mutateAsync}
          />
        </AccordionItem>
        <AccordionItem id="deliveries" variant="row" headingLevel={4} title="Livraisons" icon={<Truck className={icon} />}>
          <OutletDeliveries outletId={outlet.id} actions={actions} disabled={disabled} />
        </AccordionItem>
        <AccordionItem
          id="reports"
          variant="row"
          headingLevel={4}
          title="Retours clients"
          icon={<Flag className={icon} />}
          meta={outlet.open_reports > 0 ? `${outlet.open_reports} ouvert${outlet.open_reports > 1 ? "s" : ""}` : undefined}
          tone="warning"
        >
          <OutletReports outletId={outlet.id} actions={actions} disabled={!outlet.can_resolve} />
        </AccordionItem>
        <AccordionItem id="history" variant="row" headingLevel={4} title="Historique" icon={<Clock3 className={icon} />}>
          <OutletActivity outletId={outlet.id} />
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/** « Mes stations » : les stations confiées directement au gérant, la première ouverte. */
export function ManagedStationsSection({ outlets }: { outlets: ManagedOutlet[] }) {
  const now = useNow();
  return (
    <section aria-labelledby="station-space-stations" className="space-y-2">
      <h2 id="station-space-stations" className="text-lg font-semibold text-ink-900">
        Mes stations
      </h2>
      <Accordion single defaultOpen={outlets[0]?.id}>
        {outlets.map((outlet) => {
          const fresh = stationFreshness(outlet, now);
          return (
            <AccordionItem
              key={outlet.id}
              id={outlet.id}
              headingLevel={3}
              title={outlet.name}
              description={`${outlet.brand_name} · ${outlet.city}`}
              icon={<Fuel className="h-5 w-5" />}
              meta={fresh.label}
              tone={fresh.tone}
            >
              <ManagedStationPanel outlet={outlet} />
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
