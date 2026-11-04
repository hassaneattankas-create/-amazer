"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";

import { StationDataState, stationFieldClass, stationLabelClass } from "@/components/stations/shared";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/local-services";
import { listRegionManagers } from "@/services/local-services-service";
import type { RegionManager } from "@/types/local-services";

import { CitySelect } from "./CitySelect";
import { useOwnerOutletActions } from "./use-owner-outlet-actions";

function groupByCity(managers: RegionManager[]): [string, RegionManager[]][] {
  const groups = new Map<string, RegionManager[]>();
  for (const manager of managers) groups.set(manager.city, [...(groups.get(manager.city) ?? []), manager]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
}

/** Responsables par ville : liste groupée par ville, retrait, ajout par e-mail. */
export function CityManagersSection({ cities }: { cities: string[] }) {
  const now = useNow();
  const actions = useOwnerOutletActions();
  const [city, setCity] = useState(cities[0] ?? "Niamey");
  const [email, setEmail] = useState("");
  const query = useQuery({ queryKey: ["fuel-region-managers"], queryFn: listRegionManagers });
  const busy = actions.addCityManager.isPending || actions.removeCityManager.isPending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-700">1. Désignez un ou plusieurs responsables par ville · 2. Il nomme les gérants de ses stations.</p>
      <StationDataState
        items={query.data}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        emptyText="Aucun responsable pour l'instant : ajoutez-en un ci-dessous."
      >
        {(managers) => (
          <div className="space-y-3">
            {groupByCity(managers).map(([cityName, list]) => (
              <div key={cityName}>
                <p className="text-sm font-semibold text-ink-900">{cityName}</p>
                <ul className="mt-1 divide-y divide-border rounded-field border border-border">
                  {list.map((manager) => (
                    <li key={manager.id} className="flex items-center gap-2 pl-3">
                      <span className="min-w-0 flex-1 py-2 text-sm">
                        <span className="block truncate font-medium text-ink-900">{manager.full_name || manager.email}</span>
                        <span className="block truncate text-xs text-ink-600">{manager.email}</span>
                        <span className="block text-xs text-ink-600">
                          {manager.stations} station{manager.stations > 1 ? "s" : ""} ·{" "}
                          {manager.last_activity_at ? `actif ${timeAgo(manager.last_activity_at, now)}` : "aucune activité"}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Retirer ${manager.full_name || manager.email} (${cityName})`}
                        onClick={() => {
                          if (window.confirm(`Retirer ${manager.full_name || manager.email} de ${cityName} ?`)) actions.removeCityManager.mutate(manager.id);
                        }}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-field text-ink-600 hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </StationDataState>
      <form
        className="grid gap-3 rounded-field bg-surface-1 p-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = email.trim();
          if (!value || city.trim().length < 2) return;
          void actions.addCityManager
            .mutateAsync({ city: city.trim(), email: value })
            .then(() => setEmail(""))
            .catch(() => undefined);
        }}
      >
        <CitySelect label="Ville" value={city} onChange={setCity} options={cities} disabled={busy} />
        <label className={stationLabelClass}>
          E-mail de son compte AMAZER
          <input
            type="email"
            required
            autoComplete="off"
            className={stationFieldClass}
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="responsable@exemple.com"
          />
        </label>
        <p className="text-xs text-ink-600 sm:col-span-2">La personne crée d&apos;abord un compte AMAZER gratuit.</p>
        <Button type="submit" className="min-h-11 sm:col-span-2" disabled={busy}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {actions.addCityManager.isPending ? "Ajout…" : "Ajouter un responsable"}
        </Button>
      </form>
    </div>
  );
}
