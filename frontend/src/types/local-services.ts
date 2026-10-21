/** Pharmacies de garde et stations-essence (vitrines Premium dont l'admin a choisi le type). */
export type ServiceKind = "pharmacy" | "fuel_station";
export type FuelKey = "super" | "gasoil" | "gaz";
export type FuelState = "available" | "out";
export type FuelStatus = Partial<Record<FuelKey, FuelState | null>>;

export type LocalServiceItem = {
  vendor_id: string;
  vendor_slug: string;
  service_kind: ServiceKind;
  business_name: string;
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
  /** Information carburant récente (moins de fresh_hours). */
  fuel_fresh: boolean;
  fuel_updated_at: string | null;
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

export const FUEL_LABELS: Record<FuelKey, string> = { super: "Super", gasoil: "Gasoil", gaz: "Gaz" };
