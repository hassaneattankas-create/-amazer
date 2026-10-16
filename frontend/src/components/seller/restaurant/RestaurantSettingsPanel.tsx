"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { getRestaurantSettings, updateRestaurantSettings } from "@/services/restaurant-service";
import type { RestaurantDayHours, RestaurantSettings } from "@/types/restaurant";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const DEFAULT_SLOT = { open: "11:00", close: "22:00" };
const timeClass = "h-11 w-full rounded-field border border-border bg-card px-2 text-sm text-ink-900";
const SETTINGS_KEY = ["restaurant-settings"];

/** Pause des commandes (mode « trop de commandes ») et horaires de la semaine. */
export function RestaurantSettingsPanel() {
  const { data, isPending } = useQuery({ queryKey: SETTINGS_KEY, queryFn: getRestaurantSettings });
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-card bg-surface-3" aria-busy="true" />;
  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: RestaurantSettings }) {
  const queryClient = useQueryClient();
  const [useHours, setUseHours] = useState(Boolean(initial.weekly_hours));
  const [hours, setHours] = useState<Record<string, RestaurantDayHours>>(
    () => Object.fromEntries(DAYS.map((day) => [day, initial.weekly_hours ? initial.weekly_hours[day] ?? null : { ...DEFAULT_SLOT }]))
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const mutation = useMutation({
    mutationFn: updateRestaurantSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(SETTINGS_KEY, saved);
      setMessage({ ok: true, text: `Enregistré. ${saved.open_label}.` });
    },
    onError: (error) => setMessage({ ok: false, text: getApiErrorMessage(error, "Enregistrement impossible.") }),
  });
  const current = (queryClient.getQueryData<RestaurantSettings>(SETTINGS_KEY) ?? initial);
  const save = (paused: boolean) => {
    setMessage(null);
    mutation.mutate({ weekly_hours: useHours ? hours : null, orders_paused: paused });
  };
  const setDay = (day: string, value: RestaurantDayHours) => setHours((prev) => ({ ...prev, [day]: value }));

  return (
    <div className="space-y-4 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink-900">{current.is_open ? "Vous recevez des commandes" : "Commandes fermées"}</p>
          <p className="text-sm text-ink-600">{current.open_label}</p>
        </div>
        <Button
          type="button"
          variant={current.orders_paused ? "default" : "outline"}
          disabled={mutation.isPending}
          onClick={() => save(!current.orders_paused)}
        >
          {current.orders_paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          {current.orders_paused ? "Reprendre les commandes" : "Mettre en pause"}
        </Button>
      </div>
      <p className="text-xs text-ink-600">Trop de monde en cuisine ? La pause bloque les nouvelles commandes, sans toucher au menu.</p>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="flex items-center gap-2 font-semibold text-ink-900">
          <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Horaires d&apos;ouverture
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" className="h-5 w-5" checked={useHours} onChange={(e) => setUseHours(e.target.checked)} />
          Fermer automatiquement en dehors de mes horaires
        </label>
        {useHours ? (
          <div className="space-y-2">
            {DAYS.map((day) => {
              const slot = hours[day];
              return (
                <div key={day} className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                  <label className="flex min-h-11 items-center gap-2 text-sm font-medium capitalize text-ink-800">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={Boolean(slot)}
                      onChange={(e) => setDay(day, e.target.checked ? { ...DEFAULT_SLOT } : null)}
                    />
                    {day.slice(0, 3)}.
                  </label>
                  {slot ? (
                    <>
                      <input
                        type="time"
                        aria-label={`Ouverture ${day}`}
                        className={timeClass}
                        value={slot.open}
                        onChange={(e) => setDay(day, { ...slot, open: e.target.value })}
                      />
                      <input
                        type="time"
                        aria-label={`Fermeture ${day}`}
                        className={timeClass}
                        value={slot.close}
                        onChange={(e) => setDay(day, { ...slot, close: e.target.value })}
                      />
                    </>
                  ) : (
                    <span className="col-span-2 text-sm text-ink-500">Fermé</span>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-brand-700 hover:underline"
              onClick={() => setHours(Object.fromEntries(DAYS.map((day) => [day, hours.lundi ? { ...hours.lundi } : null])))}
            >
              Appliquer les horaires du lundi à toute la semaine
            </button>
            <p className="text-xs text-ink-600">Après minuit : mettez par exemple 18:00 → 02:00.</p>
          </div>
        ) : (
          <p className="text-sm text-ink-600">Sans horaires, vous êtes ouvert en permanence (utilisez la pause pour fermer).</p>
        )}
        <Button type="button" disabled={mutation.isPending} onClick={() => save(current.orders_paused)}>
          {mutation.isPending ? "Enregistrement…" : "Enregistrer les horaires"}
        </Button>
      </div>
      {message ? (
        <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
