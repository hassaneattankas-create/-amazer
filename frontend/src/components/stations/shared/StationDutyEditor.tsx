"use client";

import { useId, useState } from "react";
import { Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StationInfo, StationInfoUpdate } from "@/types/station-space";

import { stationFieldClass, stationLabelClass, type StationSaveFn } from "./station-ui";

type Mode = "open" | "until";

/** Date du jour sur l'appareil, au format des champs date (AAAA-MM-JJ). */
const todayIso = () => new Date().toLocaleDateString("sv-SE");

const formatDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export type StationDutyEditorProps = {
  info: Pick<StationInfo, "on_duty" | "duty_until" | "on_duty_now">;
  busy?: boolean;
  disabled?: boolean;
  onSave: StationSaveFn<StationInfoUpdate>;
};

/** Garde de la station : la mettre de garde (sans fin ou jusqu'à une date), ou l'arrêter. */
export function StationDutyEditor({ info, busy = false, disabled = false, onSave }: StationDutyEditorProps) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>(info.duty_until ? "until" : "open");
  const [until, setUntil] = useState(info.duty_until ?? todayIso());
  const locked = busy || disabled;
  const save = (payload: StationInfoUpdate) => void onSave(payload).catch(() => undefined);

  return (
    <div className="space-y-4">
      <p className={cn("flex items-center gap-2 text-sm font-medium", info.on_duty_now ? "text-ink-900" : "text-ink-700")}>
        <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {info.on_duty_now
          ? info.duty_until
            ? `Votre station est de garde jusqu'au ${formatDay(info.duty_until)} inclus.`
            : "Votre station est de garde, sans date de fin."
          : "Votre station n'est pas de garde en ce moment."}
      </p>

      <fieldset disabled={locked} className="space-y-2">
        <legend className="text-sm font-medium text-ink-800">{info.on_duty_now ? "Modifier la garde" : "Mettre de garde"}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Durée de la garde">
          {(
            [
              ["open", "Jusqu'à nouvel ordre"],
              ["until", "Jusqu'à une date"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={mode === key}
              onClick={() => setMode(key)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium transition-colors duration-fast disabled:opacity-60",
                mode === key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "until" ? (
          <label htmlFor={`${uid}-until`} className={cn(stationLabelClass, "max-w-xs")}>
            Dernier jour de garde (inclus)
            <input id={`${uid}-until`} type="date" className={stationFieldClass} value={until} min={todayIso()} onChange={(e) => setUntil(e.target.value)} />
          </label>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={locked || (mode === "until" && !until)} onClick={() => save({ on_duty: true, duty_until: mode === "until" ? until : null })}>
          {info.on_duty_now ? "Enregistrer la garde" : "Mettre de garde"}
        </Button>
        {info.on_duty ? (
          <Button type="button" variant="outline" disabled={locked} onClick={() => save({ on_duty: false })}>
            Arrêter la garde
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-ink-600">Les clients voient « De garde » sur votre station et peuvent filtrer les stations de garde.</p>
    </div>
  );
}
