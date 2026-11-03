"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/local-services";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast-store";
import type { StationInfo, StationInfoUpdate, StationServiceCode } from "@/types/station-space";

import { STATION_SERVICE_CODES, STATION_SERVICE_LABELS, isStationServiceCode, stationFieldClass, stationLabelClass, type StationSaveFn } from "./station-ui";

const PHONE_PATTERN = /^[+0-9 ().-]*$/;

type FormState = { address: string; phone: string; opening_hours: string; services: StationServiceCode[] };

function fromInfo(info: StationInfoFormProps["info"]): FormState {
  return {
    address: info.address ?? "",
    phone: info.phone ?? "",
    opening_hours: info.opening_hours ?? "",
    services: (info.services ?? []).filter(isStationServiceCode),
  };
}

/** Seuls les champs modifiés partent au serveur (chaîne vide = effacé). */
function diff(before: FormState, after: FormState): StationInfoUpdate {
  const patch: StationInfoUpdate = {};
  if (after.address.trim() !== before.address) patch.address = after.address.trim();
  if (after.phone.trim() !== before.phone) patch.phone = after.phone.trim();
  if (after.opening_hours.trim() !== before.opening_hours) patch.opening_hours = after.opening_hours.trim();
  const sameServices = after.services.length === before.services.length && after.services.every((code) => before.services.includes(code));
  if (!sameServices) patch.services = after.services;
  return patch;
}

export type StationInfoFormProps = {
  info: Pick<StationInfo, "address" | "phone" | "opening_hours" | "services" | "info_updated_at">;
  busy?: boolean;
  disabled?: boolean;
  /** Reçoit uniquement les champs modifiés. */
  onSave: StationSaveFn<StationInfoUpdate>;
};

/** Informations de la station : adresse, téléphone, horaires et services (puces à cocher). */
export function StationInfoForm({ info, busy = false, disabled = false, onSave }: StationInfoFormProps) {
  const uid = useId();
  const now = useNow();
  const [form, setForm] = useState<FormState>(() => fromInfo(info));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // Les données du serveur ont changé (autre appareil, autre niveau) : on repart d'elles.
  const sourceKey = `${info.info_updated_at ?? ""}|${info.address ?? ""}|${info.phone ?? ""}|${info.opening_hours ?? ""}|${(info.services ?? []).join(",")}`;
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setForm(fromInfo(info));
  }

  const locked = busy || disabled;
  const checkPhone = (value: string) => {
    const ok = PHONE_PATTERN.test(value.trim());
    setPhoneError(ok ? null : "Chiffres, espaces et + ( ) . - seulement (ex. +227 90 00 00 00).");
    return ok;
  };
  const toggleService = (code: StationServiceCode) =>
    setForm((prev) => ({ ...prev, services: prev.services.includes(code) ? prev.services.filter((c) => c !== code) : [...prev.services, code] }));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!checkPhone(form.phone)) return;
        const patch = diff(fromInfo(info), form);
        if (Object.keys(patch).length === 0) {
          toast.info("Aucun changement à enregistrer.");
          return;
        }
        // En cas d'échec, le parent affiche l'erreur et les champs saisis sont gardés.
        void onSave(patch).catch(() => undefined);
      }}
    >
      <label className={cn(stationLabelClass, "sm:col-span-2")}>
        Adresse ou repère
        <input
          className={stationFieldClass}
          value={form.address}
          maxLength={220}
          disabled={locked}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Ex. Avenue de la Mairie"
        />
      </label>
      <label className={stationLabelClass}>
        Téléphone
        <input
          className={stationFieldClass}
          value={form.phone}
          inputMode="tel"
          maxLength={40}
          disabled={locked}
          aria-invalid={phoneError ? true : undefined}
          aria-describedby={phoneError ? `${uid}-phone-error` : undefined}
          onBlur={(e) => checkPhone(e.target.value)}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+227 …"
        />
        {phoneError ? (
          <span id={`${uid}-phone-error`} className="mt-1 block text-xs text-danger">
            {phoneError}
          </span>
        ) : null}
      </label>
      <label className={stationLabelClass}>
        Horaires
        <input
          className={stationFieldClass}
          value={form.opening_hours}
          maxLength={120}
          disabled={locked}
          onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
          placeholder="Ex. 6 h – 23 h ou 24 h/24"
        />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-ink-800">Services</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {STATION_SERVICE_CODES.map((code) => {
            const on = form.services.includes(code);
            return (
              <button
                key={code}
                type="button"
                disabled={locked}
                aria-pressed={on}
                onClick={() => toggleService(code)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3 text-sm font-medium transition-colors duration-fast disabled:opacity-60",
                  on ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border bg-card text-ink-700 hover:border-ink-400",
                )}
              >
                {on ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                {STATION_SERVICE_LABELS[code]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" className="min-h-11" disabled={locked}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {info.info_updated_at ? <span className="text-xs text-ink-600">Modifié {timeAgo(info.info_updated_at, now)}</span> : null}
      </div>
    </form>
  );
}
