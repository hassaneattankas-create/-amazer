"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { addFuelAlert, listFuelAlerts, removeFuelAlert } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, type FuelKey } from "@/types/local-services";

const CHOICES: Array<FuelKey | "any"> = ["super", "gasoil", "gaz", "any"];

/**
 * « Me prévenir » pour toute une ville : une notification dès qu'une station de la ville indique le carburant,
 * ou qu'un communiqué d'approvisionnement est publié. Liste « Mes alertes » pour les retirer.
 */
export function FuelAlertsPanel({ city }: { city: string }) {
  const place = city || "Niamey";
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();
  const [fuel, setFuel] = useState<FuelKey | "any">("super");
  const { data: alerts = [] } = useQuery({ queryKey: ["fuel-alerts"], queryFn: listFuelAlerts, enabled: Boolean(user) });
  const add = useMutation({
    mutationFn: () => addFuelAlert({ fuel, city: place }),
    onSuccess: (created) => {
      toast.success(`Alerte enregistrée : ${created.label}.`);
      void queryClient.invalidateQueries({ queryKey: ["fuel-alerts"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Alerte impossible pour le moment.")),
  });
  const remove = useMutation({
    mutationFn: removeFuelAlert,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fuel-alerts"] }),
    onError: (error) => toast.error(getApiErrorMessage(error, "Suppression impossible pour le moment.")),
  });

  return (
    <section aria-labelledby="fuel-alerts-title" className="mt-4 rounded-card border border-border bg-card p-4">
      <h2 id="fuel-alerts-title" className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Bell className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Me prévenir dès qu&apos;il y en a
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Une notification dès qu&apos;une station de {place} indique du carburant, ou qu&apos;un communiqué d&apos;approvisionnement est publié. Au plus une
        toutes les 2 heures.
      </p>
      {isLoading ? null : !user ? (
        <Link
          href={`/login?next=${encodeURIComponent("/stations")}`}
          className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Se connecter pour être prévenu
        </Link>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Carburant à surveiller">
            {CHOICES.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={fuel === key}
                onClick={() => setFuel(key)}
                className={`inline-flex min-h-10 items-center rounded-pill border px-3 text-xs font-semibold ${
                  fuel === key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
                }`}
              >
                {key === "any" ? "N'importe lequel" : FUEL_LABELS[key]}
              </button>
            ))}
            <button
              type="button"
              disabled={add.isPending}
              onClick={() => add.mutate()}
              className="inline-flex min-h-10 items-center rounded-pill bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Me prévenir à {place}
            </button>
          </div>
          {alerts.length ? (
            <ul className="mt-3 space-y-1.5" aria-label="Mes alertes">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex items-center justify-between gap-2 rounded-field bg-surface-1 px-3 py-1.5 text-sm text-ink-800">
                  <span className="min-w-0 truncate">{alert.label}</span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(alert.id)}
                    aria-label={`Retirer l'alerte ${alert.label}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-ink-600 hover:bg-card"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
