"use client";

import { useQuery } from "@tanstack/react-query";

import { StationDataState, formatDateTime, formatLiters } from "@/components/stations/shared";
import { getFuelSales, stationKeys } from "@/services/station-space-service";
import type { BrandSales } from "@/types/station-space";

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const liters = (value: number) => (value ? formatLiters(value) : "—");

/** Propriétaire : litres vendus (super, gasoil) par jour pour toute la marque, et par station. */
export function FuelSalesSection() {
  const query = useQuery({ queryKey: stationKeys.fuelSales(), queryFn: () => getFuelSales() });

  return (
    <StationDataState<BrandSales>
      items={query.data ? [query.data] : undefined}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      emptyText="Ventes indisponibles pour le moment."
      skeletonRows={2}
    >
      {([data]) => {
        const week = data.days.slice(0, 7);
        const total = week.reduce((acc, d) => ({ super: acc.super + d.super, gasoil: acc.gasoil + d.gasoil }), { super: 0, gasoil: 0 });
        const withPumps = data.stations.filter((s) => s.pumps > 0).length;
        return (
          <div className="space-y-5">
            <p className="text-sm text-ink-700">
              Calculé chaque soir d&apos;après les compteurs des pompes relevés par vos gérants (section « Ventes » de chaque station).{" "}
              {withPumps < data.stations.length ? `${data.stations.length - withPumps} station(s) n'ont pas encore déclaré leurs pompes.` : null}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-field bg-surface-1 p-3">
                <p className="text-xs text-ink-600">Super, 7 jours</p>
                <p className="text-xl font-semibold tabular-nums text-ink-900">{formatLiters(total.super)}</p>
              </div>
              <div className="rounded-field bg-surface-1 p-3">
                <p className="text-xs text-ink-600">Gasoil, 7 jours</p>
                <p className="text-xl font-semibold tabular-nums text-ink-900">{formatLiters(total.gasoil)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-900">Par jour, toutes stations</p>
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
                      <td className="py-2 text-right tabular-nums text-ink-900">{liters(d.super)}</td>
                      <td className="py-2 text-right tabular-nums text-ink-900">{liters(d.gasoil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-900">Par station</p>
              <ul className="mt-2 space-y-2">
                {[...data.stations].sort((a, b) => Number(b.pumps > 0) - Number(a.pumps > 0)).map((s) => (
                  <li key={s.outlet_id} className="rounded-field border border-border p-3 text-sm">
                    <p className="font-semibold text-ink-900">
                      {s.name} <span className="font-normal text-ink-600">· {s.city}</span>
                    </p>
                    {s.pumps ? (
                      <>
                        <p className="mt-1 text-ink-800">
                          Aujourd&apos;hui : Super {liters(s.today.super)} · Gasoil {liters(s.today.gasoil)}
                        </p>
                        <p className="text-ink-800">
                          Hier : Super {liters(s.yesterday.super)} · Gasoil {liters(s.yesterday.gasoil)}
                        </p>
                        <p className="text-ink-800">
                          7 jours : Super {liters(s.week_super)} · Gasoil {liters(s.week_gasoil)}
                        </p>
                        <p className="mt-1 text-xs text-ink-600">{s.last_read_at ? `Dernier relevé : ${formatDateTime(s.last_read_at)}` : "Aucun relevé pour le moment."}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-ink-600">Pompes pas encore déclarées par le gérant.</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }}
    </StationDataState>
  );
}
