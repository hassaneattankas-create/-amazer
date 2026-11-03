"use client";

import { Building2, Fuel, Layers, Plus } from "lucide-react";

import { ServiceStatusPanel } from "@/components/seller/ServiceStatusPanel";
import { StationDataState, stationFreshness } from "@/components/stations/shared";
import { plural } from "@/components/stations/space/space-text";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { useNow } from "@/hooks/use-now";
import type { FuelOutlet } from "@/types/local-services";

import { AddStationForm } from "./AddStationForm";
import { BulkUpdateTool } from "./BulkUpdateTool";
import { OwnerStationPanel } from "./OwnerStationPanel";

/** Regroupe les stations par ville (accents et casse ignorés), villes et stations triées par nom. */
export function groupOutletsByCity(outlets: FuelOutlet[]): { city: string; outlets: FuelOutlet[] }[] {
  const groups: { city: string; outlets: FuelOutlet[] }[] = [];
  for (const outlet of outlets) {
    const group = groups.find((g) => g.city.localeCompare(outlet.city, "fr", { sensitivity: "base" }) === 0);
    if (group) group.outlets.push(outlet);
    else groups.push({ city: outlet.city, outlets: [outlet] });
  }
  for (const group of groups) group.outlets.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return groups.sort((a, b) => a.city.localeCompare(b.city, "fr"));
}

function cityMeta(outlets: FuelOutlet[]): { text: string; warn: boolean } {
  const toConfirm = outlets.filter((o) => o.is_active && !o.fuel_fresh).length;
  const count = `${outlets.length} station${outlets.length > 1 ? "s" : ""}`;
  return { text: toConfirm ? `${count} · ${toConfirm} à confirmer` : count, warn: toConfirm > 0 };
}

export type StationsByCityProps = {
  outlets: FuelOutlet[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Villes proposées dans le formulaire d'ajout. */
  cityChoices: string[];
};

/** Stations par ville : ville → station → sous-sections, puis ajout et mise à jour groupée. */
export function StationsByCity({ outlets, isLoading, isError, onRetry, cityChoices }: StationsByCityProps) {
  const now = useNow();

  if (outlets && outlets.length === 0) {
    return (
      <div className="space-y-4">
        <ServiceStatusPanel kind="fuel_station" />
        <div className="rounded-field border border-border p-3">
          <p className="mb-2 text-sm font-semibold text-ink-900">Ajouter une station</p>
          <AddStationForm cities={cityChoices} />
        </div>
      </div>
    );
  }

  return (
    <StationDataState items={outlets} isLoading={isLoading} isError={isError} onRetry={onRetry} emptyText="Aucune station.">
      {(list) => {
        const groups = groupOutletsByCity(list);
        const activeCities = groups.filter((g) => g.outlets.some((o) => o.is_active)).map((g) => g.city);
        return (
          <Accordion single>
            {groups.map((group) => {
              const meta = cityMeta(group.outlets);
              return (
                <AccordionItem
                  key={group.city}
                  id={`city-${group.city}`}
                  variant="row"
                  headingLevel={3}
                  icon={<Building2 className="h-4 w-4" />}
                  title={group.city}
                  meta={meta.text}
                  tone={meta.warn ? "warning" : "default"}
                >
                  <Accordion single>
                    {group.outlets.map((outlet) => {
                      const fresh = stationFreshness(outlet, now);
                      return (
                        <AccordionItem
                          key={outlet.id}
                          id={outlet.id}
                          variant="row"
                          headingLevel={4}
                          icon={<Fuel className="h-4 w-4" />}
                          title={outlet.name}
                          meta={outlet.open_reports ? `${fresh.label} · ${plural(outlet.open_reports, "retour")}` : fresh.label}
                          tone={fresh.tone === "danger" ? "danger" : outlet.open_reports ? "warning" : fresh.tone}
                        >
                          <OwnerStationPanel outlet={outlet} cityChoices={cityChoices} />
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionItem>
              );
            })}
            <AccordionItem id="add-station" variant="row" headingLevel={3} icon={<Plus className="h-4 w-4" />} title="Ajouter une station">
              <AddStationForm cities={cityChoices} />
            </AccordionItem>
            {list.length > 1 ? (
              <AccordionItem id="bulk" variant="row" headingLevel={3} icon={<Layers className="h-4 w-4" />} title="Mise à jour groupée">
                <BulkUpdateTool cities={activeCities} />
              </AccordionItem>
            ) : null}
          </Accordion>
        );
      }}
    </StationDataState>
  );
}
