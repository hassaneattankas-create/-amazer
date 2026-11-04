/**
 * Espace station : chaîne propriétaire de la marque → responsable de ville → gérant.
 * Contrat d'API : /api/v1/station-space, /station-region, /station-manager et ajouts /seller (voir spec stations §3).
 */
import type { FuelKey, FuelStatus, StationReport, StationReportKind } from "@/types/local-services";

/** Niveau d'accès d'un compte sur une station (le plus haut l'emporte). */
export type StationRole = "owner" | "city" | "manager";

/** Services proposés par une station (puces sur la fiche publique). */
export type StationServiceCode = "lavage" | "gonflage" | "vidange" | "boutique" | "toilettes" | "mobile_money" | "carte" | "atelier";

export const STATION_SERVICE_CODES: readonly StationServiceCode[] = [
  "lavage",
  "gonflage",
  "vidange",
  "boutique",
  "toilettes",
  "mobile_money",
  "carte",
  "atelier",
] as const;

export const STATION_SERVICE_LABELS: Record<StationServiceCode, string> = {
  lavage: "Lavage",
  gonflage: "Gonflage",
  vidange: "Vidange",
  boutique: "Boutique",
  toilettes: "Toilettes",
  mobile_money: "Mobile Money",
  carte: "Carte bancaire",
  atelier: "Atelier",
};

export const ROLE_LABELS: Record<StationRole, string> = {
  owner: "Propriétaire",
  city: "Responsable de ville",
  manager: "Gérant",
};

/** Codes d'action du journal d'activité. Le serveur peut en ajouter : toujours passer par activityActionLabel(). */
export type ActivityAction =
  | "fuel"
  | "confirm"
  | "info"
  | "position"
  | "delivery"
  | "report_resolved"
  | "outlet_created"
  | "outlet_deleted"
  | "outlet_opened"
  | "outlet_closed"
  | "manager_added"
  | "manager_removed"
  | "city_added"
  | "city_removed";

const ACTIVITY_REPEATED_START = /^(Retour traité|Livraison|Position enregistrée|Gérant ajouté|Gérant retiré|Station ajoutée à|Station supprimée|Responsable de ville|Responsable retiré)\s*:?\s*/;

/** Détail d'une ligne du journal, sans répéter le titre déjà affiché (« Livraison Gasoil 12 000 L » → « Gasoil 12 000 L »). */
export function activityDetailText(detail: string | null): string | null {
  if (!detail) return null;
  return detail.replace(ACTIVITY_REPEATED_START, "").trim() || null;
}

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  fuel: "Disponibilités",
  confirm: "Confirmation",
  info: "Informations",
  position: "Position",
  delivery: "Livraison",
  report_resolved: "Retour traité",
  outlet_created: "Station ajoutée",
  outlet_deleted: "Station supprimée",
  outlet_opened: "Station ouverte",
  outlet_closed: "Station fermée",
  manager_added: "Gérant ajouté",
  manager_removed: "Gérant retiré",
  city_added: "Responsable de ville ajouté",
  city_removed: "Responsable de ville retiré",
};

/** Libellé français d'un code d'action (code inconnu → « Action »). */
export function activityActionLabel(action: string): string {
  const labels: Record<string, string> = ACTIVITY_ACTION_LABELS;
  return labels[action] ?? "Action";
}

export function isStationServiceCode(value: string): value is StationServiceCode {
  return (STATION_SERVICE_CODES as readonly string[]).includes(value);
}

export const STATION_REPORT_LABELS: Record<StationReportKind, string> = {
  wrong_status: "Disponibilité fausse",
  closed: "Station fermée",
  wrong_place: "Mauvaise adresse ou position",
  other: "Autre problème",
};

/** Informations pratiques d'une station (intégrées à plusieurs réponses). */
export type StationInfo = {
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  /** Codes parmi STATION_SERVICE_CODES (le serveur filtre). */
  services: string[];
  latitude: number | null;
  longitude: number | null;
  maps_url: string;
  info_updated_at: string | null;
};

/**
 * Mise à jour des informations (champ absent = inchangé, chaîne vide = effacé).
 * Position : latitude + longitude ensemble, OU maps_link (lien Google Maps ou « 13.51, 2.10 »).
 */
export type StationInfoUpdate = {
  address?: string;
  phone?: string;
  opening_hours?: string;
  services?: StationServiceCode[];
  latitude?: number;
  longitude?: number;
  maps_link?: string;
};

export type ActivityItem = {
  id: string;
  created_at: string;
  role: StationRole;
  /** Voir ActivityAction ; libellé via activityActionLabel(). */
  action: string;
  detail: string | null;
  actor_name: string | null;
  outlet_id: string | null;
  outlet_name: string | null;
  city: string | null;
};

export type DeliveryItem = {
  id: string;
  outlet_id: string;
  outlet_name: string;
  fuel: FuelKey;
  liters: number;
  reference: string | null;
  delivered_at: string;
  /** Nom de la personne qui a enregistré la livraison. */
  recorded_by: string | null;
};

export type DeliveryInput = {
  fuel: FuelKey;
  /** 1 à 200 000. */
  liters: number;
  reference?: string;
  /** ISO 8601 ; absent = maintenant. Pas plus de 30 jours en arrière. */
  delivered_at?: string;
};

/** Retour client (signalement), avec son traitement. */
export type ReportItem = StationReport;

export type ReportResolveInput = { resolution?: string };

/** Gérant d'une station (id = identifiant de l'affectation, utilisé pour le retrait). */
export type StationManagerRef = { id: string; email: string; full_name: string | null };

/** GET /station-space/me : décide si le menu affiche « Espace station ». */
export type StationSpaceMe = { is_owner: boolean; owner_brand: string | null; cities: number; stations: number };

/** Ce compte est responsable d'une ville ou gérant d'une station (propriétaire ou non). */
export function hasStationSpace(me: StationSpaceMe | null | undefined): me is StationSpaceMe {
  return Boolean(me && me.cities + me.stations > 0);
}

/** Résumé court pour le raccourci : « 2 villes · 1 station ». */
export function stationSpaceSummary(me: StationSpaceMe): string {
  const parts: string[] = [];
  if (me.cities > 0) parts.push(`${me.cities} ${me.cities > 1 ? "villes" : "ville"}`);
  if (me.stations > 0) parts.push(`${me.stations} ${me.stations > 1 ? "stations" : "station"}`);
  return parts.join(" · ");
}

export type RegionTotals = {
  stations: number;
  fresh: number;
  to_confirm: number;
  /** Stations à jour avec au moins un carburant en rupture. */
  out: number;
  without_manager: number;
  open_reports: number;
  calls_30d: number;
  routes_30d: number;
  gas_orders_30d: number;
};

export type RegionStation = {
  id: string;
  name: string;
  city: string;
  is_active: boolean;
  fuel: FuelStatus;
  fuel_fresh: boolean;
  fuel_updated_at: string | null;
  info: StationInfo;
  managers: StationManagerRef[];
  open_reports: number;
  calls_30d: number;
  routes_30d: number;
  gas_orders_30d: number;
};

/** Une ville confiée à un responsable, pour une marque. */
export type RegionCity = {
  vendor_id: string;
  brand_name: string;
  city: string;
  /** False si l'abonnement de la marque a expiré : écritures suspendues. */
  can_update: boolean;
  totals: RegionTotals;
  stations: RegionStation[];
};

export type RegionOutletCreate = { vendor_id: string; city: string; name: string; address?: string; phone?: string };
export type RegionOutletUpdate = { name?: string; is_active?: boolean };

/** Filtres du journal du propriétaire (GET /seller/fuel-activity). */
export type FuelActivityFilters = { city?: string; outlet_id?: string; role?: StationRole; limit?: number };
