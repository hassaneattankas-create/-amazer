"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { stationFieldClass, stationLabelClass } from "@/components/stations/shared";
import { Button } from "@/components/ui/button";

import { useOwnerOutletActions } from "./use-owner-outlet-actions";

/** Plusieurs stations d'un coup : gaz disponible / en rupture, ou « Rien n'a changé », pour une ville ou partout. */
export function BulkUpdateTool({ cities }: { cities: string[] }) {
  const { bulk } = useOwnerOutletActions();
  const [city, setCity] = useState("");
  const where = city ? `à ${city}` : "partout";
  const scope = city || undefined;

  return (
    <div className="space-y-3">
      <label className={stationLabelClass}>
        Stations concernées
        <select className={stationFieldClass} value={city} disabled={bulk.isPending} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {cities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          className="min-h-11"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ fuel: { gaz: "available" }, city: scope, done: `Gaz disponible ${where}.` })}
        >
          Gaz disponible
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ fuel: { gaz: "out" }, city: scope, done: `Gaz en rupture ${where}.` })}
        >
          Gaz en rupture
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ confirm: true, city: scope, done: `Disponibilités confirmées ${where}.` })}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Rien n&apos;a changé
        </Button>
      </div>
    </div>
  );
}
