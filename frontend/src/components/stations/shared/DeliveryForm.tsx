"use client";

import { useId, useState } from "react";
import { CheckCircle2, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast-store";
import type { FuelKey } from "@/types/local-services";
import type { DeliveryInput } from "@/types/station-space";

import { FUELS, FUEL_LABELS, stationFieldClass, stationLabelClass, type StationSaveFn } from "./station-ui";

const MAX_LITERS = 200_000;

export type DeliveryFormProps = {
  busy?: boolean;
  disabled?: boolean;
  onSubmit: StationSaveFn<DeliveryInput>;
  /** Si fourni : après l'enregistrement, propose « Marquer <carburant> disponible ». */
  onMarkAvailable?: (fuel: FuelKey) => unknown;
  defaultFuel?: FuelKey;
};

/** Enregistre une livraison reçue : carburant, quantité (L), n° de bon facultatif, date (vide = maintenant). */
export function DeliveryForm({ busy = false, disabled = false, onSubmit, onMarkAvailable, defaultFuel = "gasoil" }: DeliveryFormProps) {
  const uid = useId();
  const [fuel, setFuel] = useState<FuelKey>(defaultFuel);
  const [liters, setLiters] = useState("");
  const [reference, setReference] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [lastFuel, setLastFuel] = useState<FuelKey | null>(null);
  const locked = busy || disabled;

  return (
    <div className="space-y-3">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const quantity = Number(liters.replace(/\s/g, ""));
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LITERS) {
            toast.error("Indiquez une quantité entière entre 1 et 200 000.");
            return;
          }
          const payload: DeliveryInput = { fuel, liters: quantity };
          if (reference.trim()) payload.reference = reference.trim();
          if (deliveredAt) payload.delivered_at = new Date(deliveredAt).toISOString();
          // En cas d'échec, le parent affiche l'erreur et les champs saisis sont gardés.
          void onSubmit(payload)
            .then(() => {
              setLiters("");
              setReference("");
              setDeliveredAt("");
              setLastFuel(fuel);
            })
            .catch(() => undefined);
        }}
      >
        <label className={stationLabelClass}>
          Carburant
          <select
            className={stationFieldClass}
            value={fuel}
            disabled={locked}
            onChange={(e) => setFuel(FUELS.find((key) => key === e.target.value) ?? fuel)}
          >
            {FUELS.map((key) => (
              <option key={key} value={key}>
                {FUEL_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className={stationLabelClass}>
          Quantité (L)
          <input
            className={stationFieldClass}
            value={liters}
            inputMode="numeric"
            type="number"
            min={1}
            max={MAX_LITERS}
            step={1}
            required
            disabled={locked}
            onChange={(e) => setLiters(e.target.value)}
            placeholder="Ex. 15000"
          />
        </label>
        <label className={stationLabelClass}>
          N° de bon ou camion (facultatif)
          <input className={stationFieldClass} value={reference} maxLength={80} disabled={locked} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className={stationLabelClass}>
          Date et heure
          <input
            className={stationFieldClass}
            type="datetime-local"
            value={deliveredAt}
            disabled={locked}
            aria-describedby={`${uid}-when`}
            onChange={(e) => setDeliveredAt(e.target.value)}
          />
          <span id={`${uid}-when`} className="mt-1 block text-xs font-normal text-ink-600">
            Vide : maintenant.
          </span>
        </label>
        <Button type="submit" className="min-h-11 sm:col-span-2" disabled={locked}>
          <Truck className="h-4 w-4" aria-hidden="true" />
          {busy ? "Enregistrement…" : "Enregistrer la livraison"}
        </Button>
      </form>
      {lastFuel && onMarkAvailable ? (
        <div className="flex flex-wrap items-center gap-2 rounded-field bg-success/10 p-3 text-sm text-ink-800" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <span className="flex-1">Livraison de {FUEL_LABELS[lastFuel]} enregistrée.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={locked}
            onClick={() => {
              onMarkAvailable(lastFuel);
              setLastFuel(null);
            }}
          >
            Marquer {FUEL_LABELS[lastFuel]} disponible
          </Button>
        </div>
      ) : null}
    </div>
  );
}
