"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  addOutletPump,
  getOutletMeters,
  invalidateStationQueries,
  recordOutletMeters,
  removeOutletPump,
  stationKeys,
} from "@/services/station-space-service";
import { toast } from "@/store/toast-store";
import type { PumpFuel, StationMeters } from "@/types/station-space";

import { StationDataState } from "./StationDataState";
import { formatDateTime, formatLiters, stationFieldClass, stationLabelClass } from "./station-ui";

const PUMP_FUEL_LABELS: Record<PumpFuel, string> = { super: "Super", gasoil: "Gasoil" };

/** « 125430,5 » ou « 125 430 » → nombre (null si vide ou illisible). */
function parseMeter(raw: string): number | null {
  const clean = raw.replace(/\s/g, "").replace(",", ".");
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

/**
 * Ventes de carburant d'une station, d'après les compteurs des pompes.
 * Le gérant recopie chaque soir le chiffre de chaque compteur ; AMAZER calcule les litres vendus.
 */
export function MeterReadingsPanel({ outletId, disabled = false }: { outletId: string; disabled?: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: stationKeys.outletMeters(outletId), queryFn: () => getOutletMeters(outletId) });
  const [values, setValues] = useState<Record<string, string>>({});
  const [resets, setResets] = useState<Record<string, boolean>>({});
  const [pumpFuel, setPumpFuel] = useState<PumpFuel>("super");
  const [pumpName, setPumpName] = useState("");
  const [managePumps, setManagePumps] = useState(false);

  const saved = (data: StationMeters) => {
    queryClient.setQueryData(stationKeys.outletMeters(outletId), data);
    void invalidateStationQueries(queryClient);
  };
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Enregistrement impossible. Réessayez."));

  const record = useMutation({
    mutationFn: (readings: { pump_id: string; meter: number; reset: boolean }[]) => recordOutletMeters(outletId, readings),
    onSuccess: (data) => {
      saved(data);
      setValues({});
      setResets({});
      const parts = (Object.entries(data.just_sold) as [PumpFuel, number][]).filter(([, v]) => v > 0).map(([f, v]) => `${PUMP_FUEL_LABELS[f]} ${formatLiters(v)}`);
      toast.success(parts.length ? `Compteurs enregistrés. Vendu depuis le dernier relevé : ${parts.join(", ")}.` : "Compteurs enregistrés : c'est le point de départ.");
    },
    onError,
  });
  const addPump = useMutation({
    mutationFn: () => addOutletPump(outletId, { fuel: pumpFuel, name: pumpName.trim() }),
    onSuccess: (data) => {
      saved(data);
      setPumpName("");
      toast.success("Pompe ajoutée.");
    },
    onError,
  });
  const removePump = useMutation({
    mutationFn: (pumpId: string) => removeOutletPump(outletId, pumpId),
    onSuccess: (data) => {
      saved(data);
      toast.success("Pompe retirée.");
    },
    onError,
  });
  const busy = record.isPending || addPump.isPending || removePump.isPending;
  const locked = disabled || busy;

  return (
    <StationDataState
      items={query.data ? [query.data] : undefined}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      emptyText="Ventes indisponibles pour le moment."
      skeletonRows={2}
    >
      {([data]) => {
        const week = data.days.slice(0, 7);
        const totals = week.reduce((acc, d) => ({ super: acc.super + d.super, gasoil: acc.gasoil + d.gasoil }), { super: 0, gasoil: 0 });
        const filled = data.pumps.filter((p) => parseMeter(values[p.id] ?? "") != null);

        const pumpForm = (
          <form
            className="grid gap-2 rounded-field bg-surface-1 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (pumpName.trim()) addPump.mutate();
            }}
          >
            <label className={stationLabelClass}>
              Carburant
              <select className={stationFieldClass} value={pumpFuel} disabled={locked} onChange={(e) => setPumpFuel(e.target.value as PumpFuel)}>
                <option value="super">Super</option>
                <option value="gasoil">Gasoil</option>
              </select>
            </label>
            <label className={stationLabelClass}>
              Nom de la pompe
              <input className={stationFieldClass} value={pumpName} maxLength={60} disabled={locked} placeholder={`Pompe ${data.pumps.length + 1}`} onChange={(e) => setPumpName(e.target.value)} />
            </label>
            <Button type="submit" variant="outline" className="min-h-11" disabled={locked || !pumpName.trim()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ajouter la pompe
            </Button>
          </form>
        );

        if (!data.pumps.length) {
          return (
            <div className="space-y-3">
              <p className="text-sm text-ink-700">
                Pour savoir combien de litres sont vendus, ajoutez d&apos;abord vos pompes. Ensuite, chaque soir, recopiez le chiffre du compteur de chaque
                pompe : AMAZER calcule les ventes du jour.
              </p>
              {pumpForm}
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const readings = filled.map((p) => ({ pump_id: p.id, meter: parseMeter(values[p.id] ?? "") as number, reset: Boolean(resets[p.id]) }));
                if (!readings.length) {
                  toast.error("Écrivez le chiffre d'au moins un compteur.");
                  return;
                }
                record.mutate(readings);
              }}
            >
              <p className="text-sm text-ink-700">Chaque soir, recopiez le chiffre affiché sur le compteur de chaque pompe.</p>
              <ul className="space-y-2">
                {data.pumps.map((pump) => (
                  <li key={pump.id} className="rounded-field border border-border p-3">
                    <label className={stationLabelClass}>
                      {pump.name} · {PUMP_FUEL_LABELS[pump.fuel]}
                      <input
                        className={stationFieldClass}
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={locked}
                        value={values[pump.id] ?? ""}
                        placeholder={pump.last_meter != null ? `Dernier : ${pump.last_meter.toLocaleString("fr-FR")}` : "Chiffre du compteur"}
                        onChange={(e) => setValues((prev) => ({ ...prev, [pump.id]: e.target.value }))}
                      />
                    </label>
                    <p className="mt-1 text-xs text-ink-600">
                      {pump.last_read_at ? `Dernier relevé : ${pump.last_meter?.toLocaleString("fr-FR")} le ${formatDateTime(pump.last_read_at)}` : "Premier relevé : il sert de point de départ."}
                    </p>
                    {pump.last_meter != null ? (
                      <label className="mt-1 inline-flex min-h-11 items-center gap-2 text-xs text-ink-700">
                        <input type="checkbox" className="h-4 w-4" checked={Boolean(resets[pump.id])} disabled={locked} onChange={(e) => setResets((prev) => ({ ...prev, [pump.id]: e.target.checked }))} />
                        Compteur remis à zéro ou changé
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={locked || filled.length === 0}>
                {record.isPending ? "Enregistrement…" : `Enregistrer ${filled.length > 1 ? `les ${filled.length} compteurs` : "le compteur"}`}
              </Button>
            </form>

            <div>
              <p className="text-sm font-semibold text-ink-900">Vendu ces 7 derniers jours</p>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-600">
                    <th className="py-1 font-medium">Jour</th>
                    <th className="py-1 text-right font-medium">Super</th>
                    <th className="py-1 text-right font-medium">Gasoil</th>
                  </tr>
                </thead>
                <tbody>
                  {week.map((d) => (
                    <tr key={d.day} className="border-t border-border">
                      <td className="py-2 text-ink-800">{dayLabel(d.day)}</td>
                      <td className="py-2 text-right tabular-nums text-ink-900">{d.super ? formatLiters(d.super) : "—"}</td>
                      <td className="py-2 text-right tabular-nums text-ink-900">{d.gasoil ? formatLiters(d.gasoil) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ink-900 font-semibold">
                    <td className="py-2 text-ink-900">Total</td>
                    <td className="py-2 text-right tabular-nums text-ink-900">{formatLiters(totals.super)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-900">{formatLiters(totals.gasoil)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <Button type="button" variant="ghost" className="min-h-11 px-0 text-sm" aria-expanded={managePumps} onClick={() => setManagePumps((v) => !v)}>
                Gérer les pompes ({data.pumps.length})
              </Button>
              {managePumps ? (
                <div className="mt-2 space-y-2">
                  <ul className="divide-y divide-border rounded-field border border-border">
                    {data.pumps.map((pump) => (
                      <li key={pump.id} className="flex items-center justify-between gap-2 px-3 py-1 text-sm">
                        <span>
                          {pump.name} · {PUMP_FUEL_LABELS[pump.fuel]}
                        </span>
                        <button
                          type="button"
                          disabled={locked}
                          aria-label={`Retirer ${pump.name}`}
                          onClick={() => {
                            if (window.confirm(`Retirer « ${pump.name} » ? Ses relevés passés restent comptés.`)) removePump.mutate(pump.id);
                          }}
                          className="grid h-11 w-11 place-items-center rounded-field text-ink-600 hover:bg-surface-2 hover:text-danger disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {pumpForm}
                </div>
              ) : null}
            </div>
          </div>
        );
      }}
    </StationDataState>
  );
}
