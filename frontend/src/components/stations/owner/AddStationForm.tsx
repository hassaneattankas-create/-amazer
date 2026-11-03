"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { stationFieldClass, stationLabelClass } from "@/components/stations/shared";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { getFuelNetwork } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";

import { CitySelect } from "./CitySelect";
import { useOwnerOutletActions } from "./use-owner-outlet-actions";

const EMPTY = { name: "", address: "", phone: "" };

/** Ajout d'une station : nom, ville, adresse, téléphone, et ce qu'elle coûte en plus par mois. */
export function AddStationForm({ cities }: { cities: string[] }) {
  const { createStation } = useOwnerOutletActions();
  const { data: network } = useQuery({ queryKey: ["fuel-network"], queryFn: getFuelNetwork });
  const [city, setCity] = useState(cities[0] ?? "Niamey");
  const [form, setForm] = useState(EMPTY);
  const busy = createStation.isPending;

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (form.name.trim().length < 2) {
          toast.error("Donnez un nom à la station (ex. « Plateau » ou « Route de Zinder »).");
          return;
        }
        if (city.trim().length < 2) {
          toast.error("Indiquez la ville de la station.");
          return;
        }
        // La ville est gardée pour enchaîner plusieurs stations ; le reste est vidé.
        void createStation
          .mutateAsync({ name: form.name.trim(), city: city.trim(), address: form.address.trim() || undefined, phone: form.phone.trim() || undefined })
          .then(() => setForm(EMPTY))
          .catch(() => undefined);
      }}
    >
      <label className={stationLabelClass}>
        Nom de la station
        <input
          className={stationFieldClass}
          value={form.name}
          maxLength={140}
          disabled={busy}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex. Plateau"
        />
      </label>
      <CitySelect label="Ville" value={city} onChange={setCity} options={cities} disabled={busy} />
      <label className={stationLabelClass}>
        Adresse ou repère
        <input
          className={stationFieldClass}
          value={form.address}
          maxLength={220}
          disabled={busy}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Ex. Avenue de la Mairie"
        />
      </label>
      <label className={stationLabelClass}>
        Téléphone (facultatif)
        <input
          className={stationFieldClass}
          value={form.phone}
          inputMode="tel"
          maxLength={40}
          disabled={busy}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+227 …"
        />
      </label>
      {network && network.negotiated == null ? (
        <p className="text-xs text-ink-600 sm:col-span-2">
          {network.next_station_price > 0
            ? `Cette station ajoutera ${formatXOF(network.next_station_price)} par mois à votre abonnement.`
            : "Cette station est comprise dans votre abonnement."}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 sm:col-span-2" disabled={busy}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {busy ? "Ajout…" : "Ajouter la station"}
      </Button>
    </form>
  );
}
