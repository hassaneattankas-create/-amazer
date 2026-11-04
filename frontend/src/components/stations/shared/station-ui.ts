/** Constantes et petits utilitaires partagés par les éditeurs de station (propriétaire, ville, gérant). */
import type { AccordionTone } from "@/components/ui/accordion";
import { timeAgo } from "@/lib/local-services";
import type { FuelKey } from "@/types/local-services";

export {
  ACTIVITY_ACTION_LABELS,
  ROLE_LABELS,
  STATION_REPORT_LABELS,
  STATION_SERVICE_CODES,
  STATION_SERVICE_LABELS,
  activityActionLabel,
  activityDetailText,
  isStationServiceCode,
} from "@/types/station-space";
export { FUEL_LABELS, FUEL_STATE_LABELS } from "@/types/local-services";

export const FUELS: readonly FuelKey[] = ["super", "gasoil", "gaz"];

/**
 * Enregistrement asynchrone fourni par l'écran parent (ex. `mutation.mutateAsync`).
 * Il rejette en cas d'échec ; le message d'erreur est affiché par le parent (onError de la mutation).
 * En cas de succès, l'éditeur vide ses champs temporaires.
 */
export type StationSaveFn<T> = (payload: T) => Promise<unknown>;

export const stationFieldClass =
  "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60";

export const stationLabelClass = "block text-sm font-medium text-ink-800";

/** Fraîcheur des disponibilités, pour un badge meta d'accordéon (« À jour », « À confirmer », « Jamais renseignée »). */
export function stationFreshness(
  station: { fuel_fresh: boolean; fuel_updated_at: string | null; is_active?: boolean },
  now?: number,
): { label: string; tone: AccordionTone } {
  if (station.is_active === false) return { label: "Fermée", tone: "default" };
  if (!station.fuel_updated_at) return { label: "Jamais renseignée", tone: "danger" };
  if (station.fuel_fresh) return { label: `À jour · ${timeAgo(station.fuel_updated_at, now) ?? ""}`.trim(), tone: "default" };
  return { label: "À renseigner", tone: "warning" };
}

/** « 15 000 L ». */
export function formatLiters(liters: number): string {
  return `${liters.toLocaleString("fr-FR")} L`;
}

/** Date et heure courtes : « 3 nov., 14:05 ». */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
