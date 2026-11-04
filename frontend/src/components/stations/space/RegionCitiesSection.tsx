"use client";

import { BarChart3, ClipboardList, Flag, Fuel, MapPin } from "lucide-react";

import { stationFreshness } from "@/components/stations/shared";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { useNow } from "@/hooks/use-now";
import type { RegionCity, RegionStation } from "@/types/station-space";

import { RegionAddStationForm } from "./RegionAddStationForm";
import { RegionActivity, RegionReports, RegionSummary } from "./RegionCityFeeds";
import { RegionStationPanel } from "./RegionStationPanel";
import { plural } from "./space-text";

const cityKey = (city: RegionCity) => `${city.vendor_id}:${city.city}`;

/** Stations listées (fermées comprises) : « 3 stations · 1 fermée ». Les totaux ne comptent que les ouvertes. */
function stationCount(city: RegionCity): string {
  const closed = city.stations.filter((station) => !station.is_active).length;
  const count = plural(city.stations.length, "station");
  return closed ? `${count} · ${plural(closed, "fermée")}` : count;
}

function cityMeta(city: RegionCity): string {
  const parts = [city.brand_name, stationCount(city)];
  if (city.totals.to_confirm > 0) parts.push(`${city.totals.to_confirm} à renseigner`);
  return parts.join(" · ");
}

function managerLine(station: RegionStation): string {
  if (station.managers.length === 0) return "Sans gérant";
  const first = station.managers[0];
  const name = first.full_name?.trim() || first.email;
  return station.managers.length > 1 ? `Gérant : ${name} +${station.managers.length - 1}` : `Gérant : ${name}`;
}

function CityStations({ city }: { city: RegionCity }) {
  const now = useNow();
  return (
    <div className="space-y-3">
      {city.stations.length === 0 ? (
        <p className="rounded-field bg-surface-1 p-3 text-sm text-ink-700">Aucune station à {city.city} pour l&apos;instant. Ajoutez la première.</p>
      ) : (
        <Accordion single>
          {city.stations.map((station) => {
            const fresh = stationFreshness(station, now);
            return (
              <AccordionItem
                key={station.id}
                id={station.id}
                variant="row"
                headingLevel={5}
                title={station.name}
                description={managerLine(station)}
                meta={fresh.label}
                tone={fresh.tone}
              >
                <RegionStationPanel station={station} city={city} />
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
      <RegionAddStationForm vendorId={city.vendor_id} city={city.city} disabled={!city.can_update} />
    </div>
  );
}

function CityPanel({ city }: { city: RegionCity }) {
  const icon = "h-4 w-4";
  const openReports = city.totals.open_reports;
  return (
    <div className="space-y-3">
      {!city.can_update ? (
        <p className="rounded-field bg-warning/10 p-3 text-sm text-ink-800">
          Mises à jour suspendues : l&apos;abonnement de {city.brand_name} a expiré. Prévenez le propriétaire de la marque.
        </p>
      ) : null}
      <Accordion single defaultOpen="stations">
        <AccordionItem id="stations" variant="row" headingLevel={4} title="Stations" icon={<Fuel className={icon} />} meta={stationCount(city)}>
          <CityStations city={city} />
        </AccordionItem>
        <AccordionItem id="activity" variant="row" headingLevel={4} title="Activité des gérants" icon={<ClipboardList className={icon} />}>
          <RegionActivity city={city} />
        </AccordionItem>
        <AccordionItem
          id="reports"
          variant="row"
          headingLevel={4}
          title="Retours clients"
          icon={<Flag className={icon} />}
          meta={openReports > 0 ? `${openReports} ouvert${openReports > 1 ? "s" : ""}` : undefined}
          tone="warning"
        >
          <RegionReports city={city} />
        </AccordionItem>
        <AccordionItem id="summary" variant="row" headingLevel={4} title="Résumé" icon={<BarChart3 className={icon} />}>
          <RegionSummary city={city} />
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/** « Mes villes » : une entrée par marque et ville confiées au responsable. */
export function RegionCitiesSection({ cities }: { cities: RegionCity[] }) {
  return (
    <section aria-labelledby="station-space-cities" className="space-y-2">
      <h2 id="station-space-cities" className="text-lg font-semibold text-ink-900">
        Mes villes
      </h2>
      <Accordion single defaultOpen={cities.length === 1 ? cityKey(cities[0]) : undefined}>
        {cities.map((city) => (
          <AccordionItem
            key={cityKey(city)}
            id={cityKey(city)}
            headingLevel={3}
            title={city.city}
            icon={<MapPin className="h-5 w-5" />}
            meta={cityMeta(city)}
            tone={city.totals.to_confirm > 0 ? "warning" : "default"}
          >
            <CityPanel city={city} />
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
