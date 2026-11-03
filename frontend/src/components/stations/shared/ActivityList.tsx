"use client";

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/local-services";
import { cn } from "@/lib/utils";
import type { ActivityItem, StationRole } from "@/types/station-space";

import { StationDataState } from "./StationDataState";
import { ROLE_LABELS, activityActionLabel, activityDetailText, formatDateTime } from "./station-ui";

const ROLE_BADGE: Record<StationRole, string> = {
  owner: "bg-brand-50 text-brand-700",
  city: "bg-info/10 text-ink-800",
  manager: "bg-surface-2 text-ink-700",
};

/** Badge texte du rôle (« Propriétaire », « Responsable de ville », « Gérant »). */
export function RoleBadge({ role, className }: { role: StationRole; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-semibold", ROLE_BADGE[role], className)}>{ROLE_LABELS[role]}</span>;
}

export type ActivityFilterOptions = {
  /** Filtre par ville (vue marque). */
  city?: boolean;
  /** Filtre par station (vues marque et ville). */
  outlet?: boolean;
  /** Filtre par rôle. */
  role?: boolean;
};

export type ActivityListProps = {
  items: ActivityItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Afficher la station (et la ville si showCity). */
  showOutlet?: boolean;
  showCity?: boolean;
  /** Filtres côté client, options tirées des éléments reçus. */
  filters?: ActivityFilterOptions;
  pageSize?: number;
  emptyText?: string;
};

// Filtres côte à côte (deux par ligne à 360 px), même largeur.
const selectClass = "h-11 min-w-0 flex-1 basis-32 sm:max-w-xs rounded-field border border-border bg-card px-2 text-sm text-ink-900";

/** Journal d'activité : quand, qui (badge de rôle), quoi, où, détail. Filtres facultatifs, « Voir plus » par tranches. */
export function ActivityList({
  items,
  isLoading,
  isError,
  onRetry,
  showOutlet = true,
  showCity = false,
  filters,
  pageSize = 30,
  emptyText = "Aucune activité ces 90 derniers jours.",
}: ActivityListProps) {
  const uid = useId();
  const now = useNow();
  const [city, setCity] = useState("");
  const [outlet, setOutlet] = useState("");
  const [role, setRole] = useState<StationRole | "">("");
  const [visible, setVisible] = useState(pageSize);

  const options = useMemo(() => {
    const rows = items ?? [];
    const cities = [...new Set(rows.map((r) => r.city).filter((c): c is string => Boolean(c)))].sort();
    const outlets = new Map<string, string>();
    rows.forEach((r) => {
      if (r.outlet_id && r.outlet_name) outlets.set(r.outlet_id, r.outlet_name);
    });
    return { cities, outlets: [...outlets].sort((a, b) => a[1].localeCompare(b[1])) };
  }, [items]);

  const filtered = useMemo(
    () => items?.filter((r) => (!city || r.city === city) && (!outlet || r.outlet_id === outlet) && (!role || r.role === role)),
    [items, city, outlet, role],
  );
  const hasFilter = Boolean(city || outlet || role);
  const roleKeys: StationRole[] = ["owner", "city", "manager"];

  return (
    <div className="space-y-2">
      {filters && items?.length ? (
        <div className="flex flex-wrap gap-2">
          {filters.city && options.cities.length > 1 ? (
            <select aria-label="Ville" className={selectClass} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Toutes les villes</option>
              {options.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : null}
          {filters.outlet && options.outlets.length > 1 ? (
            <select aria-label="Station" className={selectClass} value={outlet} onChange={(e) => setOutlet(e.target.value)}>
              <option value="">Toutes les stations</option>
              {options.outlets.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
          {filters.role ? (
            <select
              aria-label="Rôle"
              className={selectClass}
              value={role}
              onChange={(e) => setRole(roleKeys.find((key) => key === e.target.value) ?? "")}
            >
              <option value="">Tous les rôles</option>
              {roleKeys.map((key) => (
                <option key={key} value={key}>
                  {ROLE_LABELS[key]}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}
      <StationDataState
        items={filtered}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyText={hasFilter ? "Aucune activité pour ce filtre." : emptyText}
        errorText="Journal indisponible pour le moment."
      >
        {(rows) => (
          <div className="space-y-2">
            <ul id={`${uid}-list`} className="divide-y divide-border rounded-field border border-border text-sm">
              {rows.slice(0, visible).map((entry) => (
                <li key={entry.id} className="px-3 py-2">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 font-semibold text-ink-900">{activityActionLabel(entry.action)}</span>
                    <time className="shrink-0 text-xs text-ink-600" dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>
                      {timeAgo(entry.created_at, now)}
                    </time>
                  </p>
                  {showOutlet && (entry.outlet_name || (showCity && entry.city)) ? (
                    <p className="text-xs text-ink-700">{[entry.outlet_name, showCity ? entry.city : null].filter(Boolean).join(", ")}</p>
                  ) : null}
                  {activityDetailText(entry.detail) ? <p className="mt-0.5 break-words text-ink-800">{activityDetailText(entry.detail)}</p> : null}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                    <span className="min-w-0 break-all">{entry.actor_name ?? "Compte supprimé"}</span>
                    <RoleBadge role={entry.role} />
                  </p>
                </li>
              ))}
            </ul>
            {rows.length > visible ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 w-full"
                aria-controls={`${uid}-list`}
                onClick={() => setVisible((n) => n + pageSize)}
              >
                Voir plus ({rows.length - visible})
              </Button>
            ) : null}
          </div>
        )}
      </StationDataState>
    </div>
  );
}
