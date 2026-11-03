"use client";

import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/local-services";
import { cn } from "@/lib/utils";
import { FUEL_LABELS, type FuelKey, type FuelState, type FuelStatus } from "@/types/local-services";

import { FUELS } from "./station-ui";

const STATES: { value: FuelState; label: string; on: string; off: string }[] = [
  { value: "available", label: "Disponible", on: "border-success bg-success text-white", off: "hover:border-success" },
  { value: "low", label: "Stock faible", on: "border-warning bg-warning text-ink-900", off: "hover:border-warning" },
  { value: "out", label: "Rupture", on: "border-danger bg-danger text-white", off: "hover:border-danger" },
];

export type FuelAvailabilityEditorProps = {
  /** Nom de la station (libellés accessibles). */
  stationName: string;
  fuel: FuelStatus;
  fuelFresh: boolean;
  fuelUpdatedAt: string | null;
  /** Durée de validité affichée (« À refaire dans les N h »). */
  freshHours?: number;
  /** Une mise à jour est en cours : boutons désactivés. */
  busy?: boolean;
  /** Écritures impossibles (station fermée, abonnement expiré) ; disabledReason explique pourquoi. */
  disabled?: boolean;
  disabledReason?: string;
  onSetFuel: (fuel: FuelKey, state: FuelState) => unknown;
  /** « Rien n'a changé » : reconfirme les disponibilités actuelles. */
  onConfirm: () => unknown;
  /** « stacked » : nom du carburant au-dessus des boutons (sections imbriquées étroites sur mobile). Défaut : « inline ». */
  layout?: "inline" | "stacked";
};

/** Disponibilités : 3 carburants × Disponible / Stock faible / Rupture, ligne de fraîcheur et « Rien n'a changé ». */
export function FuelAvailabilityEditor({
  stationName,
  fuel,
  fuelFresh,
  fuelUpdatedAt,
  freshHours,
  busy = false,
  disabled = false,
  disabledReason,
  onSetFuel,
  onConfirm,
  layout = "inline",
}: FuelAvailabilityEditorProps) {
  const stacked = layout === "stacked";
  const now = useNow();
  const locked = busy || disabled;
  const ago = timeAgo(fuelUpdatedAt, now);

  return (
    <div className="space-y-3">
      {disabled && disabledReason ? <p className="rounded-field bg-warning/10 p-3 text-sm text-ink-800">{disabledReason}</p> : null}
      {FUELS.map((key) => {
        const current = fuel[key] ?? null;
        return (
          <div key={key} className={stacked ? "space-y-1" : "flex items-center gap-2"}>
            <span className={cn("text-sm font-semibold text-ink-900", stacked ? "block" : "w-16 shrink-0")}>{FUEL_LABELS[key]}</span>
            <div className={cn("grid grid-cols-3 gap-2", stacked ? "" : "flex-1")} role="group" aria-label={`${FUEL_LABELS[key]} à ${stationName}`}>
              {STATES.map((state) => (
                <button
                  key={state.value}
                  type="button"
                  disabled={locked}
                  aria-pressed={current === state.value}
                  onClick={() => onSetFuel(key, state.value)}
                  className={cn(
                    "min-h-12 rounded-field border px-1 text-xs font-semibold transition-colors duration-fast disabled:opacity-60 sm:text-sm",
                    current === state.value ? state.on : cn("border-border bg-card text-ink-700", state.off),
                  )}
                >
                  {state.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div
        className={cn(
          "flex flex-col gap-2 rounded-field p-3 sm:flex-row sm:items-center sm:justify-between",
          fuelFresh ? "bg-surface-1" : "bg-warning/10",
        )}
      >
        <p className="flex items-start gap-2 text-sm text-ink-800">
          {fuelFresh ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          )}
          {fuelUpdatedAt
            ? fuelFresh
              ? `Mis à jour ${ago}.${freshHours ? ` À refaire dans les ${freshHours} h.` : ""}`
              : `Dernière mise à jour ${ago} : les clients la voient « non confirmée ».`
            : "Indiquez les disponibilités : les clients les voient tout de suite."}
        </p>
        {fuelUpdatedAt ? (
          <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={locked} onClick={() => onConfirm()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Rien n&apos;a changé
          </Button>
        ) : null}
      </div>
    </div>
  );
}
