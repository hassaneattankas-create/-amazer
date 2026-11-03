"use client";

import { useId, useState } from "react";
import { CheckCircle2, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/local-services";
import { cn } from "@/lib/utils";
import type { ReportItem } from "@/types/station-space";

import { StationDataState } from "./StationDataState";
import { STATION_REPORT_LABELS, formatDateTime, stationFieldClass } from "./station-ui";

export type ReportListProps = {
  items: ReportItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Afficher le nom de la station (vue ville ou marque). */
  showOutlet?: boolean;
  busy?: boolean;
  /** Absent : liste en lecture seule. Reçoit l'id du retour et la note facultative. */
  onResolve?: (reportId: string, resolution?: string) => Promise<unknown>;
  emptyText?: string;
};

/** Espace insécable : les guillemets ne se retrouvent jamais seuls en début ou fin de ligne. */
const NBSP = String.fromCharCode(160);

/** Non traités d'abord, puis du plus récent au plus ancien. */
function sortReports(items: ReportItem[]): ReportItem[] {
  return [...items].sort((a, b) => {
    if (!a.resolved_at !== !b.resolved_at) return a.resolved_at ? 1 : -1;
    return b.created_at.localeCompare(a.created_at);
  });
}

function ReportRow({ report, showOutlet, busy, onResolve, now }: { report: ReportItem; showOutlet: boolean; busy: boolean; onResolve?: ReportListProps["onResolve"]; now: number }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const resolved = Boolean(report.resolved_at);

  return (
    <li className={cn("px-3 py-2 text-sm", resolved ? "bg-surface-1 text-ink-600" : "text-ink-800")}>
      <p className="flex items-center gap-2">
        {resolved ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <Flag className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        )}
        <span className={cn("min-w-0 flex-1 font-semibold", resolved ? "text-ink-700" : "text-ink-900")}>{STATION_REPORT_LABELS[report.kind]}</span>
        <time className="shrink-0 text-xs text-ink-600" dateTime={report.created_at} title={formatDateTime(report.created_at)}>
          {timeAgo(report.created_at, now)}
        </time>
      </p>
      {showOutlet && report.outlet_name ? <p className="pl-6 text-xs text-ink-700">{report.outlet_name}</p> : null}
      {report.comment ? <p className="mt-0.5 break-words">«{NBSP}{report.comment}{NBSP}»</p> : null}
      {resolved ? (
        <p className="mt-0.5 text-xs">
          Traité {timeAgo(report.resolved_at, now)}
          {report.resolved_by_name ? ` par ${report.resolved_by_name}` : ""}
          {report.resolution ? ` : ${report.resolution}` : ""}
        </p>
      ) : onResolve && !open ? (
        <Button type="button" size="sm" variant="outline" className="mt-2 min-h-11" disabled={busy} onClick={() => setOpen(true)}>
          Marquer traité
        </Button>
      ) : null}
      {!resolved && onResolve && open ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            // En cas d'échec, le parent affiche l'erreur et la note est gardée.
            void onResolve(report.id, note.trim() || undefined)
              .then(() => setOpen(false))
              .catch(() => undefined);
          }}
        >
          <label htmlFor={`${uid}-note`} className="block text-xs font-medium text-ink-800">
            Note (facultatif)
          </label>
          <input
            id={`${uid}-note`}
            className={cn(stationFieldClass, "mt-0")}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. Gaz livré ce matin, statut corrigé."
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="min-h-11" disabled={busy}>
              {busy ? "Envoi…" : "Confirmer"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** Retours clients (30 jours) : non traités d'abord, « Marquer traité » avec note facultative ; traités grisés (qui, quand). */
export function ReportList({
  items,
  isLoading,
  isError,
  onRetry,
  showOutlet = false,
  busy = false,
  onResolve,
  emptyText = "Aucun retour client ces 30 derniers jours.",
}: ReportListProps) {
  const now = useNow();
  return (
    <StationDataState items={items} isLoading={isLoading} isError={isError} onRetry={onRetry} emptyText={emptyText} errorText="Retours indisponibles pour le moment.">
      {(rows) => (
        <ul className="divide-y divide-border overflow-hidden rounded-field border border-border">
          {sortReports(rows).map((report) => (
            <ReportRow key={report.id} report={report} showOutlet={showOutlet} busy={busy} onResolve={onResolve} now={now} />
          ))}
        </ul>
      )}
    </StationDataState>
  );
}
