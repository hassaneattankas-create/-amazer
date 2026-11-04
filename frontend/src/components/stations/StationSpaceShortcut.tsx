"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Fuel } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useT } from "@/lib/i18n";
import { getStationSpaceMe, stationKeys } from "@/services/station-space-service";
import { hasStationSpace, stationSpaceSummary } from "@/types/station-space";

/**
 * Raccourci vers l'Espace station pour les responsables de ville et les gérants déjà connectés.
 * N'affiche rien pour les autres comptes ; une erreur reste silencieuse (la page continue de fonctionner).
 */
export function StationSpaceShortcut({ className }: { className?: string }) {
  const t = useT();
  const { data: user } = useCurrentUser();
  const { data: space } = useQuery({
    queryKey: [...stationKeys.me, user?.id],
    queryFn: getStationSpaceMe,
    enabled: Boolean(user?.id),
    staleTime: 10 * 60_000,
    retry: false,
  });
  if (!hasStationSpace(space)) return null;

  return (
    <Link
      href="/gerant-station"
      className={`flex min-h-14 items-center gap-3 rounded-card border border-border bg-card p-3 shadow-resting transition-colors duration-fast hover:border-brand-500 ${className ?? ""}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-brand-50 text-brand-700">
        <Fuel className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-900">{t("Mon espace station")}</span>
        <span className="block text-sm text-ink-600">{stationSpaceSummary(space)}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" aria-hidden="true" />
    </Link>
  );
}
