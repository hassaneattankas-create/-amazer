"use client";

import { useId, useState, type ChangeEvent } from "react";
import { Plus } from "lucide-react";

import { stationFieldClass, stationLabelClass } from "@/components/stations/shared";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast-store";
import type { RegionOutletCreate } from "@/types/station-space";

import { useRegionActions } from "./use-region-actions";

const PHONE_PATTERN = /^[+0-9 ().-]*$/;
const EMPTY = { name: "", address: "", phone: "" };

export type RegionAddStationFormProps = { vendorId: string; city: string; disabled?: boolean };

/** « Ajouter une station à <ville> » : bouton qui déplie un formulaire court (nom, adresse, téléphone). */
export function RegionAddStationForm({ vendorId, city, disabled = false }: RegionAddStationFormProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { createOutlet } = useRegionActions();
  const locked = createOutlet.isPending || disabled;

  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2" disabled={disabled} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Ajouter une station à {city}
      </Button>
    );
  }

  const field = (key: keyof typeof EMPTY) => ({
    id: `${uid}-${key}`,
    value: form[key],
    disabled: locked,
    className: stationFieldClass,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: event.target.value })),
  });

  return (
    <form
      className="space-y-3 rounded-field border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const name = form.name.trim();
        const phone = form.phone.trim();
        if (name.length < 2) {
          toast.error("Indiquez le nom de la station (2 caractères au moins).");
          return;
        }
        if (!PHONE_PATTERN.test(phone)) {
          toast.error("Téléphone : chiffres, espaces et + uniquement.");
          return;
        }
        const payload: RegionOutletCreate = { vendor_id: vendorId, city, name };
        if (form.address.trim()) payload.address = form.address.trim();
        if (phone) payload.phone = phone;
        // En cas d'échec, l'erreur s'affiche et les champs saisis sont gardés.
        void createOutlet
          .mutateAsync(payload)
          .then(() => setForm(EMPTY))
          .catch(() => undefined);
      }}
    >
      <p className="text-sm font-semibold text-ink-900">Nouvelle station à {city}</p>
      <div>
        <label className={stationLabelClass} htmlFor={`${uid}-name`}>
          Nom
        </label>
        <input {...field("name")} required maxLength={140} placeholder="Ex. Station Plateau" />
      </div>
      <div>
        <label className={stationLabelClass} htmlFor={`${uid}-address`}>
          Adresse (facultatif)
        </label>
        <input {...field("address")} maxLength={220} autoComplete="off" />
      </div>
      <div>
        <label className={stationLabelClass} htmlFor={`${uid}-phone`}>
          Téléphone (facultatif)
        </label>
        <input {...field("phone")} type="tel" inputMode="tel" maxLength={40} autoComplete="off" />
      </div>
      <p className="text-xs text-ink-600">Le propriétaire de la marque est prévenu : la station compte dans son abonnement.</p>
      <div className="flex gap-2">
        <Button type="submit" className="min-h-11 flex-1" disabled={locked}>
          {createOutlet.isPending ? "Ajout…" : "Ajouter la station"}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}
