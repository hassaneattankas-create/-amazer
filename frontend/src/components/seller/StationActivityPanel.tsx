"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock3, Flag } from "lucide-react";

import { timeAgo } from "@/lib/local-services";
import { listMyFuelHistory, listMyStationReports } from "@/services/local-services-service";
import { FUEL_LABELS, FUEL_STATE_LABELS, type StationReportKind } from "@/types/local-services";

const REPORT_LABELS: Record<StationReportKind, string> = {
  wrong_status: "Disponibilité fausse",
  closed: "Station fermée",
  wrong_place: "Mauvaise adresse ou position",
  other: "Autre problème",
};

/** Espace station : signalements des clients et historique des changements (30 derniers jours). */
export function StationActivityPanel() {
  const reports = useQuery({ queryKey: ["station-reports"], queryFn: listMyStationReports });
  const history = useQuery({ queryKey: ["fuel-history"], queryFn: listMyFuelHistory });

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Flag className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Signalements des clients
        </h3>
        {reports.isPending ? (
          <div className="mt-2 h-12 animate-pulse rounded-field bg-surface-3" aria-busy="true" />
        ) : reports.isError ? (
          <p className="mt-2 text-sm text-danger">Signalements indisponibles pour le moment.</p>
        ) : reports.data.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">Aucun signalement ces 30 derniers jours.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {reports.data.map((report) => (
              <li key={`${report.created_at}-${report.kind}`} className="rounded-field bg-warning/10 px-3 py-2 text-sm text-ink-800">
                <span className="font-semibold text-ink-900">{REPORT_LABELS[report.kind]}</span>
                {report.outlet_name ? ` · ${report.outlet_name}` : ""} · {timeAgo(report.created_at)}
                {report.comment ? <span className="block text-ink-700">« {report.comment} »</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Clock3 className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Historique des disponibilités
        </h3>
        {history.isPending ? (
          <div className="mt-2 h-12 animate-pulse rounded-field bg-surface-3" aria-busy="true" />
        ) : history.isError ? (
          <p className="mt-2 text-sm text-danger">Historique indisponible pour le moment.</p>
        ) : history.data.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">Aucun changement ces 30 derniers jours.</p>
        ) : (
          <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-field border border-border text-sm">
            {history.data.map((change) => (
              <li key={`${change.created_at}-${change.outlet_id ?? ""}-${change.fuel}`} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                <span className="text-ink-900">
                  {change.outlet_name ? `${change.outlet_name} · ` : ""}
                  <strong>{FUEL_LABELS[change.fuel]}</strong> : {change.old_state ? `${FUEL_STATE_LABELS[change.old_state]} → ` : ""}
                  {FUEL_STATE_LABELS[change.new_state]}
                </span>
                <span className="text-ink-600">{timeAgo(change.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
