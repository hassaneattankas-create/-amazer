import type { StationInfo, StationManagerRef, StationRole, StationServiceCode } from "@/types/station-space";

/** Pharmacies de garde et stations-essence (vitrines Premium dont l'admin a choisi le type). */
export type ServiceKind = "pharmacy" | "fuel_station";
export type FuelKey = "super" | "gasoil" | "gaz";
export type FuelState = "available" | "low" | "out";
export type FuelStatus = Partial<Record<FuelKey, FuelState | null>>;

export type LocalServiceItem = {
  vendor_id: string;
  vendor_slug: string;
  service_kind: ServiceKind;
  business_name: string;
  /** Point de vente d'une marque (ex. « Oriba · Plateau »). */
  outlet_id?: string | null;
  brand_name?: string | null;
  /** Nombre de stations de la marque (lien « Voir les N stations »). */
  brand_outlets?: number;
  city: string | null;
  address: string | null;
  phone: string | null;
  whatsapp_contact: string | null;
  logo_url: string | null;
  is_verified: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Itinéraire Google Maps (position exacte si enregistrée, sinon recherche de l'adresse). */
  maps_url: string;
  /** Numéro AMAZER pour se faire livrer ; null si la ville n'est pas encore desservie. */
  delivery_phone: string | null;
  on_duty: boolean;
  duty_label: string | null;
  fuel: FuelStatus;
  /** Disponibilités déjà renseignées par la station. */
  fuel_fresh: boolean;
  fuel_updated_at: string | null;
  /** Stations : horaires en texte libre (ex. « 24 h/24 »). */
  opening_hours?: string | null;
  /** Stations : codes de services (voir STATION_SERVICE_LABELS). */
  services?: string[];
};

export type LocalServiceList = {
  items: LocalServiceItem[];
  cities: Array<{ city: string; count: number }>;
  delivery_cities: string[];
  fresh_hours: number;
};

export type ServiceStatus = {
  service_kind: ServiceKind | null;
  on_duty: boolean;
  on_duty_now: boolean;
  duty_start: string | null;
  duty_end: string | null;
  duty_label: string | null;
  fuel: FuelStatus;
  fuel_fresh: boolean;
  fuel_updated_at: string | null;
  latitude: number | null;
  longitude: number | null;
  maps_url: string;
  delivery_phone: string | null;
};

export type ServiceStatusUpdate = {
  on_duty?: boolean;
  duty_start?: string;
  duty_end?: string;
  clear_duty_period?: boolean;
  fuel?: FuelStatus;
  latitude?: number;
  longitude?: number;
};

/** Station d'une marque de carburant, gérée depuis le tableau de bord de la marque. */
export type FuelOutlet = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  maps_url: string;
  delivery_phone: string | null;
  fuel: FuelStatus;
  fuel_fresh: boolean;
  fuel_updated_at: string | null;
  /** 30 derniers jours. */
  calls_30d?: number;
  routes_30d?: number;
  gas_orders_30d?: number;
  /** Horaires, services, position, date de mise à jour des informations. */
  info: StationInfo;
  managers: StationManagerRef[];
  /** Retours clients non traités (30 jours). */
  open_reports: number;
};

/** Résumé du réseau d'une marque : prix de l'abonnement et état des stations. */
export type FuelNetwork = {
  stations: number;
  included: number;
  base: number;
  extra: number;
  total: number;
  flat: number;
  capped: boolean;
  next_station_price: number;
  negotiated: number | null;
  with_gas: number;
  to_confirm: number;
};

export type FuelOutletInput = { name: string; city: string; address?: string; phone?: string };
export type FuelOutletUpdate = Partial<FuelOutletInput> & {
  is_active?: boolean;
  fuel?: FuelStatus;
  latitude?: number;
  longitude?: number;
  /** Chaîne vide = effacé. */
  opening_hours?: string;
  services?: StationServiceCode[];
  /** Lien Google Maps ou « lat, lng » : le serveur en extrait la position. */
  maps_link?: string;
};

export const FUEL_LABELS: Record<FuelKey, string> = { super: "Super", gasoil: "Gasoil", gaz: "Gaz" };
export const FUEL_STATE_LABELS: Record<FuelState, string> = { available: "disponible", low: "stock faible", out: "rupture" };

export type FuelChange = {
  outlet_id: string | null;
  outlet_name: string | null;
  fuel: FuelKey;
  old_state: FuelState | null;
  new_state: FuelState;
  created_at: string;
};

export type FuelManager = { id: string; outlet_id: string; outlet_name: string; email: string; full_name: string };

export type ManagedOutlet = {
  id: string;
  name: string;
  brand_name: string;
  city: string;
  fuel: FuelStatus;
  fuel_fresh: boolean;
  fuel_updated_at: string | null;
  can_update: boolean;
  /** Traiter un retour reste possible sur une station fermée. */
  can_resolve: boolean;
  fresh_hours: number;
  /** Station confiée via une ville (responsable régional). */
  via_region?: string | null;
  info: StationInfo;
  /** Retours clients non traités (30 jours). */
  open_reports: number;
  /**
   * « city » : station vue en tant que responsable de ville ; « manager » : gérant désigné.
   * GET /station-manager/outlets ne renvoie que « city » | « manager » ; les PUT renvoient « owner »
   * quand le propriétaire de la marque les appelle (espace propriétaire).
   */
  role: StationRole;
};

export type FuelPlan = {
  level: 1 | 2 | 3;
  name: string;
  stations: number;
  network_from: number;
  enterprise_from: number;
  /** Héritage : les responsables de ville ne dépendent plus de l'offre. Ne pas s'en servir pour masquer une fonction. */
  network_tools: boolean;
  export: boolean;
};

export type FuelDashboard = {
  stations: number;
  fresh: number;
  to_confirm: number;
  without_manager: number;
  reports_30d: number;
  stale: { id: string; name: string; city: string; fuel_updated_at: string | null }[];
  long_outages: { id: string; name: string; city: string; fuel: FuelKey; since: string }[];
  cities: {
    city: string;
    stations: number;
    to_confirm: number;
    out: number;
    /** Noms des responsables de la ville. */
    city_managers: string[];
    calls_30d: number;
    routes_30d: number;
    without_manager: number;
  }[];
  /** Trafic et livraisons des 30 derniers jours, toute la marque. */
  calls_30d: number;
  routes_30d: number;
  gas_orders_30d: number;
  deliveries_30d: number;
};

export type RegionManager = {
  id: string;
  city: string;
  email: string;
  full_name: string;
  /** Stations de la marque dans cette ville. */
  stations: number;
  /** Dernière action de ce responsable pour la marque (ISO) ; null = aucune. */
  last_activity_at: string | null;
};

export type OfficialEntry = { name: string; district: string | null; location: string | null; phone: string | null; group_label: string | null };

/** Liste officielle datée (pharmacies de garde, stations approvisionnées), publiée par AMAZER avec sa source. */
export type OfficialList = {
  id: string;
  kind: "pharmacy_duty" | "fuel_supply";
  city: string;
  title: string;
  source: string;
  brand: string | null;
  fuel: FuelKey | null;
  contact_phone: string | null;
  contact_address: string | null;
  starts_at: string;
  ends_at: string;
  entries: OfficialEntry[];
};

export type StationReportKind = "wrong_status" | "closed" | "wrong_place" | "other";
export type StationReport = {
  /** Identifiant du retour (pour « Marquer traité »). */
  id: string;
  outlet_id: string | null;
  outlet_name: string | null;
  kind: StationReportKind;
  comment: string | null;
  created_at: string;
  /** null = non traité. */
  resolved_at: string | null;
  resolution: string | null;
  resolved_by_name: string | null;
};
